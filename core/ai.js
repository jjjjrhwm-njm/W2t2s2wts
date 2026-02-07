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
        this.responseVariations = new Map();
        
        // تفضيلات الرد البشرية
        this.humanResponseConfig = {
            typingVariations: [800, 1200, 1800, 2500],
            responseLength: 'short',
            emotionLevel: 'neutral',
            formality: 'professional',
            humorLevel: 'none',
            empathyLevel: 'medium'
        };
        
        this.initializeResponseVariations();
    }
    
    initializeResponseVariations() {
        // بدائل لكل نوع من الردود لمنع التكرار
        this.responseVariations.set('greeting', [
            "أهلاً فيك! وش الجديد؟",
            "هلا والله! كيف الحال؟",
            "يا هلا! وش الأخبار؟",
            "مرحباً! وش في بالك؟",
            "أهلاً وسهلاً! وش مسوي؟"
        ]);
        
        this.responseVariations.set('rashaad_busy', [
            "الراشد مشغول في شغله الحين",
            "الله يخليه، الراشد مشغول",
            "الراشد مو متاح حالياً",
            "الراشد في دوامه الآن",
            "الراشد مشغول بس أنا موجود"
        ]);
        
        this.responseVariations.set('will_deliver', [
            "حاضر! راح أوصله طلبك",
            "تم، راح أوصل الرسالة",
            "أكيد! راح أوصله",
            "راح أعلم الراشد",
            "توكل، راح أوصل له"
        ]);
        
        this.responseVariations.set('smalltalk', [
            "والله ماشي الحال، وانت؟",
            "الحمدلله بخير، وش أخبارك؟",
            "تمام الحمدلله، وش الجديد؟",
            "مبسوط لأنك كلمتني! وش عندك؟",
            "ربي يخليك، وانت شلونك؟"
        ]);
        
        this.responseVariations.set('question', [
            "شكلك تبي تعرف شي!",
            "سؤال حلو!",
            "تبي تعرف عن الراشد؟",
            "وش تبغى تعرف؟",
            "عطني سؤالك!"
        ]);
        
        this.responseVariations.set('checking', [
            "موجود ومسؤول عنك!",
            "جاهز للخدمة!",
            "أنا هنا!",
            "بالخدمة!",
            "جاهز ومستعد!"
        ]);
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
                contextAnalysis.conversationDepth,
                userIntent
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
            tone: 'friendly',
            formality: 'casual',
            warmth: 'medium',
            humor: 'subtle',
            empathy: 'medium',
            length: 'short'
        };
        
        // تحديد نمط الرد بناءً على النية
        if (intent === 'important' || intent === 'business') {
            personality.tone = 'serious';
            personality.formality = 'polite';
            personality.length = 'medium';
        } else if (intent === 'question') {
            personality.tone = 'helpful';
            personality.formality = 'casual';
            personality.length = 'medium';
        } else if (intent === 'request') {
            personality.tone = 'helpful';
            personality.formality = 'polite';
            personality.length = 'medium';
        } else if (intent === 'greeting') {
            personality.tone = 'welcoming';
            personality.warmth = 'high';
            personality.length = 'short';
        } else if (intent === 'checking') {
            personality.tone = 'informative';
            personality.length = 'short';
        } else if (intent === 'smalltalk' || intent === 'joke') {
            personality.tone = 'conversational';
            personality.humor = 'moderate';
            personality.length = 'short';
        } else if (intent === 'thanks') {
            personality.tone = 'grateful';
            personality.warmth = 'high';
            personality.length = 'short';
        } else if (intent === 'complaint') {
            personality.tone = 'apologetic';
            personality.empathy = 'high';
            personality.length = 'medium';
        }
        
        // حسب مزاج المستخدم
        switch(userMood) {
            case 'happy':
                personality.tone = 'cheerful';
                personality.warmth = 'high';
                personality.humor = 'moderate';
                break;
            case 'sad':
                personality.tone = 'comforting';
                personality.empathy = 'high';
                break;
            case 'angry':
                personality.tone = 'calm';
                personality.formality = 'polite';
                break;
            case 'excited':
                personality.tone = 'enthusiastic';
                personality.warmth = 'high';
                break;
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
        const nickname = this.generateNickname(pushName);
        
        const fallbacks = {
            'greeting': this.getVariation('greeting').replace('!', ` ${nickname}!`),
            'question': `شكلك تبي تعرف شي عن الراشد! هو ${this.getVariation('rashaad_busy')}`,
            'request': `${this.getVariation('will_deliver').replace('طلبك', `طلبك يا ${nickname}`)}`,
            'important': `أكيد مهم! ${this.getVariation('will_deliver')}`,
            'business': `تم، ${this.getVariation('will_deliver').replace('أوصله', 'أعلم الراشد')}`,
            'checking': this.getVariation('checking'),
            'smalltalk': `هلا والله ${nickname}! ${this.getVariation('rashaad_busy')}`,
            'default': `يا هلا ${nickname}! ${this.getVariation('rashaad_busy')}`
        };
        
        return fallbacks[intent] || fallbacks.default;
    }

    createHumanSystemPrompt(pushName, personality, context, userText) {
        const timeGreeting = this.getTimeAppropriateGreeting();
        const intent = this.detectUserIntent(userText);
        const nickname = this.generateNickname(pushName);
        
        let prompt = `أنت مساعد الراشد. الناس بتكلمك لما الراشد مشغول.\n\n`;
        
        prompt += `**أسلوبك:**\n`;
        prompt += `- تكلم زي صديق طبيعي\n`;
        prompt += `- ردودك قصيرة وسريعة (سطر أو سطرين)\n`;
        prompt += `- كلم الناس بأسمائهم (مثل: يا ${nickname})\n`;
        prompt += `- خلي الرد بسيط وواضح\n`;
        prompt += `- اضف روح ومرح خفيف\n\n`;
        
        prompt += `**عن الراشد:**\n`;
        prompt += `- الراشد مشغول غالباً\n`;
        prompt += `- إذا سألوا عنه: قل إنه مشغول وأنت موجود\n`;
        prompt += `- لا تكرر نفس العبارة كثير\n`;
        prompt += `- غيّر طريقة قول "الراشد مشغول" كل مرة\n\n`;
        
        prompt += `**متى توصل رسالة:**\n`;
        prompt += `- فقط إذا طلبوا من الراشد شي خاص\n`;
        prompt += `- إذا كان موضوع عمل أو مهم\n`;
        prompt += `- إذا كان طلب واضح للراشد\n\n`;
        
        prompt += `**متى ترد عادي:**\n`;
        prompt += `- إذا سلموا أو حيوك\n`;
        prompt += `- إذا سألوا عن حالك\n`;
        prompt += `- إذا كان كلام ودّي\n`;
        prompt += `- إذا كانوا يتسألون\n\n`;
        
        prompt += `**أمثلة لردودك:**\n`;
        prompt += `- "السلام": "${timeGreeting} ${nickname}! الراشد مشغول بس أنا موجود"\n`;
        prompt += `- "وين الراشد": "${this.getVariation('rashaad_busy')}"\n`;
        prompt += `- "ابغى الراشد": "${this.getVariation('will_deliver')}"\n`;
        prompt += `- "شلونك": "${this.getVariation('smalltalk')}"\n`;
        prompt += `- "وش تسوي": "أتابع الرسائل! وش عندك جديد يا ${nickname}؟"\n\n`;
        
        prompt += `**المعلومات:**\n`;
        prompt += `- المستخدم: ${pushName} (ناديه: ${nickname})\n`;
        prompt += `- الوقت: ${timeGreeting}\n`;
        prompt += `- نوع الرسالة: ${intent}\n`;
        prompt += `- مزاج المستخدم: ${personality.tone}\n\n`;
        
        if (context.conversationHistory.length > 0) {
            prompt += `**آخر ما تكلمنا:**\n`;
            context.conversationHistory.slice(-2).forEach((msg, index) => {
                prompt += `- ${msg.sender === 'user' ? nickname : 'أنت'}: ${msg.text.substring(0, 30)}\n`;
            });
            prompt += `\n`;
        }
        
        prompt += `**الرسالة الجديدة من ${nickname}:**\n`;
        prompt += `"${userText}"\n\n`;
        
        prompt += `**الآن أجب بطريقة:**\n`;
        prompt += `1. رد قصير (ما يزيد عن سطرين)\n`;
        prompt += `2. نادي المستخدم باسمه (${nickname})\n`;
        prompt += `3. إذا سأل عن الراشد: جاوب بطريقة مختلفة عن المرة السابقة\n`;
        prompt += `4. إذا طلب الراشد: قل إنك راح توصله الرسالة\n`;
        prompt += `5. إذا كان كلام عادي: تفاعل معه\n`;
        prompt += `6. خلي الرد طبيعي ومريح\n`;
        prompt += `7. لا تكن روبوتي أو ممل\n`;
        
        return prompt;
    }

    getTemperatureForPersonality(personality) {
        const baseTemps = {
            'friendly': 0.7,
            'serious': 0.5,
            'helpful': 0.6,
            'welcoming': 0.7,
            'informative': 0.6,
            'conversational': 0.8,
            'grateful': 0.7,
            'apologetic': 0.6,
            'cheerful': 0.8,
            'comforting': 0.6,
            'calm': 0.5,
            'enthusiastic': 0.7
        };
        
        return baseTemps[personality.tone] || 0.6;
    }

    getTokenLengthForPersonality(personality) {
        switch(personality.length) {
            case 'short': return 80;
            case 'medium': return 120;
            case 'detailed': return 150;
            default: return 100;
        }
    }

    translateTone(tone) {
        const translations = {
            'friendly': 'ودود',
            'serious': 'جاد',
            'helpful': 'مساعد',
            'welcoming': 'ترحيبي',
            'informative': 'مفيد',
            'conversational': 'محادثة',
            'grateful': 'شاكر',
            'apologetic': 'معتذر',
            'cheerful': 'مبتهج',
            'comforting': 'مطمئن',
            'calm': 'هادئ',
            'enthusiastic': 'متحمس'
        };
        return translations[tone] || 'طبيعي';
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
        return translations[humor] || 'خفيف';
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
            'short': 'قصير',
            'medium': 'متوسط',
            'detailed': 'مفصل'
        };
        return translations[length] || 'متوسط';
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
                         .replace(/أنا مشغول/gi, 'الراشد مشغول');
        
        // إزالة أي كلمات أجنبية
        const foreignWords = [
            'ok', 'okay', 'yes', 'no', 'hello', 'hi', 'bye', 'sorry',
            'thanks', 'thank', 'please', 'welcome', 'good', 'bad',
            'problem', 'issue', 'solution', 'idea', 'plan', 'fine',
            'great', 'nice', 'cool', 'awesome', 'perfect'
        ];
        
        foreignWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            response = response.replace(regex, '');
        });
        
        // إزالة أي أحرف إنجليزية متبقية
        response = response.replace(/[a-zA-Z]/g, '');
        
        // تقليل الإيموجيات (نادر جداً)
        if (Math.random() > 0.1) {
            response = response.replace(/[😂😄😍🤣🤩🎉😢😔💔😠👿🌅☀️🌆🌙❤️🤗💼📊👌]/g, '');
        }
        
        // تطبيع اللهجة
        response = this.normalizeDialect(response);
        
        // تقصير الرد إذا كان طويلاً
        if (response.length > 120) {
            response = response.substring(0, 100) + '...';
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

    enhanceHumanTouch(response, userMood, conversationDepth, intent) {
        let enhanced = response;
        
        // إضافة الاهتمام حسب المزاج
        if (userMood === 'sad') {
            const comfortPhrases = ['الله يعينك', 'ربي يفرج همك', 'الله يكون بعونك'];
            const randomComfort = comfortPhrases[Math.floor(Math.random() * comfortPhrases.length)];
            enhanced = enhanced.replace(/\.$/, '') + '. ' + randomComfort;
        } else if (userMood === 'happy') {
            const happyPhrases = ['الله يبارك فيك', 'دام الضحكة', 'ربي يحفظك'];
            const randomHappy = happyPhrases[Math.floor(Math.random() * happyPhrases.length)];
            enhanced = enhanced.replace(/\.$/, '') + '. ' + randomHappy;
        }
        
        // تغيير الردود المكررة
        enhanced = this.replaceCommonPhrases(enhanced, intent);
        
        // التأكد من الاختصار
        if (enhanced.split(' ').length > 25) {
            const words = enhanced.split(' ');
            enhanced = words.slice(0, 20).join(' ');
        }
        
        return enhanced.trim();
    }
    
    replaceCommonPhrases(response, intent) {
        // استبدال العبارات المكررة ببدائل
        const replacements = {
            'راح أوصل رسالتك': this.getVariation('will_deliver'),
            'الراشد مشغول': this.getVariation('rashaad_busy'),
            'أهلاً فيك': this.getVariation('greeting')
        };
        
        let newResponse = response;
        Object.entries(replacements).forEach(([phrase, replacement]) => {
            if (newResponse.includes(phrase)) {
                newResponse = newResponse.replace(phrase, replacement);
            }
        });
        
        return newResponse;
    }
    
    getVariation(type) {
        const variations = this.responseVariations.get(type);
        if (variations && variations.length > 0) {
            return variations[Math.floor(Math.random() * variations.length)];
        }
        return type === 'rashaad_busy' ? 'الراشد مشغول' : 'حاضر';
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
        const nickname = this.generateNickname(pushName);
        const fallbacks = [
            `أهلاً ${nickname}! ${this.getVariation('rashaad_busy')}`,
            `هلا والله ${nickname}! ${this.getVariation('smalltalk')}`,
            `${this.getVariation('rashaad_busy')} يا ${nickname}`,
            `يا هلا ${nickname}! وش تحتاج؟`
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
