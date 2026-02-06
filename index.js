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
let isConnected = false;
let db;

// إعداد Firebase - تأكد من وجود FIREBASE_CONFIG في متغيرات البيئة
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
    
    // استعادة الجلسة VIP من الخزانة لتجنب التضارب مع البوت الآخر
    if (db) {
        try {
            const doc = await db.collection('session').doc('session_vip_rashed').get();
            if (doc.exists) {
                fs.writeFileSync('./auth_info/creds.json', JSON.stringify(doc.data()));
                console.log("📂 استعادة الهوية VIP");
            }
        } catch (e) { console.log("⚠️ جلسة جديدة"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    // الهوية "الخدعة" التي أرسلتها وأثبتت نجاحها
    const sock = makeWASocket({ 
        version, 
        auth: state, 
        printQRInTerminal: false, 
        logger: pino({ level: "silent" }),
        // الهوية المطابقة تماماً لكودك الناجح
        browser: ["Mac OS", "Chrome", "114.0.5735.198"] 
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
        if (connection === 'open') { isConnected = true; qrCodeImage = "DONE"; }
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
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        try {
            const response = await getAIResponse(jid, text);
            if (response) await sock.sendMessage(jid, { text: response });
        } catch (e) { console.log("AI Error"); }
    });
}

app.get("/", (req, res) => {
    if (isConnected) return res.send("<h1>✅ السيستم VIP متصل الآن!</h1>");
    if (qrCodeImage) return res.send(`<h1>امسح الكود لتفعيل الـ VIP:</h1><br><img src="${qrCodeImage}" style="width:300px; border: 5px solid #25D366;"/>`);
    res.send("<h1>جاري طلب الهوية... انتظر ثوانٍ</h1>");
});

app.listen(port, () => startBot());
