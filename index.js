require("dotenv").config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const admin = require("firebase-admin");
const express = require("express");
const QRCode = require("qrcode");
const pino = require("pino");
const fs = require("fs");
const { getAIResponse } = require("./core/ai");

const app = express();
const port = process.env.PORT || 10000;
let qrCodeImage = "";
let db;
let isConnected = false;

// إعداد Firebase (باسم مستند جديد لضمان عدم التضارب)
if (process.env.FIREBASE_CONFIG) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
            db = admin.firestore();
            console.log("✅ الخزانة متصلة (جلسة VIP)");
        }
    } catch (e) { console.log("❌ خطأ Firebase"); }
}

async function startBot() {
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    
    // استعادة الجلسة من الخزانة (اسم المستند هنا مختلف: session_vip_rashed)
    if (db) {
        try {
            const doc = await db.collection('session').doc('session_vip_rashed').get();
            if (doc.exists) {
                fs.writeFileSync('./auth_info/creds.json', JSON.stringify(doc.data()));
                console.log("📂 استعادة الهوية من الخزانة");
            }
        } catch (e) { console.log("⚠️ لا توجد جلسة سابقة"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    // استخدام الهوية اللي طلبتها بالضبط "لخداع" الواتساب
    const sock = makeWASocket({ 
        version, 
        auth: state, 
        printQRInTerminal: false, 
        logger: pino({ level: "silent" }),
        browser: ["Mac OS", "Chrome", "114.0.5735.198"] 
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        if (db && fs.existsSync('./auth_info/creds.json')) {
            const creds = JSON.parse(fs.readFileSync('./auth_info/creds.json'));
            // حفظ في مستند منفصل
            await db.collection('session').doc('session_vip_rashed').set(creds);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) QRCode.toDataURL(qr, (err, url) => { qrCodeImage = url; });
        if (connection === 'open') { isConnected = true; qrCodeImage = "DONE"; }
        if (connection === 'close') { isConnected = false; startBot(); }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // تنفيذ الرد عبر الذكاء الاصطناعي
        try {
            const response = await getAIResponse(jid, text);
            if (response) await sock.sendMessage(jid, { text: response });
        } catch (e) { console.log("خطأ في الرد"); }
    });
}

// العرض في المتصفح (بنفس طريقتك الناجحة)
app.get("/", (req, res) => {
    if (isConnected) return res.send("<h1>✅ السيستم VIP متصل وشغال!</h1>");
    if (qrCodeImage) return res.send(`<h1>امسح الكود لتفعيل الـ VIP:</h1><br><img src="${qrCodeImage}" style="width:300px; border: 10px solid #25D366;"/>`);
    res.send("<h1>جاري طلب الهوية... حدث الصفحة</h1>");
});

app.listen(port, () => startBot());
