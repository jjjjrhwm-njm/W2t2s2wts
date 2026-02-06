const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const chatHistory = {};

async function getAIResponse(remoteJid, text, persona) {
    if (!chatHistory[remoteJid]) chatHistory[remoteJid] = [];
    
    const systemPrompt = `
    أنت إنسان سعودي حقيقي، اسمك مساعد راشد.
    أسلوبك: واتساب، رسايل قصيرة، لهجة سعودية بيضاء.
    ممنوع تقول "أنا ذكاء اصطناعي".
    ${persona}
    `;

    chatHistory[remoteJid].push({ role: "user", content: text });
    if (chatHistory[remoteJid].length > 8) chatHistory[remoteJid].shift();

    const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: systemPrompt }, ...chatHistory[remoteJid]],
        model: "llama-3.3-70b-versatile",
    });

    const aiMsg = completion.choices[0].message.content;
    chatHistory[remoteJid].push({ role: "assistant", content: aiMsg });
    return aiMsg;
}

module.exports = { getAIResponse };
