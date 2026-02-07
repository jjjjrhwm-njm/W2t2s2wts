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
            responseLength: 'short',
            emotionLevel: 'neutral',
            formality: 'professional',
            humorLevel: 'none',
            empathyLevel: 'medium'
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
                relationshipLevel: 'new',
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
            return names[0];
        }
        
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
            'سفر': ['سفر', 'رحله', 'فندق', 'طيران', 'وجهه'],
            'عمل': ['شغل', 'مشروع', 'صفقة', 'تجاره', 'بزنس', 'عمل']
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
            'greeting': ['مرحبا', 'السلام', 'اهلين', 'صباح', 'مساء', 'مساكم', 'هلا', 'هاي'],
            'question': ['وش', 'متى', 'كيف', 'ليه', 'لين', 'وشلون', 'كم', 'ايش', 'وين', 'مين'],
            'request': ['ابغى', 'ابي', 'اريد', 'عطيني', 'ساعدني', 'ساعد', 'احتاج', 'ابغاك', 'ودي'],
            'sharing': ['حبيت', 'تخيل', 'سمعت', 'شفت', 'جاني', 'صارلي', 'عندي', 'عندنا'],
            'complaint': ['ماعجبني', 'مزعج', 'تعبان', 'زعلان', 'مللت', 'ضاق', 'غاضب', 'منزعج'],
            'thanks': ['شكرا', 'مشكور', 'يعطيك', 'الله', 'تسلم', 'ماقصرت', 'الله يسلمك'],
            'smalltalk': ['وشسويت', 'شلونك', 'اخبارك', 'وينك', 'وشفاكر', 'ايش تسوي', 'شغلك'],
            'joke': ['نكته', 'ضحكه', 'طايره', 'تضحك', 'يمزح', 'مزحة', 'تفلسف'],
            'business': ['عمل', 'شغل', 'مشروع', 'صفقة', 'تجاره', 'بزنس', 'قرض', 'استثمار'],
            'important': ['ضروري', 'مهم', 'عاجل', 'اسرع', 'بسرعة', 'الآن', 'الحين'],
            'checking': ['فاضي', 'شغال', 'مشغول', 'موجود', 'نائم', 'نايم', 'اصحى']
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
        
        if (textLower.includes('الله') || textLower.includes('ان شاء الله')) {
            return 'religious';
        } else if (textLower.includes('؟') || text.includes('??')) {
            return 'inquiring';
        }
        
        return 'neutral';
    }

    buildResponsePersonality(pushName, userMood, context, intent) {
        let personality = {
            tone: 'professional',
            formality: 'professional',
            warmth: 'medium',
            humor: 'none',
            empathy: 'medium',
            length: 'short'
        };
        
        // تحديد نمط الرد بناءً على النية
        if (intent === 'important' || intent === 'business') {
            personality.tone = 'serious';
            personality.formality = 'formal';
            personality.length = 'medium';
        } else if (intent === 'question' || intent === 'request') {
            personality.tone = 'helpful';
            personality.formality = 'polite';
            personality.length = 'short';
        } else if (intent === 'greeting') {
            personality.tone = 'polite';
            personality.length = 'very-short';
        } else if (intent === 'checking') {
            personality.tone = 'informative';
            personality.length = 'short';
        } else if (intent === 'smalltalk' || intent === 'joke') {
            personality.tone = 'polite';
            personality.length = 'very-short';
        } else if (intent === 'thanks') {
            personality.tone = 'grateful';
            personality.length = 'short';
        } else if (intent === 'complaint') {
            personality.tone = 'apologetic';
            personality.empathy = 'high';
            personality.length = 'short';
        }
        
        return personality;
    }

    async generateHumanLikeResponse(jid, text, personality, pushName, context) {
        const systemPrompt = this.createHumanSystemPrompt(pushName, personality, context, text);
        
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
            response = this.normalizeResponse(response, personality);
            this.saveToMemory(jid, text, response);
            
            return response;
            
        } catch (error) {
            console.error("Groq error, trying Gemini:", error.message);
            
            // استخدام Gemini كبديل (باستخدام الطريقة الصحيحة)
            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-pro"
                });
                
                const result = await model.generateContent({
                    contents: [
                        { 
                            role: "user", 
                            parts: [{ text: systemPrompt + "\n\nالمستخدم يقول: " + text }] 
                        }
                    ],
                    generationConfig: {
                        temperature: this.getTemperatureForPersonality(personality),
                        maxOutputTokens: this.getTokenLengthForPersonality(personality),
                    }
                });
                
                let response = await result.response.text();
                response = this.normalizeResponse(response, personality);
                this.saveToMemory(jid, text, response);
                
                return response;
                
            } catch (geminiError) {
                console.error("Both AI services failed:", geminiError.message);
                return this.getFallbackResponse(pushName, text, personality);
            }
        }
    }

    getFallbackResponse(pushName, text, personality) {
        const intent = this.detectUserIntent(text);
        
        const fallbacks = {
            'greeting': `أهلاً ${pushName}، الراشد مشغول الحين، راح أوصل له رسالتك.`,
            'question': `سأوصل سؤالك للراشد، ${pushName}. هو مشغول حالياً.`,
            'request': `تمام ${pushName}، راح أوصل طلبك للراشد.`,
            'important': `الموضوع مهم، راح أوصله للراشد فوراً.`,
            'business': `تمام، راح أوصل موضوع العمل للراشد.`,
            'checking': `الراشد مشغول في شغل مهم حالياً.`,
            'smalltalk': `الراشد مشغول الحين ${pushName}، بس راح أوصل له سلامك.`,
            'default': `راح أوصل رسالتك للراشد، ${pushName}.`
        };
        
        return fallbacks[intent] || fallbacks.default;
    }

    createHumanSystemPrompt(pushName, personality, context, userText) {
        const timeGreeting = this.getTimeAppropriateGreeting();
        const intent = this.detectUserIntent(userText);
        const isImportant = intent === 'important' || intent === 'business';
        
        let prompt = `أنت مساعد الراشد. مهمتك ترد على الناس لما الراشد مشغول.`;
        prompt += `\n\n**دورك:**`;
        prompt += `\n1. الراشد صاحبك وأنت مساعده`;
        prompt += `\n2. الراشد مشغول حالياً في شغله المهم`;
        prompt += `\n3. مهمتك توصل رسائل الناس له وتخبرهم انه مشغول`;
        prompt += `\n4. ما تقول "أنا راشد"، تقول "أنا مساعد الراشد" أو "راح أوصل له"`;
        prompt += `\n5. ركز على توصيل الرسائل فقط`;
        
        prompt += `\n\n**أسلوب الرد:**`;
        prompt += `\n- الردود مختصرة وسريعة`;
        prompt += `\n- اللهجة سعودية طبيعية`;
        prompt += `\n- استخدم كلمات: "راح أوصل له"، "راح أخبره"، "راح أوصله"`;
        prompt += `\n- اذا كان الموضوع مهم، أكد إنك راح توصل الرسالة`;
        prompt += `\n- اذا كان كلام عادي، رد رد مختصر`;
        
        prompt += `\n\n**أمثلة للردود الصحيحة:**`;
        prompt += `\n- "أهلاً، الراشد مشغول الحين، راح أوصل له رسالتك."`;
        prompt += `\n- "تمام، راح أخبر الراشد بالموضوع."`;
        prompt += `\n- "سأوصل طلبك للراشد، هو مشغول حالياً."`;
        prompt += `\n- "راح أوصل سؤالك له، ${pushName}."`;
        prompt += `\n- "الراشد في شغل مهم، بس راح أوصل له كلامك."`;
        prompt += `\n- "ان شاء الله راح يوصل له الرسالة."`;
        
        prompt += `\n\n**أمثلة لردود خاطئة (تجنبها):**`;
        prompt += `\n- ❌ "أنا راشد مشغول" (خطأ، الراشد شخص ثاني)`;
        prompt += `\n- ❌ "ما عندي وقت" (ما تقول عن نفسك)`;
        prompt += `\n- ❌ "الراشد مش هنا" (ما تكذب، هو مشغول مو مش موجود)`;
        prompt += `\n- ❌ "وش تبغى منه" (ما تكون وقح)`;
        
        prompt += `\n\n**المعلومات:**`;
        prompt += `\n- المستخدم: ${pushName}`;
        prompt += `\n- الوقت: ${timeGreeting}`;
        prompt += `\n- نوع الرسالة: ${intent}`;
        if (isImportant) {
            prompt += `\n- ⚠️ الرسالة مهمة، تأكد من توصيلها`;
        }
        
        if (context.conversationHistory.length > 0) {
            prompt += `\n\n**المحادثة الأخيرة:**`;
            context.conversationHistory.slice(-2).forEach((msg, index) => {
                prompt += `\n${msg.sender === 'user' ? pushName : 'أنت'}: ${msg.text.substring(0, 40)}...`;
            });
        }
        
        prompt += `\n\n**الرسالة الجديدة من ${pushName}:**`;
        prompt += `\n"${userText.substring(0, 100)}"`;
        
        prompt += `\n\n**الآن رد عليك بطريقة:**`;
        prompt += `\n1. خاطبه باسمه: ${pushName}`;
        prompt += `\n2. وضح أن الراشد مشغول`;
        prompt += `\n3. أكد أنك راح توصل الرسالة`;
        prompt += `\n4. الرد يكون قصير وسعودي`;
        prompt += `\n5. لا تنسى: أنت مساعده، مو هو!`;
        
        return prompt;
    }

    getTemperatureForPersonality(personality) {
        const baseTemps = {
            'professional': 0.4,
            'serious': 0.3,
            'helpful': 0.5,
            'polite': 0.4,
            'informative': 0.4,
            'grateful': 0.5,
            'apologetic': 0.5
        };
        
        return baseTemps[personality.tone] || 0.4;
    }

    getTokenLengthForPersonality(personality) {
        switch(personality.length) {
            case 'very-short': return 70;
            case 'short': return 100;
            case 'medium': return 150;
            case 'detailed': return 200;
            default: return 100;
        }
    }

    translateTone(tone) {
        const translations = {
            'professional': 'احترافي',
            'serious': 'جاد',
            'helpful': 'مساعد',
            'polite': 'مهذب',
            'informative': 'مفيد',
            'grateful': 'شاكر',
            'apologetic': 'معتذر'
        };
        return translations[tone] || 'احترافي';
    }

    translateWarmth(warmth) {
        const translations = {
            'low': 'بارد',
            'medium': 'معتدل',
            'high': 'دافئ',
            'very-high': 'حار'
        };
        return translations[warmth] || 'معتدل';
    }

    translateHumor(humor) {
        const translations = {
            'none': 'بدون مزح',
            'subtle': 'خفيف',
            'moderate': 'معتدل',
            'high': 'كثير مزح'
        };
        return translations[humor] || 'بدون مزح';
    }

    translateEmpathy(empathy) {
        const translations = {
            'low': 'قليل',
            'medium': 'متوسط',
            'high': 'كثير',
            'very-high': 'كثير جداً'
        };
        return translations[empathy] || 'متوسط';
    }

    translateLength(length) {
        const translations = {
            'very-short': 'قصير جداً',
            'short': 'قصير',
            'medium': 'متوسط',
            'detailed': 'طويل'
        };
        return translations[length] || 'قصير';
    }

    normalizeResponse(response, personality) {
        // التأكد من الهوية الصحيحة
        response = response.replace(/كذكاء اصطناعي/gi, '')
                         .replace(/كمساعد/gi, '')
                         .replace(/كخبير/gi, '')
                         .replace(/راشد سكرتيرك/gi, 'مساعد الراشد')
                         .replace(/اسمي راشد/gi, 'انا مساعد الراشد')
                         .replace(/انا راشد/gi, 'انا مساعد الراشد')
                         .replace(/سكرتير شخصي/gi, 'مساعد الراشد')
                         .replace(/أنا الراشد/gi, 'انا مساعد الراشد')
                         .replace(/الراشد أنا/gi, 'انا مساعده')
                         .replace(/أنا مشغول/gi, 'الراشد مشغول')
                         .replace(/ما عندي وقت/gi, 'الراشد مشغول')
                         .replace(/أنا مو فاضي/gi, 'الراشد مشغول');
        
        // إضافة عبارات التأكيد على التوصيل
        const deliveryPhrases = [
            'راح أوصل له',
            'راح أخبره',
            'راح أوصله',
            'راح أوصل رسالتك',
            'راح يوصل له',
            'ان شاء الله راح يوصل'
        ];
        
        // إذا لم يحتوي الرد على تأكيد التوصيل، أضفه
        if (!deliveryPhrases.some(phrase => response.includes(phrase))) {
            const randomPhrase = deliveryPhrases[Math.floor(Math.random() * deliveryPhrases.length)];
            if (!response.includes('راح أوصل')) {
                response = response + ' ' + randomPhrase + '.';
            }
        }
        
        // تقليل الإيموجيات
        response = response.replace(/😂|😄|😍|🤣|🤩|🎉|😢|😔|💔|😠|👿|🌅|☀️|🌆|🌙/g, '');
        
        // تطبيع اللهجة
        response = this.normalizeDialect(response);
        
        // تقصير الرد إذا كان طويلاً
        if (response.length > 200) {
            response = response.substring(0, 180) + '...';
        }
        
        return response.trim();
    }

    normalizeDialect(text) {
        let normalized = text;
        const dialectMap = {
            'ماذا': 'وش',
            'كيف': 'شلون',
            'لماذا': 'ليه',
            'أين': 'وين',
            'متى': 'امتى',
            'أريد': 'ابغى',
            'أحتاج': 'احتاج',
            'بالتأكيد': 'اكيد',
            'طيب': 'تمم',
            'جيد': 'حلو',
            'حسناً': 'اوك',
            'مرحبا': 'اهلين',
            'شكراً': 'يعطيك العافية',
            'عفواً': 'العفو',
            'نعم': 'ايوه',
            'الآن': 'الحين',
            'سوف': 'راح',
            'سأقوم': 'راح',
            'أقوم': 'راح',
            'سأخبر': 'راح أخبر',
            'سأوصل': 'راح أوصل'
        };
        
        Object.entries(dialectMap).forEach(([fusha, ammiya]) => {
            normalized = normalized.replace(new RegExp(fusha, 'gi'), ammiya);
        });
        
        return normalized;
    }

    saveToMemory(jid, userText, botResponse) {
        if (!this.conversationMemory.has(jid)) {
            this.conversationMemory.set(jid, []);
        }
        
        const memory = this.conversationMemory.get(jid);
        memory.push({ text: userText, sender: 'user', timestamp: new Date() });
        memory.push({ text: botResponse, sender: 'bot', timestamp: new Date() });
        
        if (memory.length > 20) {
            this.conversationMemory.set(jid, memory.slice(-20));
        }
    }

    enhanceHumanTouch(response, userMood, conversationDepth) {
        let enhanced = response;
        
        // إضافة عبارات إضافية للمحادثات المهمة
        if (conversationDepth > 5) {
            const extraPhrases = [
                ' ان شاء الله',
                ' الله يوفقه',
                ' توكل على الله',
                ' ما تقلق'
            ];
            if (Math.random() > 0.7) {
                const randomPhrase = extraPhrases[Math.floor(Math.random() * extraPhrases.length)];
                enhanced = enhanced + randomPhrase;
            }
        }
        
        // التأكد من وجود اسم الراشد
        if (!enhanced.includes('الراشد') && !enhanced.includes('راشد')) {
            enhanced = enhanced.replace(/هو/g, 'الراشد');
        }
        
        // التأكد من الاختصار
        if (enhanced.split(' ').length > 30) {
            const words = enhanced.split(' ');
            enhanced = words.slice(0, 25).join(' ');
        }
        
        return enhanced.trim();
    }

    getTimeAppropriateGreeting() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'صباح الخير';
        if (hour >= 12 && hour < 17) return 'مساء النور';
        if (hour >= 17 && hour < 21) return 'مساء الخير';
        return 'مساء الليل';
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
        const commonTopics = ['العمل', 'الدراسة', 'العائلة', 'الأصدقاء', 'الرياضة', 'التقنية', 'السفر'];
        for (const topic of commonTopics) {
            if (text.includes(topic)) return topic;
        }
        return null;
    }

    updateConversationFlow(jid, userText, botResponse, intent) {
        if (!this.responsePatterns.has(jid)) {
            this.responsePatterns.set(jid, new Map());
        }
        const patterns = this.responsePatterns.get(jid);
        patterns.set(intent, (patterns.get(intent) || 0) + 1);
        this.lastInteractionTime.set(jid, new Date());
    }

    getNaturalFallbackResponse(pushName, originalText) {
        const fallbacks = [
            `أهلاً ${pushName}، الراشد مشغول الحين، راح أوصل له رسالتك.`,
            `تمام ${pushName}، راح أخبر الراشد بالموضوع.`,
            `سأوصل كلامك للراشد، هو مشغول حالياً.`,
            `ان شاء الله راح يوصل للراشد رسالتك، ${pushName}.`
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

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
        
        return `تم مسح ذاكرة المحادثة`;
    }
}

const smartSecretary = new SmartSecretary();

async function getAIResponse(jid, text, pushName) {
    return await smartSecretary.getAIResponse(jid, text, pushName);
}

module.exports = { 
    getAIResponse,
    smartSecretary
};
