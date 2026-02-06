const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const chatHistory = {}; // ذاكرة لكل محادثة

async function getAIResponse(jid, text, isImage, buffer, senderName) {
    if (!chatHistory[jid]) chatHistory[jid] = [];

    // تحديد الشخصية بناءً على الرقم والاسم
    let roleInfo = `أنتِ "مساعدة راشد"، بنت سعودية ذكية جداً. الشخص اللي يكلمك اسمه (${senderName}).`;
    if (jid.includes("967783015253")) roleInfo += " هذا والد راشد، جاوبي بأقصى درجات الأدب.";
    if (jid.includes("967782203551") || jid.includes("966599741982")) roleInfo += " هذه زوجة راشد، كوني لطيفة جداً معها.";
    if (jid.includes("966554526287")) roleInfo += " هذا راشد المالك، نفذي أوامره فوراً بذكاء.";

    const systemPrompt = `${roleInfo} أسلوبك عفوي، لهجة سعودية، ممنوع تذكرين أنك ذكاء اصطناعي.`;

    if (isImage) {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-preview-01-21" });
        const result = await model.generateContent([
            systemPrompt,
            { inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } },
            text || "وش تشوفين في الصورة؟"
        ]);
        return result.response.text();
    }

    // ذاكرة المحادثة (لحفظ السياق)
    chatHistory[jid].push({ role: "user", content: text });
    if (chatHistory[jid].length > 12) chatHistory[jid].shift();

    const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: systemPrompt }, ...chatHistory[jid]],
        model: "llama-3.3-70b-versatile",
    });

    const aiMsg = completion.choices[0].message.content;
    chatHistory[jid].push({ role: "assistant", content: aiMsg });
    return aiMsg;
}

module.exports = { getAIResponse };
