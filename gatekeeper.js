// gatekeeper.js - النسخة الاحترافية لراشد
const pendingPermissions = new Map();

class Gatekeeper {
    constructor() {
        this.timeoutLimit = 35000; 
        
        // 1. القائمة البيضاء: الأرقام اللي تبي البوت يرد عليها "فوراً" بدون ما يستأذنك
        this.whiteList = [
            '966554526287', // رقمك أنت (المالك)
            '966500000000'  // مثال: رقم خويك (عدله لرقم حقيقي)
        ];

        // 2. القائمة السوداء: أرقام تبي البوت يسحب عليها تماماً ولا يرسل لك حتى تنبيه
        this.blackList = [
            '123456789'
        ];

        this.lastRequestJid = null; 
    }

    // ميزة حقيقية: فحص الرقم قبل أي إجراء
    checkIdentity(jid) {
        const cleanJid = jid.split('@')[0];
        if (this.blackList.includes(cleanJid)) return 'BLACKLISTED';
        if (this.whiteList.includes(cleanJid)) return 'WHITELISTED';
        return 'STRANGER';
    }

    async handleEverything(jid, pushName, text, sock, ownerJid) {
        // إذا كان قروب أو المالك، اسمح فوراً
        if (jid.includes('@g.us') || jid === ownerJid) return { status: 'PROCEED' };

        const identity = this.checkIdentity(jid);

        // إذا محظور: توقف فوراً
        if (identity === 'BLACKLISTED') return { status: 'STOP' };

        // إذا في القائمة البيضاء: رد فوراً (هنا ميزة التعرف على الأصدقاء)
        if (identity === 'WHITELISTED') return { status: 'PROCEED' };

        // إذا في طلب انتظار شغال: انتظر
        if (pendingPermissions.has(jid)) return { status: 'WAITING' };

        this.lastRequestJid = jid; 
        
        const requestMsg = `🔔 *طلب إذن (تيك تك)*\n\n` +
                           `👤 الاسم: ${pushName}\n` +
                           `📱 الرقم: ${jid.split('@')[0]}\n` +
                           `📊 الحالة: ⚠️ رقم غير مضاف للقائمة البيضاء\n` +
                           `💬 الرسالة: "${text}"\n\n` +
                           `*رد بـ (نعم) للرد، أو (لا) للمنع.*\n` +
                           `⏳ سأنتظر 35 ثانية للرد تلقائياً.`;

        await sock.sendMessage(ownerJid, { text: requestMsg });

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                if (pendingPermissions.has(jid)) {
                    pendingPermissions.delete(jid);
                    resolve({ status: 'PROCEED' }); 
                }
            }, this.timeoutLimit);

            pendingPermissions.set(jid, { resolve, timer });
        });
    }

    handleOwnerDecision(text) {
        const decision = text.trim();
        if ((decision === 'نعم' || decision === 'لا') && this.lastRequestJid) {
            const targetJid = this.lastRequestJid;
            if (pendingPermissions.has(targetJid)) {
                const { resolve, timer } = pendingPermissions.get(targetJid);
                clearTimeout(timer);
                pendingPermissions.delete(targetJid);
                this.lastRequestJid = null;
                
                // هنا الفرق الحقيقي: لو قلت لا، الحالة STOP ولن يرد البوت أبداً
                resolve({ status: decision === 'نعم' ? 'PROCEED' : 'STOP' });
                return true;
            }
        }
        return false;
    }
}

module.exports = new Gatekeeper();
