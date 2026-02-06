require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState, 
    downloadMediaMessage,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const admin = require("firebase-admin");
const express = require("express");
const { getAIResponse } = require("./core/ai");

// 1. إعداد خادم Express للحفاظ على تشغيل البوت في Render
const app = express();
app.get("/", (req, res) => res.send("البوت يعمل بنجاح! 🚀"));
app.listen(process.env.PORT || 3000);

// 2. إعداد Firebase لإدارة الجلسة سحابياً
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CONFIG))
    });
}
const db = admin.firestore();

async function startBot() {
    // ملاحظة: للتطوير الاحترافي، يفضل دمج MultiFileAuthState مع Firebase لضمان الاستقرار
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Musaid Rashed", "Chrome", "1.0.0"]
    });

    // حفظ تحديثات الجلسة
    sock.ev.on("creds.update", saveCreds);

    // 3. معالجة الرسائل القادمة
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isImage = !!msg.message.imageMessage;

        try {
            let response;
            if (isImage) {
                //
