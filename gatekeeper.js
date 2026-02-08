// gatekeeper.js - النسخة النهائية مع نظام كامل لجهات الاتصال
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
        
        // تحميل جهات الاتصال المحفوظة عند التهيئة
        this.loadCachedContacts();
    }

    // إنشاء مجلد البيانات إذا لم يكن موجوداً
    async ensureDataDir() {
        const dataDir = path.join(__dirname, '../data');
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
            console.error('❌ خطأ في إنشاء مجلد البيانات:', error);
        }
    }

    // تحميل جهات الاتصال المحفوظة
    async loadCachedContacts() {
        try {
            await this.ensureDataDir();
            
            if (fs.existsSync(this.contactsFile)) {
                const data = await fs.readFile(this.contactsFile, 'utf8');
                const contacts = JSON.parse(data);
                
                for (const [jid, contactData] of Object.entries(contacts)) {
                    this.contactsCache.set(jid, contactData.name);
                    this.contactProfiles.set(jid, {
                        name: contactData.name,
                        savedAt: contactData.savedAt,
                        lastSeen: contactData.lastSeen || Date.now(),
                        messageCount: contactData.messageCount || 0,
                        firstSeen: contactData.firstSeen || Date.now()
                    });
                }
                console.log(`✅ تم تحميل ${this.contactsCache.size} جهة اتصال من الذاكرة`);
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل جهات الاتصال:', error);
        }
    }

    // حفظ جهات الاتصال في الملف
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
            console.log(`✅ تم حفظ ${Object.keys(contactsData).length} جهة اتصال في الذاكرة`);
        } catch (error) {
            console.error('❌ خطأ في حفظ جهات الاتصال:', error);
        }
    }

    // تهيئة الـ Gatekeeper عند بدء البوت
    initialize(sock, ownerJid) {
        this.sock = sock;
        this.ownerJid = ownerJid;
        this.isInitialized = true;
        console.log('✅ Gatekeeper جاهز للعمل');
        
        // تحديث كاش جهات الاتصال عند التهيئة
        this.updateContactsCache();
        
        // حفظ جهات الاتصال كل 5 دقائق
        setInterval(() => this.saveContactsToCache(), 5 * 60 * 1000);
    }

    // تحديث كاش جهات الاتصال بشكل شامل
    async updateContactsCache() {
        if (!this.sock || !this.isInitialized) return;
        
        try {
            let contactsUpdated = 0;
            const allContacts = [];
            
            // طريقة 1: استخدام دالة getAllContacts إذا كانت موجودة
            if (typeof this.sock.getAllContacts === 'function') {
                try {
                    const contacts = await this.sock.getAllContacts();
                    if (contacts && Array.isArray(contacts)) {
                        allContacts.push(...contacts);
                    }
                } catch (error) {
                    console.log('⚠️ استخدام الطريقة البديلة لجلب الجهات');
                }
            }
            
            // طريقة 2: استخدام contacts object مباشرة
            if (this.sock.contacts) {
                Object.entries(this.sock.contacts).forEach(([jid, contact]) => {
                    if (contact && contact.name) {
                        allContacts.push({
                            id: jid,
                            name: contact.name
                        });
                    }
                });
            }
            
            // معالجة جميع الجهات
            for (const contact of allContacts) {
                if (contact && contact.id && contact.name && contact.name.trim()) {
                    const jid = contact.id;
                    const name = contact.name.trim();
                    
                    if (!this.contactsCache.has(jid)) {
                        this.contactsCache.set(jid, name);
                        this.updateContactProfile(jid, name);
                        contactsUpdated++;
                    } else if (this.contactsCache.get(jid) !== name) {
                        // تحديث الاسم إذا تغير
                        this.contactsCache.set(jid, name);
                        this.updateContactProfile(jid, name);
                        contactsUpdated++;
                    }
                }
            }
            
            if (contactsUpdated > 0) {
                console.log(`✅ تم تحديث ${contactsUpdated} جهة اتصال جديدة`);
                await this.saveContactsToCache();
            }
            
        } catch (error) {
            console.error('❌ خطأ في تحديث كاش الجهات:', error);
        }
    }

    // تحديث بروفايل جهة الاتصال
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

    // دالة محسنة لجلب الاسم من جهات الاتصال
    async getContactName(jid) {
        if (!jid) return null;
        
        const cleanJid = jid.split(':')[0]; // تنظيف الجيد من الإضافات
        
        try {
            // 1. التحقق من الكاش المحلي أولاً
            if (this.contactsCache.has(cleanJid)) {
                const cachedName = this.contactsCache.get(cleanJid);
                if (cachedName && cachedName.trim()) {
                    return cachedName.trim();
                }
            }
            
            // 2. محاولة جلب الاسم من واتساب إذا كان البوت متصلاً
            if (this.sock && this.isInitialized) {
                let contactName = null;
                
                // المحاولة مع دالة getContact
                if (typeof this.sock.getContact === 'function') {
                    try {
                        const contact = await this.sock.getContact(cleanJid);
                        if (contact && contact.name && contact.name.trim()) {
                            contactName = contact.name.trim();
                        }
                    } catch (error) {
                        // تجاهل الخطأ والمحاولة بالطريقة الأخرى
                    }
                }
                
                // البحث في كائن contacts المباشر
                if (!contactName && this.sock.contacts) {
                    const contact = this.sock.contacts[cleanJid];
                    if (contact && contact.name && contact.name.trim()) {
                        contactName = contact.name.trim();
                    }
                }
                
                // إذا وجدنا الاسم، نحدث الكاش
                if (contactName) {
                    this.contactsCache.set(cleanJid, contactName);
                    this.updateContactProfile(cleanJid, contactName);
                    
                    // حفظ في الملف بعد فترة
                    setTimeout(() => this.saveContactsToCache(), 1000);
                    
                    return contactName;
                }
            }
            
            return null;
        } catch (error) {
            console.error('❌ خطأ في جلب الاسم:', error);
            return null;
        }
    }

    // البحث عن جهة اتصال بالاسم أو الرقم
    async searchContact(searchTerm) {
        const results = [];
        const searchLower = searchTerm.toLowerCase();
        
        // البحث في الكاش المحلي
        this.contactsCache.forEach((name, jid) => {
            if (name.toLowerCase().includes(searchLower) || 
                jid.includes(searchTerm.replace(/[^0-9]/g, ''))) {
                results.push({
                    jid: jid,
                    name: name,
                    phone: jid.split('@')[0],
                    profile: this.contactProfiles.get(jid)
                });
            }
        });
        
        return results;
    }

    // الحصول على إحصائيات جهات الاتصال
    getContactsStats() {
        const totalContacts = this.contactsCache.size;
        const activeContacts = Array.from(this.contactProfiles.values())
            .filter(p => Date.now() - p.lastSeen < 7 * 24 * 60 * 60 * 1000)
            .length;
        
        return {
            totalContacts: totalContacts,
            activeContacts: activeContacts,
            recentlyUpdated: Math.min(10, totalContacts)
        };
    }

    async handleEverything(jid, pushName, text) {
        if (jid === this.ownerJid || jid.includes('@g.us')) {
            return { status: 'PROCEED' };
        }

        const now = Date.now();
        if (activeSessions.has(jid)) {
            const sessionData = activeSessions.get(jid);
            if (now - sessionData.timestamp < this.sessionDuration) {
                // تحديث آخر ظهور للمستخدم
                this.updateContactProfile(jid, sessionData.displayName);
                return { status: 'PROCEED' };
            } else {
                activeSessions.delete(jid);
            }
        }

        if (pendingPermissions.has(jid)) {
            return { status: 'WAITING' };
        }

        this.lastRequestJid = jid;
        
        // جلب الاسم من جهات الاتصال أولاً
        const savedName = await this.getContactName(jid);
        const displayName = savedName ? savedName : pushName || jid.split('@')[0];
        const nameStatus = savedName ? '✅ مسجل في جهات الاتصال' : '⚠️ غير مسجل';
        
        // تحديث بروفايل المستخدم
        this.updateContactProfile(jid, displayName);
        
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
        // البحث أولاً في جهات الاتصال المحفوظة
        const savedName = await this.getContactName(jid);
        
        if (savedName) {
            // تحديث آخر ظهور
            this.updateContactProfile(jid, savedName);
            return savedName;
        }
        
        // إذا لم يكن مسجلاً، استخدام الاسم من الرسالة
        return pushName || 'صديقي';
    }
    
    // الحصول على قائمة بجميع جهات الاتصال
    getAllContacts() {
        const contactsList = [];
        
        this.contactsCache.forEach((name, jid) => {
            const profile = this.contactProfiles.get(jid) || {};
            contactsList.push({
                jid: jid,
                name: name,
                phone: jid.split('@')[0],
                lastSeen: new Date(profile.lastSeen || Date.now()).toLocaleString('ar-SA'),
                messageCount: profile.messageCount || 0,
                firstSeen: profile.firstSeen ? new Date(profile.firstSeen).toLocaleDateString('ar-SA') : 'غير معروف'
            });
        });
        
        // ترتيب حسب آخر ظهور
        return contactsList.sort((a, b) => {
            const timeA = this.contactProfiles.get(a.jid)?.lastSeen || 0;
            const timeB = this.contactProfiles.get(b.jid)?.lastSeen || 0;
            return timeB - timeA;
        });
    }
}

const gatekeeper = new Gatekeeper();
module.exports = gatekeeper;
