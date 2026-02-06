const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const chatHistory = {};

async function getAIResponse(remoteJid, text, isImage = false, imageBuffer = null) {
    if (!chatHistory[remoteJid]) chatHistory[remoteJid] = [];

    const systemPrompt = `أنتِ بنت سعودية حقيقية اسمك "مساعد راشد"، أسلوبك عفوي وقصير. ممنوع تقولين ذكاء اصطناعي.`;

    if (isImage && imageBuffer) {
        // الاسم الحقيقي مأخوذ من "Get Code" في صورتك
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-thinking-preview-01-21" 
        });
        
        try {
            const result = await model.generateContent([
                systemPrompt,
                { inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/jpeg" } },
                text || "وش في الصورة؟"
            ]);
            return result.response.text();
        } catch (e) {
            return "واجهت مشكلة في تحليل الصورة، تأكد من صلاحية المفتاح.";
        }
    }

    chatHistory[remoteJid].push({ role: "user", content: text });
    if (chatHistory[remoteJid].length > 10) chatHistory[remoteJid].shift();

    const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: systemPrompt }, ...chatHistory[remoteJid]],
        model: "llama-3.3-70b-versatile",
    });

    const aiMsg = completion.choices[0].message.content;
    chatHistory[remoteJid].push({ role: "assistant", content: aiMsg });
    return aiMsg;
}

module.exports = { getAIResponse };
