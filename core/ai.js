const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const chatHistory = {};

async function getAIResponse(remoteJid, text, persona, imageBuffer = null) {
    if (!chatHistory[remoteJid]) chatHistory[remoteJid] = [];

    // إذا كانت هناك صورة، نستخدم Gemini للرؤية
    if (imageBuffer) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([
            persona + " وش تلاحظ في هذه الصورة؟ رد بلهجة سعودية قصيرة.",
            { inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/jpeg" } }
        ]);
        return result.response.text();
    }

    // للمحادثات النصية نستخدم Groq لسرعته الخارقة
    chatHistory[remoteJid].push({ role: "user", content: text });
    if (chatHistory[remoteJid].length > 10) chatHistory[remoteJid].shift();

    const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: persona }, ...chatHistory[remoteJid]],
        model: "llama-3.3-70b-versatile",
    });

    const aiMsg = completion.choices[0].message.content;
    chatHistory[remoteJid].push({ role: "assistant", content: aiMsg });
    return aiMsg;
}

module.exports = { getAIResponse };
