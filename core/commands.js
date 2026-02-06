function handleManualCommand(text, jid, isOwner) {
    const cmd = text.trim();
    if (cmd === "حاله") return "أبشرك، البوت شغال وعال العال 🚀";
    if (cmd === "الوقت") return `الساعة الآن: ${new Date().toLocaleString("ar-SA")}`;
    if (isOwner && cmd === "توقف") return "تم إيقاف الرد الآلي.. سم آمرني.";
    return null;
}
module.exports = { handleManualCommand };
