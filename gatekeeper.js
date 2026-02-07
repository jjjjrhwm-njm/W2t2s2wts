// gatekeeper.js
const pendingPermissions = new Map();

class Gatekeeper {
    constructor() {
        this.timeoutLimit = 35000; // 35 ثانية
    }

    // 1. التعرف على جهات الاتصال
    getContactName(jid, sock) {
        const contact = sock.contacts ? sock.contacts[jid] : null;
        return (contact && (contact.name || contact.verifiedName)) || null;
    }

    // 2. الميزة الرئيسية: طلب الإذن والانتظار (Gatekeeper Logic)
    async handleEverything(jid, pushName, text, sock, ownerJid) {
        // إذا كان المرسل هو المالك، اسمح له فوراً
        if (jid === ownerJid) return { status: 'PROCEED' };

        // إذا كان هناك طلب معلق بالفعل لنفس الشخص، انتظر
        if (pendingPermissions.has(jid)) return { status: 'WAITING' };

        const contactName = this.getContactName(jid, sock);
        const status = contactName ? `✅ صديق مسجل (${contactName})` : "⚠️ رقم غريب";
        
        const requestMsg = `🔔 *تنبيه سكرتيرك الذكي*\n\n` +
                           `👤 المرسل: ${pushName}\n` +
                           `📱 الحالة: ${status}\n` +
                           `💬 الرسالة: "${text}"\n\n` +
                           `*هل أرد عليه؟* (نعم / لا)\n` +
                           `⏳ سأنتظر 35 ثانية قبل الرد تلقائياً.`;

        await sock.sendMessage(ownerJid, { text: requestMsg });

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                if (pendingPermissions.has(jid)) {
                    pendingPermissions.delete(jid);
                    resolve({ status: 'PROCEED' }); // الرد تلقائياً بعد الوقت
                }
            }, this.timeoutLimit);

            pendingPermissions.set(jid, { resolve, timer });
        });
    }

    // 3. معالجة ردك الشخصي (نعم/لا)
    handleOwnerDecision(text) {
        const decision = text.trim();
        if (decision === 'نعم' || decision === 'لا') {
            const lastJid = Array.from(pendingPermissions.keys()).pop(); 
            if (lastJid) {
                const { resolve, timer } = pendingPermissions.get(lastJid);
                clearTimeout(timer);
                pendingPermissions.delete(lastJid);
                resolve({ status: decision === 'نعم' ? 'PROCEED' : 'STOP' });
                return true;
            }
        }
        return false;
    }
}

module.exports = new Gatekeeper();
