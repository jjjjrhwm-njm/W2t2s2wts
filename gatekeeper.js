// gatekeeper.js - النسخة المصححة والمطورة (ملف واحد كامل)
const pendingPermissions = new Map();
const activeSessions = new Map();

class Gatekeeper {
    constructor() {
        this.timeoutLimit = 35000;
        this.sessionDuration = 10 * 60 * 1000;
        this.lastRequestJid = null;
        this.sock = null; // سنخزن كائن sock هنا
        this.ownerJid = null; // سنخزن JID المالك هنا
    }

    // تهيئة الـ Gatekeeper عند بدء البوت
    initialize(sock, ownerJid) {
        this.sock = sock;
        this.ownerJid = ownerJid;
        console.log('✅ Gatekeeper جاهز للعمل');
    }

    // دالة محسنة لجلب الاسم من جهات الاتصال
    async getSavedName(jid) {
        try {
            if (!this.sock) return null;
            
            // المحاولة الأولى: من خلال دالة getContactById
            if (this.sock.getContactById) {
                try {
                    const contact = await this.sock.getContactById(jid);
                    if (contact?.name?.trim()) return contact.name.trim();
                    if (contact?.notify?.trim()) return contact.notify.trim();
                    if (contact?.verifiedName?.trim()) return contact.verifiedName.trim();
                } catch (error) {
                    console.log('⚠️ استخدام الطريقة الثانية لجلب الاسم');
                }
            }
            
            // المحاولة الثانية: من مخزن جهات الاتصال
            if (this.sock.contacts && this.sock.contacts[jid]) {
                const contact = this.sock.contacts[jid];
                if (contact?.name?.trim()) return contact.name.trim();
                if (contact?.notify?.trim()) return contact.notify.trim();
                if (contact?.verifiedName?.trim()) return contact.verifiedName.trim();
            }
            
            return null;
        } catch (error) {
            console.error('❌ خطأ في جلب الاسم:', error);
            return null;
        }
    }

    async handleEverything(jid, pushName, text) {
        // تجاهل الرسائل من المالك أو المجموعات
        if (jid === this.ownerJid || jid.includes('@g.us')) {
            return { status: 'PROCEED' };
        }

        // التحقق من الجلسة النشطة
        const now = Date.now();
        if (activeSessions.has(jid)) {
            const sessionData = activeSessions.get(jid);
            if (now - sessionData.timestamp < this.sessionDuration) {
                return { status: 'PROCEED' };
            } else {
                activeSessions.delete(jid);
            }
        }

        // إذا كان هناك طلب معلق بالفعل
        if (pendingPermissions.has(jid)) {
            return { status: 'WAITING' };
        }

        // حفظ الطلب الحالي
        this.lastRequestJid = jid;
        
        // جلب الاسم الحقيقي
        const savedName = await this.getSavedName(jid);
        const displayName = savedName ? savedName : pushName || jid.split('@')[0];
        const nameStatus = savedName ? '✅ مسجل في جهات الاتصال' : '⚠️ غير مسجل';
        
        // إرسال طلب الإذن للمالك
        const requestMsg = `🔔 *طلب إذن وصول*\n\n` +
                         `👤 *الاسم:* ${displayName}\n` +
                         `📊 *الحالة:* ${nameStatus}\n` +
                         `📱 *الرقم:* ${jid.split('@')[0]}\n` +
                         `💬 *الرسالة:* "${text.length > 100 ? text.substring(0, 100) + '...' : text}"\n\n` +
                         `⏰ *المدة:* 10 دقائق بعد الموافقة\n\n` +
                         `✅ *نعم* - للسماح\n` +
                         `❌ *لا* - للمنع\n` +
                         `⏳ (تلقائي بعد 35 ثانية)`;

        await this.sock.sendMessage(this.ownerJid, { text: requestMsg });

        // انتظار القرار
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                if (pendingPermissions.has(jid)) {
                    pendingPermissions.delete(jid);
                    // السماح تلقائياً
                    activeSessions.set(jid, { 
                        timestamp: Date.now(),
                        autoApproved: true 
                    });
                    resolve({ status: 'PROCEED', autoApproved: true });
                }
            }, this.timeoutLimit);

            pendingPermissions.set(jid, { 
                resolve, 
                timer,
                displayName 
            });
        });
    }

    // معالجة قرار المالك
    handleOwnerDecision(text) {
        const decision = text.trim().toLowerCase();
        
        // التحقق من جميع أشكال "نعم"
        const isYes = ['نعم', 'yes', 'y', '✅', '✔', '👍', 'موافق', 'قبول', 'ok', 'okay', 'اوك', 'ن', 'yeah', 'yea'].includes(decision);
        // التحقق من جميع أشكال "لا"
        const isNo = ['لا', 'no', 'n', '❌', '✖', '👎', 'رفض', 'منع', 'مرفوض', 'block', 'ل', 'nope', 'nah'].includes(decision);
        
        if ((isYes || isNo) && this.lastRequestJid) {
            const targetJid = this.lastRequestJid;
            
            if (pendingPermissions.has(targetJid)) {
                const { resolve, timer, displayName } = pendingPermissions.get(targetJid);
                clearTimeout(timer);
                pendingPermissions.delete(targetJid);
                
                if (isYes) {
                    // السماح
                    activeSessions.set(targetJid, { 
                        timestamp: Date.now(),
                        approvedBy: this.ownerJid,
                        userName: displayName
                    });
                    
                    // إرسال تأكيد للمالك
                    this.sock.sendMessage(this.ownerJid, { 
                        text: `✅ *تم السماح*\n\n👤 ${displayName}\n📱 ${targetJid.split('@')[0]}\n⏰ لمدة 10 دقائق` 
                    }).catch(() => {});
                    
                    resolve({ status: 'PROCEED', ownerApproved: true });
                } else {
                    // منع
                    this.sock.sendMessage(this.ownerJid, { 
                        text: `❌ *تم المنع*\n\n👤 ${displayName}\n📱 ${targetJid.split('@')[0]}\n\nلن يتمكن من إرسال رسائل.` 
                    }).catch(() => {});
                    
                    resolve({ status: 'STOP', ownerDenied: true });
                }
                
                this.lastRequestJid = null;
                return true;
            }
        }
        
        return false;
    }
    
    // دالة مساعدة للتحقق
    getSessionInfo(jid) {
        if (activeSessions.has(jid)) {
            const session = activeSessions.get(jid);
            const remaining = this.sessionDuration - (Date.now() - session.timestamp);
            return {
                active: true,
                remaining: Math.max(0, Math.round(remaining / 1000)),
                userName: session.userName
            };
        }
        return { active: false };
    }
}

// إنشاء نسخة واحدة فقط من Gatekeeper
const gatekeeper = new Gatekeeper();
module.exports = gatekeeper;
