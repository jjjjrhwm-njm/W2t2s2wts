const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { getAIResponse } = require("./core/ai");
const { handleManualCommand } = require("./core/commands");
const { isSpamming } = require("./utils/antiSpam");
const express = require("express");
require("dotenv").config();

// أرقام العائلة
const OWNER = "966554526287@s.whatsapp.net";
const WIFE1 = "967782203551@s.whatsapp.net";
const WIFE2 = "966599741982@s.whatsapp.net";
const FATHER = "967783015253@s.whatsapp.net";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session_data');
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (isSpamming(jid)) return;

        // تحديد الشخصية (Persona)
        let persona = "أنت مساعد راشد، تكلم بأدب وهدوء.";
        if (jid === WIFE1 || jid === WIFE2) persona = "أنت زوج حنون، كلامك مليء بالحب والتقدير بلهجة سعودية.";
        if (jid === FATHER) persona = "أنت ابن بار، تكلم بمنتهى الأدب والاحترام (يا بوي، أبشر، سم).";
        if (jid === OWNER) persona = "أنت المساعد الشخصي لراشد، نفذ أوامره فوراً.";

        // الأوامر اليدوية
        const cmdReply = handleManualCommand(text, jid, jid === OWNER);
        if (cmdReply) return await sock.sendMessage(jid, { text: cmdReply });

        // رد الذكاء الاصطناعي
        try {
            const aiReply = await getAIResponse(jid, text, persona);
            await sock.sendMessage(jid, { text: aiReply });
        } catch (e) { console.error("Error:", e); }
    });

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'close') startBot();
        if (u.connection === 'open') console.log("✅ البوت شغال يا راشد!");
    });
}

const app = express();
app.get('/', (req, res) => res.send("البوت جاهز للعمل!"));
app.listen(process.env.PORT || 10000, () => startBot());
