require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } = require("@whiskeysockets/baileys");
const pino = require("pino");
const admin = require("firebase-admin");
const express = require("express");
const { getAIResponse } = require("./core/ai");
const { handleManualCommand } = require("./core/commands");
const { isSpamming } = require("./utils/antiSpam");

// إعداد Firebase
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CONFIG)) });
}
const db = admin.firestore();

const app = express();
app.get("/", (req, res) => res.send("البوت شغال زي اللوز! 🚀"));
app.listen(process.env.PORT || 3000);

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    
    // منطق حفظ الجلسة في Firebase (مستند session_rashed_ultra)
    const sessionDoc = db.collection("sessions").doc("session_rashed_ultra");
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: makeCacheableSignalKeyStore({}, pino({ level: "silent" })) // ملاحظة: يفضل استخدام MultiFileAuthState محلياً أو ربطها بـ Firebase بالكامل
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = jid.includes("966554526287");

        // 1. فحص الأوامر اليدوية
        const manualResponse = handleManualCommand(text, jid, isOwner);
        if (manualResponse) return sock.sendMessage(jid, { text: manualResponse });

        // 2. حماية من السبام
        if (isSpamming(jid)) return;

        // 3. معالجة الصور والنصوص عبر الذكاء الاصطناعي
        try {
            const isImage = !!msg.message.imageMessage;
            let response;

            if (isImage) {
                // منطق تحميل الصورة وتحويلها لـ Buffer
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                response = await getAIResponse(jid, text, true, buffer);
            } else {
                response = await getAIResponse(jid, text);
            }

            await sock.sendMessage(jid, { text: response });
        } catch (e) {
            console.error("خطأ في معالجة الرسالة:", e);
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
        console.log("حالة الاتصال:", connection);
    });
}

startBot();
