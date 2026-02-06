const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const chatHistory = {};

async function getAIResponse(jid, text, isImage, buffer, senderName) {
    if (!chatHistory[jid]) chatHistory[jid] = [];

    let persona = `أنتِ "مساعدة راشد"، خبيرة وذكية. الشخص اللي يكلمك اسمه (${senderName}).`;
    if (jid.includes("967783015253")) persona += " هذا والد راشد، ردي بكل توقير.";
    if (jid.includes("967782203551") || jid.includes("966599741982")) persona += " هذه زوجة راشد، ردي بلطف.";
    if (jid.includes("966554526287")) persona += " هذا راشد المالك، نفذي أوامره فوراً.";

    const systemPrompt = `${persona} أسلوبك عفوي بلهجة سعودية بيضاء. ممنوع ذكر أنك ذكاء اصطناعي.`;

    if (isImage && buffer) {
        // تحديث الموديل بناءً على صورتك الأخيرة
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const result = await model.generateContent([
            systemPrompt,
            { inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } },
            text || "وش في الصورة؟"
        ]);
        return result.response.text();
    }

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
