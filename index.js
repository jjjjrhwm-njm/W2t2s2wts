require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState, 
    downloadMediaMessage,
    Browsers // إضافة استيراد الهويات المعيارية
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require('qrcode');
const express = require("express");
const { getAIResponse } = require("./core/ai");

const app = express();
let lastQr = null;
let isBotActive = true;
let isConnected = false;
let contacts = {};

app.get("/", async (req, res) => {
    if (isConnected) return res.send("<h1 style='text-align:center;color:green;'>السيستم VIP متصل الآن! ✅</h1>");
    if (lastQr) {
        const qrImage = await QRCode.toDataURL(lastQr);
        return res.send(`
            <div style="text-align:center;font-family:sans-serif;margin-top:50px;">
                <h1>امسح الكود لتفعيل الـ VIP 👑</h1>
                <img src="${qrImage}" style="border:10px solid #333; border-radius:15px; padding:10px;" />
                <p>حدث الصفحة إذا لم يظهر كود جديد خلال دقيقة.</p>
                <script>setTimeout(() => location.reload(), 30000);</script>
            </div>
        `);
    }
    res.send("<h1 style='text-align:center;'>جاري طلب الكود من واتساب... انتظر ثواني وحدث الصفحة 🔄</h1>");
});

app.listen(process.env.PORT || 3000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({ 
        logger: pino({ level: "silent" }), 
        auth: state, 
        // إصلاح الهوية: التظاهر بأننا متصفح مكتبي (أكثر استقراراً للكود)
        browser: Browsers.macOS('Desktop') 
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("contacts.upsert", (newContacts) => {
        newContacts.forEach(c => contacts[c.id] = c.name || c.verifiedName || c.id.split('@')[0]);
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            lastQr = qr;
            console.log("كيو ار جديد جاهز!");
        }
        if (connection === "open") {
            isConnected = true;
            lastQr = null;
            console.log("البوت متصل بنجاح!");
        }
        if (connection === "close") {
            isConnected = false;
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = jid.includes("966554526287");
        const senderName = contacts[jid] || "شخص غير مسجل";

        if (isOwner && text === ".توقف") { isBotActive = false; return sock.sendMessage(jid, { text: "تم الإيقاف. 💤" }); }
        if (isOwner && text === ".تشغيل") { isBotActive = true; return sock.sendMessage(jid, { text: "تم التشغيل! 🚀" }); }

        if (!isBotActive) return;

        try {
            const isImage = !!msg.message.imageMessage;
            const buffer = isImage ? await downloadMediaMessage(msg, 'buffer', {}) : null;
            const response = await getAIResponse(jid, text, isImage, buffer, senderName);
            await sock.sendMessage(jid, { text: response });
        } catch (e) { console.error("Error:", e); }
    });
}
startBot();
