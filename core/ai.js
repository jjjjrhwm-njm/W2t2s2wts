async function getAIResponse(jid, text, pushName) {
    if (!chatHistory[jid]) chatHistory[jid] = [];

    // تعريف الهوية "البشرية" الصارم
    let persona = `أنت مساعد "راشد" الشخصي (صديقه المقرب).
    - اسمك "السيستم VIP".
    - ردودك: قصيرة جداً (لا تزيد عن سطرين)، عفوية، بلهجة يمنية/سعودية بيضاء.
    - إذا سألك أحد عن "راشد": قل هو صاحبي ومطوري، وهو مشغول الآن وأنا أنوب عنه.
    - ممنوع تقول "أنا ذكاء اصطناعي" أو "كيف يمكنني مساعدتك اليوم".
    - تعامل مع (${pushName}) وكأنك تعرفه منذ زمن.`;

    const systemPrompt = `${persona} \nملاحظة: رد بالعربي فقط، وبدون رسميات.`;

    try {
        chatHistory[jid].push({ role: "user", content: text });
        if (chatHistory[jid].length > 10) chatHistory[jid].shift();

        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }, ...chatHistory[jid]],
            model: "llama-3.3-70b-versatile", // هذا الموديل أسرع وأكثر عفوية
            temperature: 0.8, // لزيادة الروح البشرية في الرد
        });

        return completion.choices[0].message.content;
    } catch (e) {
        // البديل في حال تعطل الخدمة
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-preview-01-21" });
        const result = await model.generateContent(systemPrompt + "\nأجب باختصار وعفوية على: " + text);
        return result.response.text();
    }
}
