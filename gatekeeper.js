// gatekeeper.js - النسخة النهائية المصححة
const fs = require('fs').promises;
const path = require('path');
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
        this.contactProfiles = new Map();
        this.contactsFile = path.join(__dirname, '../data', 'contacts_cache.json');
        this.isInitialized = false;
        
        this.loadCachedContacts();
    }

    async ensureDataDir() {
        const dataDir = path.join(__dirname, '../data');
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
            console.error('خطأ في إنشاء مجلد البيانات:', error);
        }
    }

    async loadCachedContacts() {
        try {
            await this.ensureDataDir();
            
            if (fs.existsSync(this.contactsFile)) {
                const data = await fs.readFile(this.contactsFile, 'utf8');
                const contacts = JSON.parse(data);
                
                for (const [jid, contactData] of Object.entries(contacts)) {
                    if (contactData && contactData.name) {
                        this.contactsCache.set(jid, contactData.name);
                        this.contactProfiles.set(jid, {
                            name: contactData.name,
                            savedAt: contactData.savedAt,
                            lastSeen: contactData.lastSeen || Date.now(),
                            messageCount: contactData.messageCount || 0,
                            firstSeen: contactData.firstSeen || Date.now()
                        });
                    }
                }
                console.log(`تم تحميل ${this.contactsCache.size} جهة اتصال من الذاكرة`);
            }
        } catch (error) {
            console.error('خطأ في تحميل جهات الاتصال:', error);
        }
    }

    async saveContactsToCache() {
        try {
            const contactsData = {};
            
            this.contactsCache.forEach((name, jid) => {
                const profile = this.contactProfiles.get(jid) || {};
                contactsData[jid] = {
                    name: name,
                    savedAt: profile.savedAt || Date.now(),
                    lastSeen: profile.lastSeen || Date.now(),
                    messageCount: profile.messageCount || 0,
                    firstSeen: profile.firstSeen || Date.now()
                };
            });
            
            await fs.writeFile(this.contactsFile, JSON.stringify(contactsData, null, 2));
            console.log(`تم حفظ ${Object.keys(contactsData).length} جهة اتصال في الذاكرة`);
        } catch (error) {
            console.error('خطأ في حفظ جهات الاتصال:', error);
        }
    }

    initialize(sock, ownerJid) {
        this.sock = sock;
        this.ownerJid = ownerJid;
        this.isInitialized = true;
        console.log('Gatekeeper جاهز للعمل');
        
        setInterval(() => this.saveContactsToCache(), 5 * 60 * 1000);
        
        setTimeout(() => {
            this.updateContactsCache();
        }, 10000);
    }

    async updateContactsCache() {
        if (!this.sock || !this.isInitialized) return;
        
        try {
            console.log('جاري تحديث كاش جهات الاتصال...');
            let contactsUpdated = 0;
            
            if (typeof this.sock.contacts === 'object' && this.sock.contacts) {
                const contactsObj = this.sock.contacts;
                
                for (const [jid, contact] of Object.entries(contactsObj)) {
                    if (contact && contact.name && contact.name.trim()) {
                        const name = contact.name.trim();
                        const cleanJid = jid.split(':')[0];
                        
                        if (!this.contactsCache.has(cleanJid)) {
                            this.contactsCache.set(cleanJid, name);
                            this.updateContactProfile(cleanJid, name);
                            contactsUpdated++;
                        }
                    }
                }
            }
            
            if (contactsUpdated > 0) {
                console.log(`تم تحديث ${contactsUpdated} جهة اتصال جديدة`);
                await this.saveContactsToCache();
            } else {
                console.log('لم يتم العثور على جهات اتصال جديدة');
            }
        } catch (error) {
            console.error('خطأ في تحديث كاش الجهات:', error);
        }
    }

    updateContactProfile(jid, name) {
        const now = Date.now();
        const existingProfile = this.contactProfiles.get(jid);
        
        this.contactProfiles.set(jid, {
            name: name,
            savedAt: existingProfile?.savedAt || now,
            lastSeen: now,
            messageCount: (existingProfile?.messageCount || 0) + 1,
            firstSeen: existingProfile?.firstSeen || now,
            lastMessageTime: now
        });
    }

    async getContactName(jid) {
        if (!jid) return null;
        
        const cleanJid = jid.split(':')[0];
        
        if (this.contactsCache.has(cleanJid)) {
            const cachedName = this.contactsCache.get(cleanJid);
            if (cachedName && cachedName.trim()) {
                return cachedName.trim();
            }
        }
        
        if (this.sock && this.sock.contacts) {
            try {
                if (this.sock.contacts[cleanJid] && this.sock.contacts[cleanJid].name) {
                    const name = this.sock.contacts[cleanJid].name.trim();
                    if (name) {
                        this.contactsCache.set(cleanJid, name);
                        this.updateContactProfile(cleanJid, name);
                        return name;
                    }
                }
                
                for (const [contactJid, contact] of Object.entries(this.sock.contacts)) {
                    if (contactJid.includes(cleanJid) && contact && contact.name) {
                        const name = contact.name.trim();
                        if (name) {
                            this.contactsCache.set(cleanJid, name);
                            this.updateContactProfile(cleanJid, name);
                            return name;
                        }
                    }
                }
            } catch (error) {
                console.log('خطأ في البحث المباشر:', error.message);
            }
        }
        
        return null;
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
        
        this.updateContactProfile(jid, displayName);
        
        const requestMsg = `🔔 *طلب إذن وصول*\n\n` +
                         `👤 *الاسم:* ${displayName}\n` +
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
                        userName: displayName,
                        displayName: displayName
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
                        userName: displayName,
                        displayName: displayName
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
                userName: session.userName,
                displayName: session.displayName
            };
        }
        return { active: false };
    }
    
    async getNameForResponse(jid, pushName) {
        const savedName = await this.getContactName(jid);
        
        if (savedName) {
            this.updateContactProfile(jid, savedName);
            return savedName;
        }
        
        return pushName || 'صديقي';
    }
    
    async getMyContactInfo(jid, pushName) {
        try {
            const savedName = await this.getContactName(jid);
            const phone = jid.split('@')[0];
            
            if (savedName) {
                const profile = this.contactProfiles.get(jid) || {};
                return {
                    success: true,
                    name: savedName,
                    phone: phone,
                    isRegistered: true,
                    messageCount: profile.messageCount || 0,
                    firstSeen: profile.firstSeen ? new Date(profile.firstSeen).toLocaleString('ar-SA') : 'غير معروف',
                    lastSeen: profile.lastSeen ? new Date(profile.lastSeen).toLocaleString('ar-SA') : 'غير معروف'
                };
            } else {
                return {
                    success: true,
                    name: pushName,
                    phone: phone,
                    isRegistered: false,
                    messageCount: 0,
                    firstSeen: 'غير معروف',
                    lastSeen: 'غير معروف'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                name: pushName,
                phone: jid.split('@')[0]
            };
        }
    }
}

const gatekeeper = new Gatekeeper();
module.exports = gatekeeper;
