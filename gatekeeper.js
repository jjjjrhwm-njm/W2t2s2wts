// gatekeeper.js - النسخة الاحترافية لراشد (تحديث 10 دقائق + الأسماء الحقيقية)
const pendingPermissions = new Map();
const activeSessions = new Map(); // ذاكرة السماح (لمدة 10 دقائق)

class Gatekeeper {
    constructor() {
        this.timeoutLimit = 35000; // 35 ثانية للرد التلقائي
        this.sessionDuration = 10 * 60 * 1000; // 10 دقائق بالملي ثانية
        this.lastRequestJid = null;
    }

    // ميزة حقيقية: جلب الاسم الذي سجلته أنت في جهات اتصالك
    getSavedName(jid, sock) {
        const contact = sock.contacts ? sock.contacts[jid] : null;
        // إذا وجد اسم مسجل عندك (name) استخدمه، وإلا استخدم الاسم الذي وضعه هو لنفسه
        return contact?.name || contact?.verifiedName || null;
    }

    async handleEverything(jid, pushName, text, sock, ownerJid) {
        if (jid === ownerJid || jid.includes('@g.us')) return { status: 'PROCEED' };

        // 1. التحقق من "جلسة العشر دقائق"
        const now = Date.now();
        if (activeSessions.has(jid)) {
            const lastAllowed = activeSessions.get(jid);
            if (now - lastAllowed < this.sessionDuration) {
                return { status: 'PROCEED' }; // مسموح له، لا يطلب إذن مرة أخرى
            } else {
                activeSessions.delete(jid); // انتهت الـ 10 دقائق، اطلب إذن من جديد
            }
        }

        if (pendingPermissions.has(jid)) return { status: 'WAITING' };

        this.lastRequestJid = jid;
        
        // 2. استخدام الاسم المسجل عندك (إذا وجد)
        const savedName = this.getSavedName(jid, sock);
        const displayName = savedName ? `✅ ${savedName} (مسجل عندك)` : `👤 ${pushName} (غير مسجل)`;
        
        const requestMsg = `🔔 *إذن سكرتير (تيك تك)*\n\n` +
                           `📝 الاسم: ${displayName}\n` +
                           `📱 الرقم: ${jid.split('@')[0]}\n` +
                           `💬 الرسالة: "${text}"\n\n` +
                           `*رد بـ (نعم) للقبول، أو (لا) للمنع.*\n` +
                           `⏳ (سأسمح له تلقائياً بعد 35 ثانية إذا لم ترد)`;

        await sock.sendMessage(ownerJid, { text: requestMsg });

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                if (pendingPermissions.has(jid)) {
                    pendingPermissions.delete(jid);
                    activeSessions.set(jid, Date.now()); // ابدأ عداد الـ 10 دقائق
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
                
                if (decision === 'نعم') {
                    activeSessions.set(targetJid, Date.now()); // ابدأ الـ 10 دقائق
                    resolve({ status: 'PROCEED' });
                } else {
                    activeSessions.delete(targetJid); // امسح أي جلسة سابقة
                    resolve({ status: 'STOP' }); // منع حقيقي
                }
                return true;
            }
        }
        return false;
    }
}

module.exports = new Gatekeeper();
