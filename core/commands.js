const fs = require('fs');
const path = require('path');
const os = require('os');

// نظام متقدم لإدارة الأوامر
class SecretaryCommandSystem {
    constructor() {
        this.commandRegistry = new Map();
        this.adminRegistry = new Map();
        this.userActivity = new Map();
        this.conversationState = new Map();
        this.initializeNaturalCommands();
    }

    initializeNaturalCommands() {
        // أوامر طبيعية تبدو كمحادثة عادية
        this.registerNaturalCommands();
        this.registerAdminCommands();
    }

    registerNaturalCommands() {
        // الأوامر الأساسية (تظهر كردود طبيعية)
        this.commandRegistry.set('الاوامر', this.handleNaturalHelp.bind(this));
        this.commandRegistry.set('مساعدة', this.handleNaturalHelp.bind(this));
        this.commandRegistry.set('وش تقدر', this.handleCapabilities.bind(this));
        this.commandRegistry.set('وينك', this.handleStatus.bind(this));
        this.commandRegistry.set('شلونك', this.handleHowAreYou.bind(this));
        this.commandRegistry.set('وش تسوي', this.handleWhatAreYouDoing.bind(this));
        this.commandRegistry.set('اوقات', this.handlePrayerTimes.bind(this));
        this.commandRegistry.set('اذكار', this.handleReminders.bind(this));
        this.commandRegistry.set('نصيحه', this.handleAdvice.bind(this));
        this.commandRegistry.set('اقتراح', this.handleSuggestion.bind(this));
        this.commandRegistry.set('تذكير', this.handleReminderSetup.bind(this));
        this.commandRegistry.set('مواعيد', this.handleAppointments.bind(this));
        this.commandRegistry.set('مهام', this.handleTasks.bind(this));
        this.commandRegistry.set('ملاحظات', this.handleNotes.bind(this));
        this.commandRegistry.set('روابط', this.handleLinks.bind(this));
        this.commandRegistry.set('بحث', this.handleSearch.bind(this));
        this.commandRegistry.set('حظ', this.handleFortune.bind(this));
        this.commandRegistry.set('نكته', this.handleJoke.bind(this));
        this.commandRegistry.set('حكمه', this.handleWisdom.bind(this));
    }

    registerAdminCommands() {
        // أوامر المطور (تتطلب صلاحيات)
        this.adminRegistry.set('توقف', this.handlePause.bind(this));
        this.adminRegistry.set('كمل', this.handleResume.bind(this));
        this.adminRegistry.set('شغل', this.handleStart.bind(this));
        this.adminRegistry.set('نظف', this.handleClean.bind(this));
        this.adminRegistry.set('فحص', this.handleDiagnose.bind(this));
        this.adminRegistry.set('نسخ', this.handleBackup.bind(this));
        this.adminRegistry.set('مستخدمين', this.handleUsers.bind(this));
        this.adminRegistry.set('احصائيات', this.handleStats.bind(this));
        this.adminRegistry.set('مجموعات', this.handleGroups.bind(this));
        this.adminRegistry.set('مسح', this.handleClear.bind(this));
        this.adminRegistry.set('حدث', this.handleUpdate.bind(this));
        this.adminRegistry.set('افحص', this.handleCheck.bind(this));
        this.adminRegistry.set('جلسه', this.handleSession.bind(this));
        this.adminRegistry.set('صلاحيات', this.handlePermissions.bind(this));
        this.adminRegistry.set('لوج', this.handleLog.bind(this));
        this.adminRegistry.set('ريست', this.handleRestart.bind(this));
    }

    async handleManualCommand(text, jid, isOwner, pushName) {
        // تحديث نشاط المستخدم
        this.updateUserActivity(jid, pushName);
        
        const cleanText = text.trim().toLowerCase();
        
        // كلمات السر الخاصة
        if (cleanText === 'نجم1997' || cleanText === 'راشد123') {
            return this.generateNaturalControlPanel(pushName, isOwner);
        }
        
        if (cleanText === 'وضع سري' || cleanText === 'خاص') {
            return this.activatePrivateMode(pushName);
        }
        
        // البحث عن أمر مطابق
        for (const [command, handler] of this.commandRegistry) {
            if (cleanText === command || cleanText.includes(command)) {
                return await handler(jid, pushName, text);
            }
       
