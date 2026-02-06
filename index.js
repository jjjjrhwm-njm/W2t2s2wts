require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay, getContentType } = require("@whiskeysockets/baileys");
const admin = require("firebase-admin");
const express = require("express");
const QRCode = require("qrcode");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

// استيراد المنطق المطور
const { getAIResponse } = require("./core/ai");
const { handleManualCommand } = require("./core/commands");
const { isSpamming } = require("./core/antiSpam");

const app = express();
const port = process.env.PORT || 10000;
let qrCodeImage = "";
let isConnected = false;
let sock = null;
let db = null;
let botStatus = {
    isActive: true,
    autoReply: true,
    privateMode: false,
    maintenance: false,
    lastRestart: new Date()
};

// إعداد Firebase
if (process.env.FIREBASE_CONFIG) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
        if (!admin.apps.length) {
            admin.initializeApp({ 
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
            });
            db = admin.firestore();
            console.log("✅ Firebase connected successfully");
        }
    } catch (e) { 
        console.log("⚠️ Firebase Error:", e.message); 
    }
}

// إعداد مجلدات النظام
function setupDirectories() {
    const directories = [
        './auth_info',
        './logs',
        './backups',
        './cache',
        './temp'
    ];
    
    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// نظام حفظ السجلات
class Logger {
    constructor() {
        this.logFile = `./logs/bot_${new Date().toISOString().split('T')[0]}.log`;
    }
    
    log(type, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            type,
            message,
            data: data ? JSON.stringify(data).substring(0, 500) : null
        };
        
        console.log(`[${timestamp}] ${type}: ${message}`);
        
        // حفظ في الملف
        fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        
        // حفظ في Firebase إذا كان متصلاً
        if (db && type === 'ERROR') {
            this.saveToFirebase(logEntry);
        }
    }
    
    async saveToFirebase(logEntry) {
        try {
            await db.collection('error_logs').add({
                ...logEntry,
                serverTime: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to save log to Firebase:", error);
        }
    }
}

const logger = new Logger();

// نظام إدارة الحالة
class StateManager {
    constructor() {
        this.userStates = new Map();
        this.groupStates = new Map();
        this.conversationContexts = new Map();
        this.messageQueue = new Map();
    }
    
    getUserState(jid) {
        if (!this.userStates.has(jid)) {
            this.userStates.set(jid, {
                isTyping: false,
                lastInteraction: new Date(),
                conversationMode: 'normal',
                pendingActions: [],
                preferences: {}
            });
        }
        return this.userStates.get(jid);
    }
    
    updateUserState(jid, updates) {
        const state = this.getUserState(jid);
        Object.assign(state, updates);
        state.lastInteraction = new Date();
        this.userStates.set(jid, state);
    }
    
    addToQueue(jid, message) {
        if (!this.messageQueue.has(jid)) {
            this.messageQueue.set(jid, []);
        }
        this.messageQueue.get(jid).push(message);
    }
    
    processQueue(jid) {
        if (this.messageQueue.has(jid)) {
            const queue = this.messageQueue.get(jid);
            this.messageQueue.delete(jid);
            return queue;
        }
        return [];
    }
}

const stateManager = new StateManager();

// وظيفة بدء البوت
async function startBot() {
    try {
        setupDirectories();
        logger.log('INFO', 'Starting bot initialization...');
        
        // استعادة الجلسة من Firebase
        await restoreSession();
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({ 
            version, 
            auth: state, 
            printQRInTerminal: false, 
            logger: pino({ level: "silent" }),
            browser: ["Mac OS", "Chrome", "114.0.5735.198"],
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            emitOwnEvents: true,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });
        
        // معالجة تحديثات الاعتماد
        sock.ev.on('creds.update', async () => {
            await saveCreds();
            await backupSessionToFirebase();
        });
        
        // معالجة تحديثات الاتصال
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr) {
                QRCode.toDataURL(qr, (err, url) => { 
                    qrCodeImage = url; 
                    logger.log('INFO', 'New QR Code generated');
                });
            }
            
            if (connection === 'open') { 
                isConnected = true; 
                qrCodeImage = "DONE"; 
                botStatus.lastRestart = new Date();
                logger.log('SUCCESS', 'Bot connected successfully!');
                
                // إرسال رسالة بدء التشغيل للمطور
                await sendStartupNotification();
            }
            
            if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    logger.log('WARNING', 'Connection closed, attempting reconnect...');
                    setTimeout(startBot, 5000);
                } else {
                    logger.log('ERROR', 'Bot logged out, manual restart required');
                }
            }
        });
        
        // معالجة الرسائل الواردة
        sock.ev.on('messages.upsert', async m => {
            try {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                await processIncomingMessage(msg);
            } catch (error) {
                logger.log('ERROR', 'Error processing message:', error);
            }
        });
        
        // معالجة حالة الكتابة
        sock.ev.on('presence.update', async ({ id, presences }) => {
            // يمكن إضافة تفاعلات ذكية هنا
        });
        
        // معالجة حالات القراءة
        sock.ev.on('messages.update', async (updates) => {
            // يمكن تتبع حالات قراءة الرسائل
        });
        
        logger.log('INFO', 'Bot setup completed, waiting for connection...');
        
    } catch (error) {
        logger.log('ERROR', 'Failed to start bot:', error);
        setTimeout(startBot, 10000); // إعادة المحاولة بعد 10 ثواني
    }
}

// استعادة الجلسة من Firebase
async function restoreSession() {
    if (!db) return;
    
    try {
        const doc = await db.collection('session').doc('session_vip_rashed').get();
        if (doc.exists) {
            const sessionData = doc.data();
            fs.writeFileSync('./auth_info/creds.json', JSON.stringify(sessionData));
            logger.log('INFO', 'VIP session restored from Firebase');
        }
    } catch (error) {
        logger.log('WARNING', 'Failed to restore session:', error.message);
    }
}

// نسخ الجلسة إلى Firebase
async function backupSessionToFirebase() {
    if (!db || !fs.existsSync('./auth_info/creds.json')) return;
    
    try {
        const creds = JSON.parse(fs.readFileSync('./auth_info/creds.json', 'utf8'));
        await db.collection('session').doc('session_vip_rashed').set(creds, { merge: true });
        logger.log('INFO', 'Session backed up to Firebase');
    } catch (error) {
        logger.log('ERROR', 'Failed to backup session:', error);
    }
}

// إرسال إشعار بدء التشغيل
async function sendStartupNotification() {
    const ownerJid = process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER + '@s.whatsapp.net' : null;
    
    if (ownerJid && sock) {
        try {
            await sock.sendMessage(ownerJid, {
                text: `✅ البوت اشتغل بنجاح!\n\n` +
                      `الوقت: ${new Date().toLocaleString('ar-SA')}\n` +
                      `الحالة: نشط وجاهز\n` +
                      `المستخدمين: جاري الاستعداد...\n\n` +
                      `_الرجاء عدم مشاركة رمز QR_ 🔒`
            });
        } catch (error) {
            logger.log('WARNING', 'Could not send startup notification:', error.message);
        }
    }
}

// معالجة الرسائل الواردة
async function processIncomingMessage(msg) {
    const jid = msg.key.remoteJid;
    const pushName = msg.pushName || 'صديق';
    const messageType = getContentType(msg.message);
    
    // استخراج النص من الرسالة
    let text = '';
    if (messageType === 'conversation') {
        text = msg.message.conversation || '';
    } else if (messageType === 'extendedTextMessage') {
        text = msg.message.extendedTextMessage?.text || '';
    } else if (messageType === 'imageMessage') {
        text = msg.message.imageMessage?.caption || '';
    }
    
    // تجاهل إذا كان نص فارغاً
    if (!text.trim() && messageType !== 'imageMessage') return;
    
    // التحقق من السبام
    if (isSpamming(jid, text)) {
        logger.log('SPAM', `Spam detected from ${pushName} (${jid})`);
        return;
    }
    
    // التحقق إذا كان المرسل هو المطور
    const isOwner = jid.includes(process.env.OWNER_NUMBER || "966554526287");
    
    // تحديث حالة المستخدم
    stateManager.updateUserState(jid, { isTyping: false });
    
    try {
        // 1. التحقق من الأوامر اليدوية
        const manualResponse = handleManualCommand(text, jid, isOwner, pushName);
        
        if (manualResponse) {
            await simulateHumanTyping(jid, manualResponse.length);
            await sock.sendMessage(jid, { text: manualResponse });
            logger.log('COMMAND', `Command executed for ${pushName}: ${text.substring(0, 50)}`);
            return;
        }
        
        // 2. إذا كان البوت في وضع الصيانة
        if (botStatus.maintenance && !isOwner) {
            await sock.sendMessage(jid, { 
                text: `⚠️ معذرة ${pushName}، البوت حالياً في وضع الصيانة.\n` +
                      `الرجاء المحاولة مرة أخرى لاحقاً. شكراً لتفهمك. 🤲`
            });
            return;
        }
        
        // 3. إذا كان الرد التلقائي معطلاً
        if (!botStatus.autoReply && !isOwner) {
            return;
        }
        
        // 4. الرد باستخدام الذكاء الاصطناعي
        await simulateHumanTyping(jid, text.length);
        
        const aiResponse = await getAIResponse(jid, text, pushName);
        
        if (aiResponse) {
            // محاكاة التفكير البشري
            await delay(getRandomTypingTime(text.length));
            
            await sock.sendMessage(jid, { text: aiResponse });
            
            logger.log('AI_RESPONSE', `AI replied to ${pushName}`, {
                queryLength: text.length,
                responseLength: aiResponse.length
            });
            
            // تحديث الإحصائيات إذا كان هناك قاعدة بيانات
            if (db) {
                await updateStatistics(jid, pushName, text, aiResponse);
            }
        }
        
    } catch (error) {
        logger.log('ERROR', `Error processing message from ${pushName}:`, error);
        
        // رد خطأ طبيعي
        if (sock) {
            await sock.sendMessage(jid, {
                text: `عفواً ${pushName}، حصل خطأ غير متوقع. 🙏\n` +
                      `جرب مرة أخرى بعد قليل، أو راسل المطور إذا استمر الخطأ.`
            });
        }
    }
}

// محاكاة الكتابة البشرية
async function simulateHumanTyping(jid, textLength) {
    if (!sock) return;
    
    try {
        await sock.sendPresenceUpdate('composing', jid);
        
        // وقت الكتابة يتناسب مع طول النص
        const baseTime = Math.min(textLength * 10, 3000); // 10ms لكل حرف، بحد أقصى 3 ثواني
        const randomVariation = Math.random() * 1000; // تغيير عشوائي
        const typingTime = baseTime + randomVariation;
        
        // في بعض الأحيان تتوقف الكتابة (مثل البشر)
        if (Math.random() > 0.7) {
            await delay(typingTime / 2);
            await sock.sendPresenceUpdate('paused', jid);
            await delay(500);
            await sock.sendPresenceUpdate('composing', jid);
            await delay(typingTime / 2);
        } else {
            await delay(typingTime);
        }
        
        // توقف الكتابة قبل الإرسال بفترة قصيرة
        await sock.sendPresenceUpdate('paused', jid);
        await delay(200);
        
    } catch (error) {
        // تجاهل أخطاء حالة الكتابة
    }
}

function getRandomTypingTime(textLength) {
    const baseTime = 500 + (textLength * 5); // وقت أساسي + حسب الطول
    const variation = Math.random() * 1000; // تغيير عشوائي
    return Math.min(baseTime + variation, 4000); // بحد أقصى 4 ثواني
}

// تحديث الإحصائيات في Firebase
async function updateStatistics(jid, pushName, query, response) {
    if (!db) return;
    
    try {
        const statsRef = db.collection('statistics').doc('bot_stats');
        const userRef = db.collection('users').doc(jid);
        
        // تحديث الإحصائيات العامة
        await statsRef.set({
            total_messages: admin.firestore.FieldValue.increment(1),
            last_activity: admin.firestore.FieldValue.serverTimestamp(),
            active_users: admin.firestore.FieldValue.increment(1)
        }, { merge: true });
        
        // تحديث بيانات المستخدم
        await userRef.set({
            name: pushName,
            last_interaction: admin.firestore.FieldValue.serverTimestamp(),
            message_count: admin.firestore.FieldValue.increment(1),
            last_query: query.substring(0, 100),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // حفظ سجل المحادثة
        await db.collection('conversations').add({
            user_jid: jid,
            user_name: pushName,
            query: query,
            response: response,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
    } catch (error) {
        logger.log('WARNING', 'Failed to update statistics:', error.message);
    }
}

// واجهة ويب متطورة للمراقبة
app.get("/", (req, res) => {
    if (isConnected) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>🚀 نظام السكرتير الذكي</title>
            <style>
                body {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: #e6e6e6;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 8px 20px;
                    background: #00ff88;
                    color: #000;
                    border-radius: 50px;
                    font-weight: bold;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                }
                .stat-card {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    border-radius: 15px;
                    text-align: center;
                    transition: transform 0.3s;
                }
                .stat-card:hover {
                    transform: translateY(-5px);
                    background: rgba(255, 255, 255, 0.15);
                }
                .stat-value {
                    font-size: 2.5em;
                    font-weight: bold;
                    color: #00ff88;
                    margin: 10px 0;
                }
                .footer {
                    text-align: center;
                    margin-top: 40px;
                    color: #888;
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 نظام السكرتير الذكي VIP</h1>
                    <div class="status-badge">✅ متصل ويعمل بنجاح</div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div>⏱️ مدة التشغيل</div>
                        <div class="stat-value">${hours}س ${minutes}د</div>
                    </div>
                    <div class="stat-card">
                        <div>📅 آخر تشغيل</div>
                        <div class="stat-value">${botStatus.lastRestart.toLocaleTimeString('ar-SA')}</div>
                    </div>
                    <div class="stat-card">
                        <div>💬 حالة الرد</div>
                        <div class="stat-value">${botStatus.autoReply ? 'نشط' : 'متوقف'}</div>
                    </div>
                    <div class="stat-card">
                        <div>🔧 وضع البوت</div>
                        <div class="stat-value">${botStatus.maintenance ? 'صيانة' : 'عادي'}</div>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                    <h3>📊 معلومات النظام:</h3>
                    <p>• الذاكرة المستخدمة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</p>
                    <p>• نظام التشغيل: ${process.platform}</p>
                    <p>• إصدار Node.js: ${process.version}</p>
                    <p>• وقت الخادم: ${new Date().toLocaleString('ar-SA')}</p>
                </div>
                
                <div class="footer">
                    <p>👑 نظام VIP حصري | © 2024 السكرتير الذكي</p>
                    <p>🛡️ محمي ومشفّر | 🔒 خصوصية تامة</p>
                </div>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } else if (qrCodeImage && qrCodeImage !== "DONE") {
        const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>🔐 مسح رمز QR</title>
            <style>
                body {
                    background: #000;
                    color: #0f0;
                    text-align: center;
                    padding: 50px;
                    font-family: monospace;
                }
                .qr-container {
                    margin: 30px auto;
                    padding: 20px;
                    background: #111;
                    display: inline-block;
                    border-radius: 10px;
                    border: 2px solid #0f0;
                }
                .instructions {
                    margin: 30px;
                    line-height: 1.6;
                }
            </style>
        </head>
        <body>
            <h1>🔐 تفعيل نظام VIP</h1>
            <div class="instructions">
                <p>1. افتح واتساب على هاتفك</p>
                <p>2. اضغط على النقاط الثلاث → الأجهزة المرتبطة</p>
                <p>3. امسح رمز QR هذا</p>
                <p>4. انتظر حتى يكتمل الاتصال</p>
            </div>
            <div class="qr-container">
                <img src="${qrCodeImage}" style="width: 300px;">
            </div>
            <p>⏳ جاري الانتظار للاتصال...</p>
        </body>
        </html>
        `;
        res.send(html);
    } else {
        res.send("<h1 style='text-align:center;padding:50px;'>🔄 جاري تهيئة النظام، انتظر ثوانٍ...</h1>");
    }
});

// نقطة نهاية للتحقق من الصحة
app.get("/health", (req, res) => {
    res.json({
        status: isConnected ? "connected" : "disconnected",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        botStatus: botStatus
    });
});

// نقطة نهاية للتحكم (للمطور فقط)
app.get("/control/:action", (req, res) => {
    const { action } = req.params;
    const { key } = req.query;
    
    if (key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    switch(action) {
        case 'restart':
            botStatus.lastRestart = new Date();
            res.json({ message: "تم طلب إعادة التشغيل" });
            break;
        case 'status':
            res.json(botStatus);
            break;
        default:
            res.status(400).json({ error: "إجراء غير معروف" });
    }
});

// بدء الخادم والبوت
app.listen(port, () => {
    console.log(`🌐 Server running on port ${port}`);
    startBot();
});

// معالجة إغلاق التطبيق بشكل نظيف
process.on('SIGINT', async () => {
    logger.log('INFO', 'Shutting down gracefully...');
    
    if (sock) {
        try {
            await sock.logout();
        } catch (error) {
            // تجاهل الأخطاء أثناء الإغلاق
        }
    }
    
    process.exit(0);
});

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
    logger.log('CRITICAL', 'Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.log('CRITICAL', 'Unhandled rejection at:', promise, 'reason:', reason);
});

module.exports = { app, startBot, botStatus };
