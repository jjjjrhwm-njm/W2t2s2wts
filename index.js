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

const app = express();
app.get("/", (req, res) => res.send("البوت يعمل! 🚀"));
app.listen(process.env.PORT || 3000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Musaid Rashed", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isImage = !!msg.message.imageMessage;

        try {
            let response;
            if (isImage) {
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                const caption = msg.message.imageMessage.caption || "";
                response = await getAIResponse(jid, caption, true, buffer);
            } else {
                response = await getAIResponse(jid, text);
            }
            await sock.sendMessage(jid, { text: response });
        } catch (error) {
            console.error("خطأ:", error.message);
        }
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("البوت متصل الآن ✅");
        }
    });
}

startBot();
