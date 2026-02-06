require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require("@whiskeysockets/baileys");
const admin = require("firebase-admin");
const express = require("express");
const QRCode = require("qrcode");
const pino = require("pino");
const fs = require("fs");

// استيراد المنطق المطور من الملفات الأخرى
const { getAIResponse } = require("./core/ai");
const { handleManualCommand } = require("./core/commands");
const { isSpamming } = require("./core/antiSpam");

const app = express();
const port = process.env.PORT || 10000;
let qrCodeImage = "";
let isConnected = false;
let db;

// إعداد Firebase
if (process.env.FIREBASE_CONFIG) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            db = admin.firestore();
        }
    } catch (e) { console.log("Firebase Error"); }
}

async function startBot() {
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    
    // الحفاظ على الهوية VIP كما هي (لا تلمس هذا الجزء لضمان عدم ضياع الاتصال)
    if (db) {
        try {
            const doc = await db.collection('session').doc('session_vip_rashed').get();
            if (doc.exists) {
                fs.writeFileSync('./auth_info/creds.json', JSON.stringify(doc.data()));
                console.log("📂 تم استعادة الهوية VIP بنجاح");
            }
        } catch (e) { console.log("⚠️ فشل استعادة الجلسة، سيتم طلب كود جديد"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ 
        version, 
        auth: state, 
        printQRInTerminal: false, 
        logger: pino({ level: "silent" }),
        browser: ["Mac OS", "Chrome", "114.0.5735.198"] // الهوية الناجحة
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        if (db && fs.existsSync('./auth_info/creds.json')) {
            const creds = JSON.parse(fs.readFileSync('./auth_info/creds.json'));
            await db.collection('session').doc('session_vip_rashed').set(creds);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;
        if (qr) QRCode.toDataURL(qr, (err, url) => { qrCodeImage = url; });
        if (connection === 'open') { isConnected = true; qrCodeImage = "DONE"; console.log("✅ البوت شغال الآن!"); }
        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const pushName = msg.pushName || "صديقي";
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // منع السبام (الإغراق)
        if (isSpamming(jid)) return;

        // التحقق هل المرسل هو صاحب البوت (يمكنك وضع رقمك هنا بدلاً من 966...)
        const isOwner = jid.includes("966554526287") || jid.includes(process.env.OWNER_NUMBER);

        try {
            // 1. فحص هل الرسالة "أمر يدوي" أو "كلمة السر"
            const manualResponse = handleManualCommand(text, jid, isOwner, pushName);
            
            if (manualResponse) {
                await sock.sendPresenceUpdate('composing', jid); // محاكاة الكتابة
                await delay(1000); 
                await sock.sendMessage(jid, { text: manualResponse });
                return; // إذا كان أمراً يدوياً، لا نذهب للذكاء الاصطناعي
            }

            // 2. الرد عبر الذكاء الاصطناعي (مع إرسال اسم المستخدم ليعرفه البوت)
            const aiResponse = await getAIResponse(jid, text, pushName);
            
            if (aiResponse) {
                // ميزة "البشرية": جاري الكتابة.. ثم انتظار قصير.. ثم الإرسال
                await sock.sendPresenceUpdate('composing', jid);
                const typingSpeed = Math.random() * (3000 - 1000) + 1000; // وقت عشوائي بين 1 و 3 ثواني
                await delay(typingSpeed);
                
                await sock.sendMessage(jid, { text: aiResponse });
            }
        } catch (e) { 
            console.log("Error in Processing Message:", e); 
        }
    });
}

// واجهة الويب لمراقبة الحالة
app.get("/", (req, res) => {
    if (isConnected) return res.send("<body style='background:#000; color:#0f0; text-align:center; padding-top:100px;'><h1>✅ السيستم VIP متصل ويعمل بنجاح!</h1><p>البوت الآن جاهز لاستقبال الأوامر.</p></body>");
    if (qrCodeImage && qrCodeImage !== "DONE") return res.send(`<h1>امسح الكود لتفعيل الـ VIP:</h1><br><img src="${qrCodeImage}" style="width:300px; border: 5px solid #25D366;"/>`);
    res.send("<h1>جاري تهيئة النظام... انتظر ثوانٍ</h1>");
});

app.listen(port, () => startBot());
