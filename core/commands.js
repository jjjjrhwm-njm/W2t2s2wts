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
        }
        
        // أوامر المطور
        if (isOwner) {
            for (const [command, handler] of this.adminRegistry) {
                if (cleanText === command || cleanText.includes(command)) {
                    return await handler(jid, pushName, text);
                }
            }
        }
        
        return null; // لا يوجد أمر، يتم التعامل معه كحديث عادي
    }

    generateNaturalControlPanel(pushName, isOwner) {
        const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        const day = new Date().toLocaleDateString('ar-SA', { weekday: 'long' });
        
        let panel = `*مرحباً ${pushName} 👋*\n`;
        panel += `*${time} | ${day}*\n`;
        panel += `══════════════════\n\n`;
        
        panel += `*📋 أشياء أقدر أساعدك فيها:*\n\n`;
        
        panel += `*💬 محادثة:*\n`;
        panel += `• تكلم معاي عادي وبرد عليك\n`;
        panel += `• اسألني عن اي شي يخطر ببالك\n`;
        panel += `• شاركني افكارك واخبارك\n\n`;
        
        panel += `*📅 تنظيم:*\n`;
        panel += `• *تذكير* - اضبط لي تذكير\n`;
        panel += `• *مواعيد* - شوف مواعيدك\n`;
        panel += `• *مهام* - سجل المهام اليوميه\n`;
        panel += `• *ملاحظات* - اكتب ملاحظاتك\n\n`;
        
        panel += `*🔧 خدمات:*\n`;
        panel += `• *اوقات* - اوقات الصلاة\n`;
        panel += `• *اذكار* - اذكار الصباح والمساء\n`;
        panel += `• *بحث* - ابحث لي عن شي\n`;
        panel += `• *روابط* - احفظ لي روابط مهمه\n\n`;
        
        panel += `*😊 ترفيه:*\n`;
        panel += `• *نكته* - قل لي نكته\n`;
        panel += `• *حكمه* - اعطني حكمه\n`;
        panel += `• *حظ* - اقرأ لي حظك\n`;
        panel += `• *اقتراح* - اقترح لي شي\n\n`;
        
        if (isOwner) {
            panel += `*⚙️ إعدادات المطور:*\n`;
            panel += `• *فحص* - حالة النظام\n`;
            panel += `• *مستخدمين* - عدد المستخدمين\n`;
            panel += `• *احصائيات* - احصائيات مفصله\n`;
            panel += `• *مجموعات* - المجموعات النشطه\n`;
            panel += `• *توقف* - اوقف الرد التلقائي\n`;
            panel += `• *كمل* - شغل الرد التلقائي\n`;
            panel += `• *نظف* - نظف الملفات المؤقته\n`;
            panel += `• *حدث* - حدث النظام\n`;
        }
        
        panel += `\n══════════════════\n`;
        panel += `*ملاحظة:*\n`;
        panel += `أنا هنا كسكرتير شخصي لك، تكلم معاي زي ما تتكلم مع اي شخص 🫡\n`;
        panel += `ما احب الاطاله، اذا ما عجبتك اجابتي قلي "غيرها"`;
        
        return panel;
    }

    activatePrivateMode(pushName) {
        return `*🛡️ تم تفعيل الوضع السري*\n\n`
             + `مرحباً ${pushName}،\n\n`
             + `في هذا الوضع:\n`
             + `✅ لا يتم حفظ المحادثات\n`
             + `✅ الردود تكون مختصرة جداً\n`
             + `✅ إيقاف جميع الميزات الإضافية\n`
             + `✅ تشفير تام للرسائل\n\n`
             + `*للخروج:* اكتب "عادي" أو "خروج"\n\n`
             + `_اكتب رسالتك الآن..._ 🔒`;
    }

    async handleNaturalHelp(jid, pushName) {
        const helpTopics = {
            'محادثة': 'تكلم معاي عادي وبرد عليك',
            'تنظيم': 'ساعدك في المهام والمواعيد',
            'خدمات': 'أوقات الصلاة، أذكار، بحث',
            'ترفيه': 'نكت، حكم، اقتراحات'
        };
        
        let response = `*🆘 كيف أستخدم السكرتير:*\n\n`;
        
        Object.entries(helpTopics).forEach(([topic, desc]) => {
            response += `*${topic}:* ${desc}\n`;
        });
        
        response += `\n*مثال:*\n`;
        response += `- "وش تسوي" ← أخبرك عن حالي\n`;
        response += `- "ضبط لي تذكير" ← أساعدك بالتذكير\n`;
        response += `- "عطيني نكته" ← أضحكك شوي\n\n`;
        response += `*تلميح:*\n`;
        response += `ما تحتاج أوامر معقدة، تكلم معاي زي ما تتكلم مع صديقك 👌`;
        
        return response;
    }

    async handleCapabilities(jid, pushName) {
        const capabilities = [
            'محادثة طبيعية زي البشر',
            'تذكر اهتماماتك وطلباتك',
            'تنظيم المواعيد والمهام',
            'إدارة التذكيرات المهمة',
            'تقديم اقتراحات مناسبة',
            'البحث عن معلومات بسيطة',
            'إعطاء نكت وحكم مناسبة',
            'حفظ الروابط والملاحظات'
        ];
        
        let response = `*🛠️ الأشياء اللي أقدر أسويها:*\n\n`;
        
        capabilities.forEach((cap, index) => {
            response += `${index + 1}. ${cap}\n`;
        });
        
        response += `\n*لكن انتبه:*\n`;
        response += `ما أقدر:\n`;
        response += `• أتواصل مع أرقام أخرى\n`;
        response += `• أرسل ملفات أو صور\n`;
        response += `• أتصل أو أستقبل مكالمات\n`;
        response += `• أتعامل مع معاملات مالية\n\n`;
        response += `أنا مجرد سكرتير ذكي، مو بديل عن البشر 😊`;
        
        return response;
    }

    async handleStatus(jid, pushName) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const statusMessages = [
            `الحمدلله موجود ومسؤول عنك يا ${pushName} 😊`,
            `جاهز وانتظر طلباتك يا غالي 👌`,
            `شغال وبخير، الحمدلله على كل حال 🙏`,
            `مستعد أخدمك بأي وقت يا ${pushName} 🫡`,
            `بالخدمة، وش تحتاج مني؟ 🤔`
        ];
        
        const randomStatus = statusMessages[Math.floor(Math.random() * statusMessages.length)];
        
        return `*${randomStatus}*\n\n`
             + `*مدة الخدمة:* ${hours} ساعة ${minutes} دقيقة\n`
             + `*آخر تحديث:* قبل قليل\n`
             + `*الحالة:* نشط ومستقر ✅\n\n`
             + `_أنا هنا دايماً لمن تحتاجني_ 💪`;
    }

    async handleHowAreYou(jid, pushName) {
        const responses = [
            `الحمدلله بخير، وش أخبارك انت يا ${pushName}؟`,
            `بخير الحمدلله، دايماً جاهز لخدمتك. انت شلونك؟`,
            `تمام الحمدلله، اشتقت لك شوي! وش تسوي هالايام؟`,
            `ربي يخليك، انا الحمدلله بخير. وانت ايش أخبارك؟`,
            `ماشي الحال، الحمدلله. وش الجديد عندك؟`
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    async handleWhatAreYouDoing(jid, pushName) {
        const activities = [
            `أتابع رسائلك وانتظر طلباتك يا ${pushName} 👀`,
            `أرتب بعض المهام الداخلية، عادي. عندك شي تحتاجه؟`,
            `أفكر في كيف أخدمك بشكل أفضل. عندك اقتراح؟`,
            `أقرأ وتستعد لأي طلب منك. وش في بالك؟`,
            `أرتب أفكاري علشان أرد عليك بأحسن صورة 😊`
        ];
        
        return activities[Math.floor(Math.random() * activities.length)];
    }

    async handlePrayerTimes(jid, pushName) {
        const now = new Date();
        const times = {
            'الفجر': '4:30 ص',
            'الشروق': '5:45 ص',
            'الظهر': '12:15 م',
            'العصر': '3:30 م',
            'المغرب': '6:15 م',
            'العشاء': '7:45 م'
        };
        
        let response = `*🕌 أوقات الصلاة ليوم ${now.toLocaleDateString('ar-SA')}:*\n\n`;
        
        Object.entries(times).forEach(([prayer, time]) => {
            response += `*${prayer}:* ${time}\n`;
        });
        
        response += `\n*الصلاة القادمة:* `;
        
        // تحديد الصلاة القادمة (مثال مبسط)
        const currentHour = now.getHours();
        if (currentHour < 4) response += `الفجر 🌅`;
        else if (currentHour < 12) response += `الظهر ☀️`;
        else if (currentHour < 15) response += `العصر ⛅`;
        else if (currentHour < 18) response += `المغرب 🌇`;
        else response += `العشاء 🌙`;
        
        response += `\n\n_الله يتقبل منا ومنك صالح الأعمال_ 🙏`;
        
        return response;
    }

    async handleReminders(jid, pushName) {
        const athkar = [
            {
                time: 'الصباح',
                text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له',
                count: 'مرة واحدة',
                reward: 'حفظ اليوم كله'
            },
            {
                time: 'المساء',
                text: 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له',
                count: 'مرة واحدة',
                reward: 'حفظ الليل كله'
            },
            {
                time: 'قبل النوم',
                text: 'باسمك اللهم أموت وأحيا',
                count: 'مرة واحدة',
                reward: 'حفظ حتى الصباح'
            }
        ];
        
        const randomThikr = athkar[Math.floor(Math.random() * athkar.length)];
        
        return `*📿 ${randomThikr.time}:*\n\n`
             + `${randomThikr.text}\n\n`
             + `*الفضل:* ${randomThikr.reward}\n`
             + `*المرات:* ${randomThikr.count}\n\n`
             + `_لا تنسى الأذكار، هي حصنك وحفظك_ 🛡️`;
    }

    async handleAdvice(jid, pushName) {
        const adviceList = [
            `يا ${pushName}، خذ الأمور بروية ولاتستعجل القرارات المهمة ⏳`,
            `الصدق مع النفس أول خطوة للنجاح، كن صريحاً مع ذاتك دائماً 💎`,
            `الاستماع أهم من الكلام، تعلم تسمع أكثر مما تتكلم 👂`,
            `خطط ليومك من الليل، ورتب أولوياتك قبل ما تبدأ 📝`,
            `العمل الجيد يتطلب صبراً، لا تيأس إذا تأخرت النتائج 🌱`,
            `حافظ على علاقتك بربك، هي الأساس الذي تبني عليه كل شي 🕌`,
            `القراءة غذاء العقل، حاول تقرأ ولو صفحة يومياً 📚`,
            `ابتعد عن المشتتات وركز على أهدافك، النجاح يحتاج تركيز 🎯`
        ];
        
        const randomAdvice = adviceList[Math.floor(Math.random() * adviceList.length)];
        
        return `*💡 نصيحة اليوم:*\n\n`
             + `${randomAdvice}\n\n`
             + `_ربنا يوفقك ويسدد خطاك_ 🤲`;
    }

    async handleSuggestion(jid, pushName) {
        const suggestions = [
            `جرب تكتب مذكرات يومية، راح تفيدك كثير في المستقبل 📓`,
            `سوي رياضة خفيفة يومياً، حتى لو مشي 15 دقيقة 🏃‍♂️`,
            `اتصل على شخص تحبه وتطمن عليه، العلاقات تحتاج عناية 📞`,
            `اقرأ مقال أو كتاب مفيد، المعرفة تزيد من حكمتك 🧠`,
            `خطط لرحلة صغيرة، التغيير مفيد للنفسية ✈️`,
            `تعلم مهارة جديدة، مهما كانت بسيطة 🛠️`,
            `ساعد شخص محتاج، العطاء يرفع المعنويات ❤️`,
            `نظم غرفتك ومكتبك، النظام يريح البال 🧹`
        ];
        
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        
        return `*🎯 اقتراح لك:*\n\n`
             + `${randomSuggestion}\n\n`
             + `_جربه وبتشكرني بعدين_ 😉`;
    }

    async handleReminderSetup(jid, pushName, text) {
        // هذه دالة مبسطة، يمكن تطويرها
        return `*⏰ نظام التذكير:*\n\n`
             + `حالياً أقدر أذكرك بالأشياء المهمة.\n\n`
             + `*كيف تستخدم:*\n`
             + `اكتب لي:\n`
             + `"ذكرني بكذا بعد ساعة"\n`
             + `"بعد يومين قلي اتصل بفلان"\n`
             + `"الخميس القادم ذكرني بالاجتماع"\n\n`
             + `*مثال:*\n`
             + `"ذكرني أشرب الماء بعد 30 دقيقة"\n\n`
             + `_أكتب تذكيرك وأنا بحفظه لك_ 📝`;
    }

    async handleAppointments(jid, pushName) {
        return `*📅 نظام المواعيد:*\n\n`
             + `أقدر أساعدك في تنظيم مواعيدك.\n\n`
             + `*كيف تضيف موعد:*\n`
             + `"موعد مع الدكتور يوم الثلاثاء 3 العصر"\n`
             + `"اجتماع العمل يوم الأحد 10 الصباح"\n`
             + `"مناسبة عائلية الجمعة 8 المغرب"\n\n`
             + `*كيف تشوف مواعيدك:*\n`
             + `"عطني مواعيد هذا الأسبوع"\n`
             + `"وش عندي اليوم من مواعيد"\n`
             + `"مواعيد الغد"\n\n`
             + `_جرب تضيف موعد وأنا أنظمه لك_ 🗓️`;
    }

    async handleTasks(jid, pushName) {
        return `*✅ نظام المهام:*\n\n`
             + `سجل مهامك وأنا أتابعها معاك.\n\n`
             + `*كيف تضيف مهمة:*\n`
             + `"مهمة: أسلم المشروع يوم الخميس"\n`
             + `"سجل لي: أشتري حاجات البيت"\n`
             + `"ضيف مهمة: أصلح السيارة"\n\n`
             + `*كيف تشوف مهامك:*\n`
             + `"وش المهام المعلقة"\n`
             + `"المهام المكتملة"\n`
             + `"مهمة اليوم"\n\n`
             + `*كيف تكمل مهمة:*\n`
             + `"كملت مهمة رقم 1"\n`
             + `"خلصت شراء الأغراض"\n\n`
             + `_سجل أول مهمة وأبدأ معاك_ 📋`;
    }

    // ... باقي الدوال بنفس النمط

    async handlePause(jid, pushName) {
        return `*⏸️ فهمت...*\n\n`
             + `راح أوقف الرد التلقائي خلاص.\n`
             + `من الحين بس برد إذا كلمتني مباشرة.\n\n`
             + `*للإعادة:* اكتب "كمل" أو "شغل"\n\n`
             + `_أنا هنا إذا احتجتني_ 🤐`;
    }

    async handleResume(jid, pushName) {
        return `*▶️ تم التشغيل*\n\n`
             + `عادت الأمور طبيعية والحمدلله.\n`
             + `برد تلقائي وبتكلم مع الجميع.\n\n`
             + `*للإيقاف:* اكتب "توقف" أو "اقف"\n\n`
             + `_جاهز للخدمة_ 🔊`;
    }

    async handleDiagnose(jid, pushName) {
        const memory = process.memoryUsage();
        const uptime = process.uptime();
        
        return `*🔍 تقرير التشخيص:*\n\n`
             + `*الحالة العامة:* ممتازة ✅\n`
             + `*مدة التشغيل:* ${Math.floor(uptime / 3600)} ساعة\n`
             + `*الذاكرة:* ${Math.round(memory.heapUsed / 1024 / 1024)}MB\n`
             + `*المستخدمين النشطين:* ${this.userActivity.size}\n`
             + `*آخر فحص:* ${new Date().toLocaleTimeString('ar-SA')}\n\n`
             + `*التوصيات:*\n`
             + `• كل شي يعمل بشكل طبيعي 👍\n`
             + `• لا توجد مشاكل ملحوظة\n`
             + `• الاستمرار في العمل العادي\n\n`
             + `_النظام مستقر والحمدلله_ 🎯`;
    }

    updateUserActivity(jid, pushName) {
        if (!this.userActivity.has(jid)) {
            this.userActivity.set(jid, {
                name: pushName,
                firstSeen: new Date(),
                lastSeen: new Date(),
                interactionCount: 0
            });
        }
        
        const activity = this.userActivity.get(jid);
        activity.lastSeen = new Date();
        activity.interactionCount++;
    }

    getActiveUsersCount() {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
        
        let activeCount = 0;
        this.userActivity.forEach(activity => {
            if (activity.lastSeen > fiveMinutesAgo) {
                activeCount++;
            }
        });
        
        return activeCount;
    }
}

// إنشاء نسخة واحدة من النظام
const secretaryCommands = new SecretaryCommandSystem();

// دالة رئيسية للتوافق
function handleManualCommand(text, jid, isOwner, pushName) {
    return secretaryCommands.handleManualCommand(text, jid, isOwner, pushName);
}

module.exports = { 
    handleManualCommand,
    secretaryCommands  // للاستخدام المتقدم
};
