// gatekeeper.js - النسخة النهائية المصححة مع سحب الأسماء من جهات الاتصال
const pendingPermissions = new Map();
const activeSessions = new Map();

class Gatekeeper {
    constructor() {
        this.timeoutLimit = 35000;
        this.sessionDuration = 10 * 60 * 1000;
        this.lastRequestJid = null;
        this.sock = null;
        this.ownerJid = null;
        this.contactsCache = new Map();
    }

    // تهيئة الـ Gatekeeper عند بدء البوت
    initialize(sock, ownerJid) {
        this.sock = sock;
        this.ownerJid = ownerJid;
        console.log('✅ Gatekeeper جاهز للعمل');
        
        // تحديث كاش جهات الاتصال عند التهيئة
        this.updateContactsCache();
    }

    // تحديث كاش جهات الاتصال
    updateContactsCache() {
        if (!this.sock) return;
        
        try {
            if (this.sock.contacts) {
                for (const [jid, contact] of Object.entries(this.sock.contacts)) {
                    if (contact && contact.name) {
                        this.contactsCache.set(jid, contact.name);
                    }
                }
                console.log(`✅ تم تحديث كاش جهات الاتصال: ${this.contactsCache.size} جهة اتصال`);
            }
        } catch (error) {
            console.error('❌ خطأ في تحديث كاش الجهات:', error);
        }
    }

    // دالة محسنة لجلب الاسم من جهات الاتصال
    async getContactName(jid) {
        try {
            if (!jid) return null;
            
            // 1. التحقق من الكاش أولاً
            if (this.contactsCache.has(jid)) {
                return this.contactsCache.get(jid).trim();
            }
            
            // 2. المحاولة مع دالة الاتصال الخاصة بالبوت
            if (this.sock && typeof this.sock.getContact === 'function') {
                try {
                    const contact = await this.sock.getContact(jid);
                    if (contact && contact.name) {
                        const name = contact.name.trim();
                        if (name) {
                            this.contactsCache.set(jid, name);
                            return name;
                        }
                    }
                } catch (error) {
                    console.log('⚠️ استخدام الطريقة البديلة لجلب الاسم');
                }
            }
            
            // 3. المحاولة من خلال جهات الاتصال المباشرة
            if (this.sock && this.sock.contacts) {
                const contact = this.sock.contacts[jid];
                if (contact && contact.name) {
                    const name = contact.name.trim();
                    if (name) {
                        this.contactsCache.set(jid, name);
                        return name;
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('❌ خطأ في جلب الاسم:', error);
            return null;
        }
    }

    async handleEverything(jid, pushName, text) {
        if (jid === this.ownerJid || jid.includes('@g.us')) {
            return { status: 'PROCEED' };
        }

        const now = Date.now();
        if (activeSessions.has(jid)) {
            const sessionData = activeSessions.get(jid);
            if (now - sessionData.timestamp < this.sessionDuration) {
                return { status: 'PROCEED' };
            } else {
                activeSessions.delete(jid);
            }
        }

        if (pendingPermissions.has(jid)) {
            return { status: 'WAITING' };
        }

        this.lastRequestJid = jid;
        
        const savedName = await this.getContactName(jid);
        const displayName = savedName ? savedName : pushName || jid.split('@')[0];
        const nameStatus = savedName ? '✅ مسجل في جهات الاتصال' : '⚠️ غير مسجل';
        
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

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                if (pendingPermissions.has(jid)) {
                    pendingPermissions.delete(jid);
                    activeSessions.set(jid, { 
                        timestamp: Date.now(),
                        autoApproved: true,
                        userName: displayName
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
        
        const isYes = ['نعم', 'yes', 'y', '✅', '✔', '👍', 'موافق', 'قبول', 'ok', 'okay', 'اوك', 'ن', 'yeah', 'yea'].includes(decision);
        const isNo = ['لا', 'no', 'n', '❌', '✖', '👎', 'رفض', 'منع', 'مرفوض', 'block', 'ل', 'nope', 'nah'].includes(decision);
        
        if ((isYes || isNo) && this.lastRequestJid) {
            const targetJid = this.lastRequestJid;
            
            if (pendingPermissions.has(targetJid)) {
                const { resolve, timer, displayName } = pendingPermissions.get(targetJid);
                clearTimeout(timer);
                pendingPermissions.delete(targetJid);
                
                if (isYes) {
                    activeSessions.set(targetJid, { 
                        timestamp: Date.now(),
                        approvedBy: this.ownerJid,
                        userName: displayName
                    });
                    
                    this.sock.sendMessage(this.ownerJid, { 
                        text: `✅ *تم السماح*\n\n👤 ${displayName}\n📱 ${targetJid.split('@')[0]}\n⏰ لمدة 10 دقائق` 
                    }).catch(() => {});
                    
                    resolve({ status: 'PROCEED', ownerApproved: true });
                } else {
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
    
    async getNameForResponse(jid, pushName) {
        const savedName = await this.getContactName(jid);
        return savedName ? savedName : pushName || 'صديقي';
    }
}

const gatekeeper = new Gatekeeper();
module.exports = gatekeeper;
