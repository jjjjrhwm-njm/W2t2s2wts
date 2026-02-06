const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const chatHistory = {};

async function getAIResponse(jid, text) {
    if (!chatHistory[jid]) chatHistory[jid] = [];

    // الهويات VIP
    let persona = "أنتِ مساعدة راشد السعودية. أسلوبك عفوي وقصير.";
    if (jid.includes("967783015253")) persona = "أنتِ أمام والد راشد، ردي بمنتهى الأدب والتبجيل.";
    if (jid.includes("967782203551") || jid.includes("966599741982")) persona = "أنتِ تخاطبين زوجة راشد، كوني حنونة ودافئة جداً.";
    if (jid.includes("966554526287")) persona = "أهلاً يا راشد، أنا تحت أمرك.";

    const systemPrompt = `${persona} ردي بالعربية فقط. ممنوع الرومانسية مع الغرباء.`;

    try {
        chatHistory[jid].push({ role: "user", content: text });
        if (chatHistory[jid].length > 10) chatHistory[jid].shift();

        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }, ...chatHistory[jid]],
            model: "llama-3.3-70b-versatile",
        });

        const aiMsg = completion.choices[0].message.content;
        chatHistory[jid].push({ role: "assistant", content: aiMsg });
        return aiMsg;
    } catch (e) {
        // بديل Gemini في حال فشل Groq
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-preview-01-21" });
        const result = await model.generateContent(systemPrompt + "\nالمستخدم: " + text);
        return result.response.text();
    }
}

module.exports = { getAIResponse };
