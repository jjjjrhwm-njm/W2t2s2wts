require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState, 
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const { getAIResponse } = require("./core/ai");

// 1. تشغيل سيرفر بسيط لمنع ريندر من إغلاق البوت
const app = express();
app.get("/", (req, res) => res.send("البوت شغال بنجاح! 🚀"));
app.listen(process.env.PORT || 3000);

async function startBot() {
    // إعداد الجلسة (تأكد من وجود مجلد auth_info أو سيتم إنشاؤه)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Musaid Rashed", "Chrome", "1.0.0"]
    });

    // حفظ بيانات الجلسة
    sock.ev.on("creds.update", saveCreds);

    // 2. معالجة الرسائل (الصور والنصوص)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isImage = !!msg.message.imageMessage;

        try {
            let response;
            if (isImage) {
                // تحميل الصورة وإرسالها لـ Gemini
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                const caption = msg.message.imageMessage.caption || "";
                response = await getAIResponse(jid, caption, true, buffer);
            } else {
                // معالجة النص عبر Groq
                response = await getAIResponse(jid, text);
            }
            // إرسال الرد
            await sock.sendMessage(jid, { text: response });
        } catch (error) {
            console.error("خطأ في المعالجة:", error.message);
        }
    });

    // 3. إدارة الاتصال
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("تم الاتصال بنجاح! ✅");
        }
    });
}

// تشغيل البوت
startBot();
