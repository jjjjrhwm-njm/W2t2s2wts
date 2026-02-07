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
const gatekeeper = require("./gatekeeper");

const app = express();
const port = process.env.PORT || 10000;
let qrCodeImage = "";
let isConnected = false;
let sock = null;
let db = null;

// إعداد حالة البوت
let botStatus = {
    isActive: true,
    autoReply: true,
    privateMode: false,
    maintenance: false,
    lastRestart: new Date(),
    isPaused: false,
    statusMessage: "✅ البوت نشط وجاهز للعمل"
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
        if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');
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
        
        try {
            fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        } catch (e) {}
        
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
    }
    
    updateUserState(jid, updates) {
        const state = this.userStates.get(jid) || { lastInteraction: new Date() };
        Object.assign(state, updates);
        state.lastInteraction = new Date();
        this.userStates.set(jid, state);
    }
}

const stateManager = new StateManager();

// نظام التحكم في البوت
class BotController {
    static async handleStarCommand(text, jid, pushName) {
        const cleanText = text.trim().toLowerCase();
        
        // التحقق من كلمة السر "نجم"
        if (cleanText.startsWith('نجم ')) {
            const command = cleanText.substring(4).trim();
            
            switch(command) {
                case 'قف':
                    botStatus.isPaused = true;
                    botStatus.autoReply = false;
                    botStatus.statusMessage = "⏸️ البوت متوقف مؤقتاً";
                    logger.log('COMMAND', `Bot paused by ${pushName}`);
                    
                    return `*⏸️ تم إيقاف البوت مؤقتاً*\n\n`
                         + `مرحباً ${pushName}،\n\n`
                         + `تم إيقاف البوت مؤقتاً.\n`
                         + `لن يرد على أي رسائل جديدة.\n\n`
                         + `*للاستئناف:* اكتب "نجم اشتغل"\n`
                         + `*للتشغيل الكامل:* اكتب "نجم شغل"`;
                
                case 'اشتغل':
                    botStatus.isPaused = false;
                    botStatus.autoReply = true;
                    botStatus.statusMessage = "▶️ البوت يعمل بشكل طبيعي";
                    logger.log('COMMAND', `Bot resumed by ${pushName}`);
                    
                    return `*▶️ تم تشغيل البوت*\n\n`
                         + `مرحباً ${pushName}،\n\n`
                         + `تم تشغيل البوت بنجاح.\n`
                         + `سيرد على الرسائل بشكل طبيعي.\n\n`
                         + `*للإيقاف المؤقت:* اكتب "نجم قف"\n`
                         + `*للتشغيل الكامل:* اكتب "نجم شغل"`;
                
                case 'شغل':
                    botStatus.isActive = true;
                    botStatus.isPaused = false;
                    botStatus.autoReply = true;
                    botStatus.maintenance = false;
                    botStatus.statusMessage = "🚀 البوت نشط بالكامل";
                    logger.log('COMMAND', `Bot fully activated by ${pushName}`);
                    
                    return `*🚀 تم التشغيل الكامل*\n\n`
                         + `مرحباً ${pushName}،\n\n`
                         + `جميع أنظمة البوت تعمل الآن:\n\n`
                         + `✅ الرد التلقائي\n`
                         + `✅ نظام الحارس\n`
                         + `✅ الذكاء الاصطناعي\n`
                         + `✅ جميع الميزات\n\n`
                         + `*للإيقاف المؤقت:* اكتب "نجم قف"\n`
                         + `*للتشغيل الطبيعي:* اكتب "نجم اشتغل"`;
                
                case 'حالتي':
                    const statusEmoji = botStatus.isPaused ? '⏸️' : (botStatus.isActive ? '✅' : '❌');
                    const statusText = botStatus.isPaused ? 'متوقف مؤقتاً' : (botStatus.isActive ? 'نشط' : 'متوقف');
                    
                    return `*📊 حالة البوت الحالية:*\n\n`
                         + `${statusEmoji} *الحالة:* ${statusText}\n`
                         + `💬 *الرسالة:* ${botStatus.statusMessage}\n`
                         + `🔄 *الرد التلقائي:* ${botStatus.autoReply ? 'نشط ✅' : 'معطل ❌'}\n`
                         + `⏰ *آخر إعادة تشغيل:* ${botStatus.lastRestart.toLocaleTimeString('ar-SA')}\n\n`
                         + `*الأوامر المتاحة:*\n`
                         + `- "نجم قف" ← إيقاف مؤقت\n`
                         + `- "نجم اشتغل" ← تشغيل عادي\n`
                         + `- "نجم شغل" ← تشغيل كامل\n`
                         + `- "نجم حالتي" ← عرض الحالة`;
                
                default:
                    return `*🔧 أوامر التحكم بالبوت:*\n\n`
                         + `استخدم "نجم" متبوعة بالأمر:\n\n`
                         + `*قف* ← إيقاف البوت مؤقتاً\n`
                         + `*اشتغل* ← تشغيل البوت عادي\n`
                         + `*شغل* ← تشغيل البوت كامل\n`
                         + `*حالتي* ← عرض حالة البوت\n\n`
                         + `*مثال:* "نجم قف" لإيقاف البوت`;
            }
        }
        
        return null;
    }
}

async function startBot() {
    try {
        setupDirectories();
        logger.log('INFO', 'Starting bot initialization...');
        
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
            syncFullHistory: false
        });
        
        sock.ev.on('creds.update', async () => {
            await saveCreds();
            await backupSessionToFirebase();
        });
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;
            if (qr) {
                QRCode.toDataURL(qr, (err, url) => { qrCodeImage = url; });
            }
            if (connection === 'open') { 
                isConnected = true; 
                qrCodeImage = "DONE"; 
                logger.log('SUCCESS', 'Bot connected successfully!');
                
                // تهيئة الحارس فور الاتصال
                const ownerJid = process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER + '@s.whatsapp.net' : null;
                if (ownerJid) {
                    gatekeeper.initialize(sock, ownerJid);
                }
                
                await sendStartupNotification();
            }
            if (connection === 'close') {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) setTimeout(startBot, 5000);
            }
        });
        
        sock.ev.on('messages.upsert', async m => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            await processIncomingMessage(msg);
        });
        
    } catch (error) {
        logger.log('ERROR', 'Failed to start bot:', error);
        setTimeout(startBot, 10000);
    }
}

async function restoreSession() {
    if (!db) return;
    try {
        const doc = await db.collection('session').doc('session_vip_rashed').get();
        if (doc.exists) {
            const sessionData = doc.data();
            if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
            fs.writeFileSync('./auth_info/creds.json', JSON.stringify(sessionData));
        }
    } catch (e) {}
}

async function backupSessionToFirebase() {
    if (!db || !fs.existsSync('./auth_info/creds.json')) return;
    try {
        const creds = JSON.parse(fs.readFileSync('./auth_info/creds.json', 'utf8'));
        await db.collection('session').doc('session_vip_rashed').set(creds, { merge: true });
    } catch (e) {}
}

async function sendStartupNotification() {
    const ownerJid = process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER + '@s.whatsapp.net' : null;
    if (ownerJid && sock) {
        await sock.sendMessage(ownerJid, { 
            text: `✅ راشد جاهز لخدمتك يا مطور!\n\n` +
                  `*حالة النظام:* ${botStatus.statusMessage}\n` +
                  `*الأوامر المتاحة:*\n` +
                  `- نجم قف ← إيقاف مؤقت\n` +
                  `- نجم اشتغل ← تشغيل عادي\n` +
                  `- نجم شغل ← تشغيل كامل\n` +
                  `- نجم حالتي ← عرض الحالة`
        });
    }
}

async function processIncomingMessage(msg) {
    const jid = msg.key.remoteJid;
    const pushName = msg.pushName || 'صديق';
    const messageType = getContentType(msg.message);
    
    let text = '';
    if (messageType === 'conversation') text = msg.message.conversation;
    else if (messageType === 'extendedTextMessage') text = msg.message.extendedTextMessage?.text;
    else if (messageType === 'imageMessage') text = msg.message.imageMessage?.caption;
    
    if (!text || !text.trim()) return;
    if (isSpamming(jid, text)) return;

    const isOwner = jid.includes(process.env.OWNER_NUMBER || "966554526287");
    
    try {
        // فحص أوامر التحكم "نجم"
        const starCommand = await BotController.handleStarCommand(text, jid, pushName);
        if (starCommand) {
            await sock.sendMessage(jid, { text: starCommand });
            return;
        }

        // التحقق من حالة البوت
        if (botStatus.isPaused && !isOwner) {
            await sock.sendMessage(jid, { 
                text: `⏸️ *البوت متوقف مؤقتاً*\n\n` +
                      `عذراً ${pushName}،\n` +
                      `البوت متوقف حالياً للتحديث والصيانة.\n` +
                      `سيعود للعمل قريباً بإذن الله.\n\n` +
                      `_للتواصل المباشر مع المالك، يرجى الانتظار._`
            });
            return;
        }

        // فحص الأوامر اليدوية
        const manualResponse = await handleManualCommand(text, jid, isOwner, pushName);
        
        if (manualResponse) {
            await simulateHumanTyping(jid, manualResponse.length);
            await sock.sendMessage(jid, { text: manualResponse });
            return;
        }

        // 🛡️ [نظام ديب سيك المطور] --- الحارس --- 🛡️
        
        // 1. إذا كان المرسل هو المالك، نفحص إذا كان يرد بـ نعم/لا
        if (isOwner) {
            if (gatekeeper.handleOwnerDecision(text)) return; 
        }

        // 2. فحص الإذن والانتظار
        const gateResponse = await gatekeeper.handleEverything(jid, pushName, text);
        
        if (gateResponse.status === 'STOP' || gateResponse.status === 'WAITING') return;
        
        // 3. الحصول على الاسم الحقيقي للرد الشخصي
        const realName = await gatekeeper.getNameForResponse(jid, pushName);
        
        if (botStatus.maintenance && !isOwner) return;
        if (!botStatus.autoReply && !isOwner) return;
        
        // الرد بالذكاء الاصطناعي مع الاسم الحقيقي
        await sock.sendPresenceUpdate('composing', jid);
        
        // استخدام الاسم الحقيقي بدلاً من pushName
        const aiResponse = await getAIResponse(jid, text, realName);
        
        if (aiResponse) {
            await delay(1000 + (aiResponse.length * 10)); 
            await sock.sendMessage(jid, { text: aiResponse });
            if (db) updateStatistics(jid, realName, text, aiResponse);
        }
        
    } catch (error) {
        logger.log('ERROR', `Error with ${pushName}:`, error.message);
        await sock.sendMessage(jid, { text: `حصل خطأ بسيط في معالجة رسالتك، أعد المحاولة يا غالي.` });
    }
}

async function simulateHumanTyping(jid, textLength) {
    try {
        await sock.sendPresenceUpdate('composing', jid);
        await delay(Math.min(textLength * 20, 2000));
        await sock.sendPresenceUpdate('paused', jid);
    } catch (e) {}
}

async function updateStatistics(jid, pushName, query, response) {
    try {
        await db.collection('conversations').add({
            user_jid: jid,
            user_name: pushName,
            query: query,
            response: response,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {}
}

app.get("/", (req, res) => {
    if (isConnected) {
        res.send(`
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <title>راشد - السكرتير الذكي</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        text-align: center;
                        padding: 50px;
                    }
                    .container {
                        background: rgba(255,255,255,0.1);
                        padding: 30px;
                        border-radius: 15px;
                        backdrop-filter: blur(10px);
                        max-width: 600px;
                        margin: 0 auto;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    }
                    h1 {
                        margin-bottom: 20px;
                    }
                    .status {
                        font-size: 24px;
                        margin: 20px 0;
                        padding: 15px;
                        background: rgba(0,0,0,0.2);
                        border-radius: 10px;
                    }
                    .commands {
                        text-align: right;
                        background: rgba(255,255,255,0.1);
                        padding: 20px;
                        border-radius: 10px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 راشد - السكرتير الذكي</h1>
                    <div class="status">
                        ✅ البوت متصل الآن
                    </div>
                    <p>حالة البوت: ${botStatus.statusMessage}</p>
                    <div class="commands">
                        <h3>📋 أوامر التحكم:</h3>
                        <p><strong>نجم قف</strong> ← إيقاف البوت مؤقتاً</p>
                        <p><strong>نجم اشتغل</strong> ← تشغيل البوت عادي</p>
                        <p><strong>نجم شغل</strong> ← تشغيل البوت كامل</p>
                        <p><strong>نجم حالتي</strong> ← عرض حالة البوت</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (qrCodeImage && qrCodeImage !== "DONE") {
        res.send(`
            <div style='text-align:center;'>
                <h1>🔐 امسح الكود للاتصال</h1>
                <img src='${qrCodeImage}'>
            </div>
        `);
    } else {
        res.send("<h1 style='text-align:center;'>🔄 جاري التهيئة...</h1>");
    }
});

app.listen(port, () => {
    console.log(`🌐 Server running on port ${port}`);
    console.log(`🤖 Bot Status: ${botStatus.statusMessage}`);
    startBot();
});
