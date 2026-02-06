require('dotenv').config();
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require('qrcode');
const express = require("express");
const { getAIResponse } = require("./core/ai");

const app = express();
let lastQr = null;
let isBotActive = true; // زر التشغيل والإيقاف البرمي
let isConnected = false;
let contacts = {}; // مخزن جهات الاتصال

// عرض الحالة والكود في المتصفح
app.get("/", async (req, res) => {
    if (isConnected) return res.send("<h1>السيستم VIP شغال ومتصل! ✅</h1>");
    if (lastQr) {
        const qrImage = await QRCode.toDataURL(lastQr);
        return res.send(`<div style="text-align:center;"><h1>امسح الكود لتفعيل الـ VIP</h1><img src="${qrImage}" /></div>`);
    }
    res.send("<h1>جاري التجهيز... حدث الصفحة بعد ثوانٍ</h1>");
});
app.listen(process.env.PORT || 3000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({ logger: pino({ level: "silent" }), auth: state, browser: ["Rashed VIP", "Chrome", "1.0.0"] });

    sock.ev.on("creds.update", saveCreds);

    // مزامنة جهات الاتصال
    sock.ev.on("contacts.upsert", (newContacts) => {
        newContacts.forEach(c => contacts[c.id] = c.name || c.verifiedName || c.id.split('@')[0]);
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) lastQr = qr;
        if (connection === "open") { isConnected = true; console.log("تم الاتصال!"); }
        if (connection === "close") { isConnected = false; startBot(); }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = jid.includes("966554526287");
        const senderName = contacts[jid] || "شخص غير مسجل";

        // أوامر التحكم الملكية
        if (isOwner && text === ".توقف") { isBotActive = false; return sock.sendMessage(jid, { text: "تم إيقاف الرد الآلي يا راشد. 💤" }); }
        if (isOwner && text === ".تشغيل") { isBotActive = true; return sock.sendMessage(jid, { text: "أبشر، البوت الآن في وضع الاستعداد والذكاء الكامل! 🚀" }); }

        if (!isBotActive) return;

        try {
            const isImage = !!msg.message.imageMessage;
            const buffer = isImage ? await downloadMediaMessage(msg, 'buffer', {}) : null;
            
            // تمرير الاسم والهوية للذكاء الاصطناعي
            const response = await getAIResponse(jid, text, isImage, buffer, senderName);
            await sock.sendMessage(jid, { text: response });
        } catch (e) { console.error(e); }
    });
}
startBot();
