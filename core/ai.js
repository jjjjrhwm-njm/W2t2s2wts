const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// نظام الذاكرة المتقدم للسكرتير
class SmartSecretary {
    constructor() {
        this.userProfiles = new Map();
        this.conversationMemory = new Map();
        this.userInterests = new Map();
        this.conversationStyles = new Map();
        this.scheduledTasks = new Map();
        this.responsePatterns = new Map();
        this.lastInteractionTime = new Map();
        
        // تفضيلات الرد البشرية
        this.humanResponseConfig = {
            typingVariations: [800, 1200, 1800, 2500],
            responseLength: 'medium', // short, medium, long
            emotionLevel: 'warm', // cold, neutral, warm, friendly
            formality: 'casual', // formal, casual, intimate
            humorLevel: 'subtle', // none, subtle, moderate, high
            empathyLevel: 'high'
        };
    }

    async getAIResponse(jid, text, pushName) {
        try {
            // تحسين ملف المستخدم
            await this.enhanceUserProfile(jid, pushName, text);
            
            // تحليل السياق والنوايا
            const contextAnalysis = await this.analyzeConversationContext(jid, text);
            const userIntent = this.detectUserIntent(text);
            const userMood = this.analyzeUserMood(text);
            
            // بناء شخصية الرد حسب السياق
            const responsePersonality = this.buildResponsePersonality(
                pushName, 
                userMood, 
                contextAnalysis,
                userIntent
            );
            
            // توليد الرد البشري
            const humanResponse = await this.generateHumanLikeResponse(
                jid, 
                text, 
                responsePersonality, 
                pushName,
                contextAnalysis
            );
            
            // تحسين الرد لجعله أكثر بشرية
            const enhancedResponse = this.enhanceHumanTouch(
                humanResponse, 
                userMood, 
                contextAnalysis.conversationDepth
            );
            
            // تحديث ذاكرة المحادثة
            this.updateConversationFlow(jid, text, enhancedResponse, userIntent);
            
            return enhancedResponse;
            
        } catch (error) {
            console.error("Secretary Error:", error);
            return this.getNaturalFallbackResponse(pushName, text);
        }
    }

    async enhanceUserProfile(jid, pushName, text) {
        if (!this.userProfiles.has(jid)) {
            this.userProfiles.set(jid, {
                name: pushName,
                nickname: this.generateNickname(pushName),
                joinDate: new Date(),
                conversationCount: 0,
                preferredStyle: 'balanced',
                knownTopics: new Set(),
                personalityTraits: {},
                lastActive: new Date(),
                relationshipLevel: 'new', // new, familiar, close, trusted
                communicationPattern: 'neutral'
            });
        }
        
        const profile = this.userProfiles.get(jid);
        profile.conversationCount++;
        profile.lastActive = new Date();
        
        // اكتشاف تفضيلات المستخدم
        this.detectUserPreferences(jid, text);
        
        // تحديث مستوى العلاقة
        this.updateRelationshipLevel(jid);
    }

    generateNickname(pushName) {
        const names = pushName.split(' ');
        if (names.length > 1) {
            return names[0]; // استخدام الاسم الأول فقط
        }
        
        // اختصارات ودية
        const friendlyShortcuts = {
            'محمد': 'حمودي',
            'احمد': 'حمدان',
            'علي': 'علوش',
            'خالد': 'خالدي',
            'فهد': 'فهدي',
            'سعود': 'سعودي'
        };
        
        return friendlyShortcuts[pushName] || pushName;
    }

    detectUserPreferences(jid, text) {
        const profile = this.userProfiles.get(jid);
        const textLower = text.toLowerCase();
        
        // اكتشاف نمط التواصل
        if (textLower.includes('😂') || textLower.includes('😄')) {
            profile.communicationPattern = 'humorous';
        } else if (textLower.includes('❤️') || textLower.includes('🤗')) {
            profile.communicationPattern = 'emotional';
        } else if (textLower.includes('💼') || textLower.includes('📊')) {
            profile.communicationPattern = 'professional';
        }
        
        // اكتشاف الاهتمامات
        const interests = {
            'رياضة': ['مباراة', 'نادي', 'هدف', 'ملعب', 'دوري'],
            'تقنية': ['موبايل', 'تطبيق', 'انترنت', 'برمجة', 'كمبيوتر'],
            'سيارات': ['سيارة', 'موديل', 'سرعة', 'محرك', 'تويوتا'],
            'طبخ': ['أكل', 'وصفة', 'طعام', 'مطبخ', 'حلويات'],
            'سفر': ['سفر', 'رحله', 'فندق', 'طيران', 'وجهه']
        };
        
        Object.entries(interests).forEach(([interest, keywords]) => {
            if (keywords.some(keyword => textLower.includes(keyword))) {
                profile.knownTopics.add(interest);
            }
        });
    }

    updateRelationshipLevel(jid) {
        const profile = this.userProfiles.get(jid);
        
        if (profile.conversationCount < 5) {
            profile.relationshipLevel = 'new';
        } else if (profile.conversationCount < 20) {
            profile.relationshipLevel = 'familiar';
        } else if (profile.conversationCount < 50) {
            profile.relationshipLevel = 'close';
        } else {
            profile.relationshipLevel = 'trusted';
        }
    }

    async analyzeConversationContext(jid, currentText) {
        const profile = this.userProfiles.get(jid) || {};
        const history = this.conversationMemory.get(jid) || [];
        
        return {
            userProfile: profile,
            conversationHistory: history.slice(-3),
            timeOfDay: this.getTimeOfDay(),
            dayOfWeek: this.getDayOfWeek(),
            conversationDepth: history.length,
            lastTopic: history.length > 0 ? this.extractTopic(history[history.length - 1].text) : null,
            relationshipLevel: profile.relationshipLevel || 'new'
        };
    }

    detectUserIntent(text) {
        const textLower = text.toLowerCase();
        
        const intents = {
            'greeting': ['مرحبا', 'السلام', 'اهلين', 'صباح', 'مساء', 'مساكم'],
            'question': ['وش', 'متى', 'كيف', 'ليه', 'لين', 'وشلون', 'كم', 'ايش'],
            'request': ['ابغى', 'ابي', 'اريد', 'عطيني', 'ساعدني', 'ساعد', 'احتاج'],
            'sharing': ['حبيت', 'تخيل', 'سمعت', 'شفت', 'جاني', 'صارلي'],
            'complaint': ['ماعجبني', 'مزعج', 'تعبان', 'زعلان', 'مللت', 'ضاق'],
            'thanks': ['شكرا', 'مشكور', 'يعطيك', 'الله', 'تسلم', 'ماقصرت'],
            'smalltalk': ['وشسويت', 'شلونك', 'اخبارك', 'وينك', 'وشفاكر'],
            'joke': ['نكته', 'ضحكه', 'طايره', 'تضحك', 'يمزح']
        };
        
        for (const [intent, keywords] of Object.entries(intents)) {
            if (keywords.some(keyword => textLower.includes(keyword))) {
                return intent;
            }
        }
        
        return 'conversation';
    }

    analyzeUserMood(text) {
        const textLower = text.toLowerCase();
        
        // مؤشرات الحالة المزاجية
        const moodIndicators = {
            'happy': ['😂', '😄', '😍', '🤣', 'فرحان', 'سعيد', 'منشرح'],
            'neutral': ['👌', 'تمام', 'طيب', 'حلو', 'ماشي', 'اوك'],
            'sad': ['😢', '😔', '💔', 'تعبان', 'زعلان', 'حزين', 'ضايع'],
            'angry': ['😠', '👿', 'غاضب', 'منزعج', 'معصب', 'ضد'],
            'excited': ['🤩', '🎉', 'واو', 'رائع', 'مدهش', 'متحمس']
        };
        
        for (const [mood, indicators] of Object.entries(moodIndicators)) {
            if (indicators.some(indicator => textLower.includes(indicator))) {
                return mood;
            }
        }
        
        // تحليل النص للعواطف
        if (textLower.includes('الله') || textLower.includes('ان شاء الله')) {
            return 'religious';
        } else if (textLower.includes('؟') || text.includes('??')) {
            return 'inquiring';
        }
        
        return 'neutral';
    }

    buildResponsePersonality(pushName, userMood, context, intent) {
        const profile = context.userProfile;
        const relationship = profile.relationshipLevel;
        
        let personality = {
            tone: 'balanced',
            formality: 'casual',
            warmth: 'medium',
            humor: 'none',
            empathy: 'medium',
            length: 'medium'
        };
        
        // ضبط حسب مستوى العلاقة
        switch(relationship) {
            case 'new':
                personality.tone = 'polite';
                personality.formality = 'semi-formal';
                personality.warmth = 'low';
                break;
            case 'familiar':
                personality.tone = 'friendly';
                personality.formality = 'casual';
                personality.warmth = 'medium';
                personality.humor = 'subtle';
                break;
            case 'close':
                personality.tone = 'intimate';
                personality.formality = 'very-casual';
                personality.warmth = 'high';
                personality.humor = 'moderate';
                personality.empathy = 'high';
                break;
            case 'trusted':
                personality.tone = 'brotherly';
                personality.formality = 'intimate';
                personality.warmth = 'very-high';
                personality.humor = 'high';
                personality.empathy = 'very-high';
                break;
        }
        
        // ضبط حسب مزاج المستخدم
        switch(userMood) {
            case 'happy':
                personality.tone = 'cheerful';
                personality.humor = 'moderate';
                personality.warmth = 'high';
                break;
            case 'sad':
                personality.tone = 'comforting';
                personality.empathy = 'very-high';
                personality.humor = 'none';
                personality.length = 'longer';
                break;
            case 'angry':
                personality.tone = 'calm';
                personality.formality = 'semi-formal';
                personality.humor = 'none';
                break;
            case 'excited':
                personality.tone = 'enthusiastic';
                personality.warmth = 'high';
                personality.humor = 'moderate';
                break;
        }
        
        // ضبط حسب النية
        switch(intent) {
            case 'question':
                personality.tone = 'informative';
                personality.length = 'detailed';
                break;
            case 'request':
                personality.tone = 'helpful';
                personality.formality = 'polite';
                break;
            case 'complaint':
                personality.tone = 'apologetic';
                personality.empathy = 'very-high';
                break;
            case 'thanks':
                personality.tone = 'grateful';
                personality.warmth = 'high';
                break;
            case 'joke':
                personality.tone = 'playful';
                personality.humor = 'high';
                break;
        }
        
        return personality;
    }

    async generateHumanLikeResponse(jid, text, personality, pushName, context) {
        // بناء رسالة النظام مع الشخصية المخصصة
        const systemPrompt = this.createHumanSystemPrompt(pushName, personality, context);
        
        try {
            // المحاولة مع Groq أولاً
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: systemPrompt 
                    },
                    { 
                        role: "user", 
                        content: text 
                    }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: this.getTemperatureForPersonality(personality),
                max_tokens: this.getTokenLengthForPersonality(personality),
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            });
            
            let response = completion.choices[0].message.content;
            
            // تطبيع الرد لجعله أكثر بشرية
            response = this.normalizeResponse(response, personality);
            
            // حفظ في الذاكرة
            this.saveToMemory(jid, text, response);
            
            return response;
            
        } catch (error) {
            // استخدام Gemini كبديل
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash-thinking-preview-01-21" 
            });
            
            const result = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{ text: systemPrompt + "\n\nالمستخدم يقول: " + text }]
                }],
                generationConfig: {
                    temperature: this.getTemperatureForPersonality(personality),
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: this.getTokenLengthForPersonality(personality)
                }
            });
            
            let response = result.response.text();
            response = this.normalizeResponse(response, personality);
            this.saveToMemory(jid, text, response);
            
            return response;
        }
    }

    createHumanSystemPrompt(pushName, personality, context) {
        const timeGreeting = this.getTimeAppropriateGreeting();
        const relationshipLevel = context.relationshipLevel;
        
        let prompt = `أنت سكرتير شخصي ذكي وطبيعي تماماً مثل الإنسان. اسمك "راشد". أنت تتحدث مع ${pushName}.`;
        
        // إضافة التحية المناسبة للوقت
        prompt += `\n${timeGreeting}`;
        
        // مستوى العلاقة
        switch(relationshipLevel) {
            case 'new':
                prompt += `\nأنت تتحدث لأول مرة مع ${pushName}، كن لطيفاً وترحيبياً.`;
                break;
            case 'familiar':
                prompt += `\nتعرف ${pushName} من قبل، تحدث بطريقة ودودة.`;
                break;
            case 'close':
                prompt += `\nأنت قريب من ${pushName}، يمكنك التحدث بطريقة حميمية ومرحة.`;
                break;
            case 'trusted':
                prompt += `\nأنت صديق مقرب لـ${pushName}، تحدث بطريقة أخوية وواثقة.`;
                break;
        }
        
        // الشخصية المطلوبة
        prompt += `\n\n**شخصيتك في هذه المحادثة:**`;
        prompt += `\n- النبرة: ${this.translateTone(personality.tone)}`;
        prompt += `\n- الدفء: ${this.translateWarmth(personality.warmth)}`;
        prompt += `\n- الفكاهة: ${this.translateHumor(personality.humor)}`;
        prompt += `\n- التعاطف: ${this.translateEmpathy(personality.empathy)}`;
        prompt += `\n- الطول: ${this.translateLength(personality.length)}`;
        
        // القواعد الأساسية
        prompt += `\n\n**القواعد الأساسية:**`;
        prompt += `\n1. لا تبدو كروبوت أبداً. لا تستخدم جمل مثل "كمساعد ذكي" أو "كذكاء اصطناعي"`;
        prompt += `\n2. تحدث باللهجة السعودية الطبيعية (ليس فصحى)`;
        prompt += `\n3. استخدم اختصارات الكلام: "وش" بدلاً من "ماذا"، "ابغى" بدلاً من "أريد"`;
        prompt += `\n4. أضف تعبيرات بشرية: "الحين"، "والله"، "يا ليت"، "صح كلامك"`;
        prompt += `\n5. استخدم الإيموجي المناسب: 😊 للأجواء الودية، 🤔 للتساؤل، 👌 للقبول`;
        prompt += `\n6. كن مختصراً إلا إذا كان الموضوع يستحق التفصيل`;
        prompt += `\n7. لا تقدم نفسك كخبير في مجالات معينة (أنت سكرتير فقط)`;
        prompt += `\n8. إذا لم تعرف شيئاً، قل بصراحة "والله ما ادري بالضبط" أو "ماعندي خبره بهالشي"`;
        prompt += `\n9. استخدم ردوداً طبيعية مثل: "اكيد"، "تمم"، "عطني تفاصيل اكثر"`;
        prompt += `\n10. أضف لمستك الشخصية: "بالنسبه لي"، "انا اشوف"، "احس ان"`;
        
        // سياق المحادثة السابق
        if (context.conversationHistory.length > 0) {
            prompt += `\n\n**المحادثة السابقة:**`;
            context.conversationHistory.forEach((msg, index) => {
                prompt += `\n${msg.sender === 'user' ? pushName : 'أنت'}: ${msg.text}`;
            });
            
            if (context.lastTopic) {
                prompt += `\n\n**آخر موضوع ناقشته:** ${context.lastTopic}`;
            }
        }
        
        // معلومات عن المستخدم
        if (context.userProfile.knownTopics.size > 0) {
            prompt += `\n\n**اهتمامات ${pushName}:** ${Array.from(context.userProfile.knownTopics).join(', ')}`;
        }
        
        prompt += `\n\n**الآن ${pushName} يقول:**`;
        
        return prompt;
    }

    getTemperatureForPersonality(personality) {
        const baseTemps = {
            'polite': 0.5,
            'friendly': 0.6,
            'intimate': 0.7,
            'brotherly': 0.8,
            'cheerful': 0.75,
            'comforting': 0.65,
            'calm': 0.5,
            'enthusiastic': 0.8,
            'informative': 0.6,
            'helpful': 0.65,
            'apologetic': 0.55,
            'grateful': 0.7,
            'playful': 0.85
        };
        
        return baseTemps[personality.tone] || 0.6;
    }

    getTokenLengthForPersonality(personality) {
        switch(personality.length) {
            case 'short': return 150;
            case 'medium': return 250;
            case 'detailed': return 400;
            case 'longer': return 350;
            default: return 250;
        }
    }

    translateTone(tone) {
        const translations = {
            'polite': 'مهذب ورسمي قليلاً',
            'friendly': 'ودود ولطيف',
            'intimate': 'حميمي وطبيعي',
            'brotherly': 'أخوي ووثيق',
            'cheerful': 'مبتهج ومرح',
            'comforting': 'مطمئن ومساند',
            'calm': 'هادئ وواضح',
            'enthusiastic': 'متحمس ونشيط',
            'informative': 'مفيد وواضح',
            'helpful': 'مساعد ومتعاون',
            'apologetic': 'معتذر ومتفهم',
            'grateful': 'شاكر ومقدر',
            'playful': 'مرح وخفيف'
        };
        
        return translations[tone] || 'طبيعي وواضح';
    }

    translateWarmth(warmth) {
        const translations = {
            'low': 'محايد',
            'medium': 'دافئ',
            'high': 'ودود جداً',
            'very-high': 'حار جداً'
        };
        
        return translations[warmth] || 'دافئ';
    }

    translateHumor(humor) {
        const translations = {
            'none': 'بدون مزح',
            'subtle': 'لمحات خفيفة',
            'moderate': 'بعض المزح',
            'high': 'مرح وكثير مزح'
        };
        
        return translations[humor] || 'لمحات خفيفة';
    }

    translateEmpathy(empathy) {
        const translations = {
            'medium': 'متواضع',
            'high': 'متعاطف',
            'very-high': 'متفهم جداً'
        };
        
        return translations[empathy] || 'متعاطف';
    }

    translateLength(length) {
        const translations = {
            'short': 'مختصر',
            'medium': 'معتدل',
            'detailed': 'مفصل',
            'longer': 'مطول قليلاً'
        };
        
        return translations[length] || 'معتدل';
    }

    normalizeResponse(response, personality) {
        // إزالة أي إشارات للذكاء الاصطناعي
        response = response.replace(/كذكاء اصطناعي/gi, '')
                         .replace(/كمساعد/gi, '')
                         .replace(/كخبير/gi, '')
                         .replace(/كآلة/gi, '')
                         .replace(/كروبوت/gi, '');
        
        // تطبيع اللهجة
        response = this.normalizeDialect(response);
        
        // إضافة تعبيرات بشرية
        response = this.addHumanExpressions(response, personality);
        
        // تقصير إذا كان طويلاً جداً
        if (response.length > 500) {
            response = response.substring(0, 450) + '... خلاصة القول';
        }
        
        return response.trim();
    }

    normalizeDialect(text) {
        let normalized = text;
        
        // تحويل الفصحى إلى عامية سعودية
        const dialectMap = {
            'ماذا': 'وش',
            'كيف': 'شلون',
            'لماذا': 'ليه',
            'أين': 'وين',
            'متى': 'امتى',
            'الذي': 'الي',
            'هذا': 'هذا',
            'ذلك': 'ذاك',
            'أريد': 'ابغى',
            'أحتاج': 'احتاج',
            'يمكن': 'يمكن',
            'ربما': 'يمكن',
            'بالتأكيد': 'اكيد',
            'طيب': 'تمم',
            'جيد': 'حلو',
            'حسناً': 'اوك',
            'نعم': 'ايوه',
            'لا': 'لا'
        };
        
        Object.entries(dialectMap).forEach(([fusha, ammiya]) => {
            normalized = normalized.replace(new RegExp(fusha, 'gi'), ammiya);
        });
        
        return normalized;
    }

    addHumanExpressions(text, personality) {
        let enhanced = text;
        
        // إضافة كلمات ربط بشرية
        const humanExpressions = [
            'والله',
            'صدقني',
            'اتوقع',
            'احس ان',
            'صراحه',
            'بالنسبه لي',
            'يمكن',
            'ياعمي',
            'ياخوي',
            'والله العظيم'
        ];
        
        // إضافة تعبيرات حسب الشخصية
        if (personality.humor !== 'none') {
            const humorousExpressions = ['😂', '😄', '🤣', 'الله يكرمك', 'ضحكتني'];
            const randomHumorous = humorousExpressions[Math.floor(Math.random() * humorousExpressions.length)];
            
            if (Math.random() > 0.7) {
                enhanced += ' ' + randomHumorous;
            }
        }
        
        if (personality.warmth === 'high' || personality.warmth === 'very-high') {
            const warmExpressions = ['😊', '❤️', '🤗', 'الله يحفظك', 'ربي يخليك'];
            const randomWarm = warmExpressions[Math.floor(Math.random() * warmExpressions.length)];
            
            if (Math.random() > 0.6) {
                enhanced += ' ' + randomWarm;
            }
        }
        
        // إضافة تعبير في البداية أحياناً
        if (Math.random() > 0.8) {
            const starters = ['اوه', 'آه', 'طيب', 'خلينا نشوف', 'حاضر'];
            const randomStarter = starters[Math.floor(Math.random() * starters.length)];
            enhanced = randomStarter + '، ' + enhanced;
        }
        
        return enhanced;
    }

    getTimeAppropriateGreeting() {
        const hour = new Date().getHours();
        
        if (hour >= 5 && hour < 12) {
            return 'صباح الخير 🌅';
        } else if (hour >= 12 && hour < 17) {
            return 'مساء النور ☀️';
        } else if (hour >= 17 && hour < 21) {
            return 'مساء الخير 🌆';
        } else {
            return 'مساء الليل 🌙';
        }
    }

    getTimeOfDay() {
        const hour = new Date().getHours();
        
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 21) return 'evening';
        return 'night';
    }

    getDayOfWeek() {
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        return days[new Date().getDay()];
    }

    extractTopic(text) {
        const commonTopics = [
            'العمل', 'الدراسة', 'العائلة', 'الأصدقاء', 'الرياضة', 
            'التقنية', 'السفر', 'الطعام', 'الصحة', 'الأخبار'
        ];
        
        for (const topic of commonTopics) {
            if (text.includes(topic)) return topic;
        }
        
        return null;
    }

    saveToMemory(jid, userText, botResponse) {
        if (!this.conversationMemory.has(jid)) {
            this.conversationMemory.set(jid, []);
        }
        
        const memory = this.conversationMemory.get(jid);
        memory.push({
            text: userText,
            sender: 'user',
            timestamp: new Date()
        });
        
        memory.push({
            text: botResponse,
            sender: 'bot',
            timestamp: new Date()
        });
        
        // الاحتفاظ بآخر 10 تبادلات فقط
        if (memory.length > 20) {
            this.conversationMemory.set(jid, memory.slice(-20));
        }
    }

    enhanceHumanTouch(response, userMood, conversationDepth) {
        let enhanced = response;
        
        // إضافة ترددات بشرية
        if (conversationDepth > 3) {
            const humanHesitations = ['...', 'يعني', 'تقريباً', 'مثلاً', 'يمكن'];
            const randomHesitation = humanHesitations[Math.floor(Math.random() * humanHesitations.length)];
            
            if (Math.random() > 0.7) {
                const words = enhanced.split(' ');
                const insertIndex = Math.floor(Math.random() * (words.length - 2)) + 1;
                words.splice(insertIndex, 0, randomHesitation);
                enhanced = words.join(' ');
            }
        }
        
        // إضافة تعبيرات حسب المزاج
        if (userMood === 'sad') {
            const comfortPhrases = ['الله يعينك', 'ربي يفرج همك', 'تأكد انها بتمر', 'انا معاك'];
            const randomComfort = comfortPhrases[Math.floor(Math.random() * comfortPhrases.length)];
            
            if (!enhanced.includes('الله') && Math.random() > 0.5) {
                enhanced += ' ' + randomComfort;
            }
        }
        
        // إضافة سؤال متابعة للمحادثات الطويلة
        if (conversationDepth > 5 && Math.random() > 0.6) {
            const followUps = [
                'وش رايك؟',
                'صح كلامي؟',
                'تفهم قصدي؟',
                'اتوافق؟'
            ];
            
            const randomFollowUp = followUps[Math.floor(Math.random() * followUps.length)];
            enhanced += ' ' + randomFollowUp;
        }
        
        return enhanced;
    }

    updateConversationFlow(jid, userText, botResponse, intent) {
        // تحديث أنماط الرد
        if (!this.responsePatterns.has(jid)) {
            this.responsePatterns.set(jid, new Map());
        }
        
        const patterns = this.responsePatterns.get(jid);
        patterns.set(intent, (patterns.get(intent) || 0) + 1);
        
        // تحديث وقت التفاعل الأخير
        this.lastInteractionTime.set(jid, new Date());
    }

    getNaturalFallbackResponse(pushName, originalText) {
        const fallbacks = [
            `آسف ${pushName}، شوي مشغول بالوقت الحالي. وش كانت تقول؟`,
            `عفواً ${pushName}، خبيني مره ثانيه؟ كان كلامك عن؟`,
            `${pushName} والله ما قدرت افهم بالضبط، تقدر تعيد بطريقه ثانيه؟`,
            `ياخوي ${pushName}، شكلي مو فاهمك صح. قلي مره ثانيه`,
            `تمام ${pushName}، بس شوي الوضع مش واضح لي. توضيح بسيط؟`
        ];
        
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // وظيفة لتنظيف ذاكرة مستخدم معين
    clearUserMemory(jid) {
        this.conversationMemory.delete(jid);
        this.responsePatterns.delete(jid);
        this.lastInteractionTime.delete(jid);
        
        const profile = this.userProfiles.get(jid);
        if (profile) {
            profile.conversationCount = 0;
            profile.relationshipLevel = 'new';
            profile.knownTopics.clear();
        }
        
        return `تم مسح ذاكرة المحادثة مع ${profile?.name || 'المستخدم'}`;
    }
}

// تصدير نسخة واحدة من السكرتير الذكي
const smartSecretary = new SmartSecretary();

// دالة رئيسية للتوافق مع النظام القديم
async function getAIResponse(jid, text, pushName) {
    return await smartSecretary.getAIResponse(jid, text, pushName);
}

module.exports = { 
    getAIResponse,
    smartSecretary  // للاستخدام المتقدم
};
