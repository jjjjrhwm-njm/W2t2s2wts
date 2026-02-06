const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const chatHistory = {};

async function getAIResponse(jid, text, pushName) {
    if (!chatHistory[jid]) chatHistory[jid] = [];

    // نظام الهوية المتطور: البوت الآن يعرف من يكلمه
    let persona = `أنت ذكاء اصطناعي خارق ومساعد شخصي متطور. اسم المستخدم الذي تحادثه الآن هو (${pushName}). 
    رد بأسلوب ذكي، بشري، ومختصر. إذا سألك من أنت، قل أنا مساعدك الذكي الخاص. 
    تحدث باللهجة التي يكلمك بها المستخدم (سواء بيضاء أو يمنية أو عامة).`;

    const systemPrompt = `${persona} ردي بالعربية فقط. ممنوع التكرار الممل.`;

    try {
        chatHistory[jid].push({ role: "user", content: text });
        if (chatHistory[jid].length > 15) chatHistory[jid].shift();

        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }, ...chatHistory[jid]],
            model: "llama-3.3-70b-versatile",
        });

        const aiMsg = completion.choices[0].message.content;
        chatHistory[jid].push({ role: "assistant", content: aiMsg });
        return aiMsg;
    } catch (e) {
        // البديل في حال تعطل Groq
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-preview-01-21" });
        const result = await model.generateContent(systemPrompt + "\nالمستخدم " + pushName + " يقول: " + text);
        return result.response.text();
    }
}

module.exports = { getAIResponse };
