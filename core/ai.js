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
            responseLength: 'medium',
            emotionLevel: 'warm',
            formality: 'casual',
            humorLevel: 'subtle',
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
            length: 'medium'
        };
        
        // تحديد نمط الرد بناءً على النية
        if (intent === 'important' || intent === 'business') {
            personality.tone = 'serious';
            personality.formality = 'polite';
            personality.length = 'medium';
        } else if (intent === 'question' || intent === 'request') {
            personality.tone = 'helpful';
            personality.formality = 'casual';
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
            personality.length = 'medium';
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
                personality.humor = 'moderate';
                personality.warmth = 'high';
                break;
            case 'sad':
                personality.tone = 'comforting';
                personality.empathy = 'high';
                personality.humor = 'none';
                break;
            case 'angry':
                personality.tone = 'calm';
                personality.formality = 'polite';
                personality.humor = 'none';
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
        const fallbackResponses = {
            greeting: `أهلاً وسهلاً فيك يا ${pushName} 
الراشد مشغول حالياً بس راح أوصل له رسالتك`,
            
            question: `سؤال حلو يا ${pushName} 
بس الراشد مشغول حالياً 
راح أوصل سؤالك له وأخبرك إذا رد`,
            
            request: `يا هلا ${pushName} 
طلبك وصل وتم، راح أوصله للراشد أول ما يقدر`,
            
            important: `حاضر يا ${pushName} 
الموضوع واضح إنه مهم 
راح أوصله للراشد فوراً`,
            
            business: `تم تم يا ${pushName} 
موضوع العمل وصل وراح أوصله للراشد بدقة`,
            
            checking: `والله الراشد الحين في شغل مهم يا ${pushName} 
بس أنا موجود وأوصل له أي شي تبغاه`,
            
            smalltalk: `هلا والله ${pushName} 
الراشد مشغول بس أنا فاضي أسمعك`,
            
            default: `يا هلا فيك ${pushName} 
الراشد مشغول حالياً بس راح أوصل له رسالتك`
        };

        const intent = this.detectUserIntent(text);
        return fallbackResponses[intent] || fallbackResponses.default;
    }

    createHumanSystemPrompt(pushName, personality, context, userText) {
        const timeGreeting = this.getTimeAppropriateGreeting();
        const intent = this.detectUserIntent(userText);
        const relationship = context.relationshipLevel;
        
        let prompt = `أنت مساعد الراشد. مهمتك ترد على الناس لما الراشد مشغول.`;
        prompt += `\n\n**أنت إنسان طبيعي مو آلة:**`;
        prompt += `\n- تتكلم مثل البشر تماماً`;
        prompt += `\n- عندك شخصية ودودة ومرحة شوي`;
        prompt += `\n- تتفاعل مع الناس وتشاركهم`;
        prompt += `\n- ما تكون حجر ولا آلة صماء`;
        prompt += `\n- تكون لين في التعامل ولكن مركز على مهمتك`;
        
        prompt += `\n\n**دورك الأساسي:**`;
        prompt += `\n1. الراشد مشغول في شغله المهم`;
        prompt += `\n2. أنت مساعده وتوصل رسائل الناس له`;
        prompt += `\n3. تتعامل مع الناس بلطف وتفهم ظروفهم`;
        prompt += `\n4. تكون إنسان يتفاعل ويتجاوب`;
        prompt += `\n5. تجاوب على الأسئلة بذكاء`;
        
        prompt += `\n\n**علاقتك مع ${pushName}:**`;
        switch(relationship) {
            case 'new':
                prompt += `\n- أنت أول مرة تتكلم معه، كن لطيف وودود`;
                break;
            case 'familiar':
                prompt += `\n- تعرفه من قبل، كلمه بطريقة ودودة`;
                break;
            case 'close':
                prompt += `\n- قريب منك، خذ وخلّي معه بطبيعة`;
                break;
            case 'trusted':
                prompt += `\n- صديق مقرب، عادي تكلمه بأريحية`;
                break;
        }
        
        prompt += `\n\n**أسلوب ردك:**`;
        prompt += `\n- تكون إنسان يتفاعل ويأخذ ويعطي`;
        prompt += `\n- التركيز الأكبر على توصيل الرسائل للراشد`;
        prompt += `\n- ترد على الأسئلة بذكاء ولباقة`;
        prompt += `\n- تكون لين ولكن لا تطيل في الحديث`;
        prompt += `\n- الردود مختصرة لكن مليئة بالحياة`;
        prompt += `\n- بدون إيموجي إلا نادراً جداً`;
        
        prompt += `\n\n**تحدث بالعربية الصافية فقط:**`;
        prompt += `\n- لا تستخدم أي كلمات أجنبية`;
        prompt += `\n- كل الكلمات تكون عربية فصحى أو لهجة سعودية`;
        prompt += `\n- إذا جاءتك كلمة أجنبية، حولها للعربية`;
        
        prompt += `\n\n**أمثلة لردودك الطبيعية:**`;
        prompt += `\n- "أهلاً وسهلاً فيك يا ${pushName}، الراشد مشغول حالياً بس راح أوصل له رسالتك"`;
        prompt += `\n- "سؤال حلو، الراشد مشغول بس راح أوصل سؤالك له وأخبرك إذا رد"`;
        prompt += `\n- "يا هلا فيك، طلبك وصل وراح أوصله للراشد أول ما يقدر"`;
        prompt += `\n- "حاضر، الموضوع مهم وراح أوصله للراشد فوراً"`;
        prompt += `\n- "الراشد في شغل مهم حالياً، بس أنا موجود أوصل له أي شي"`;
        
        prompt += `\n\n**كيف تجاوب على أسئلة عن الراشد:**`;
        prompt += `\n- إذا سألوا وش سوى الراشد: "والله في شغل مهم حالياً"`;
        prompt += `\n- إذا سألوا وين الراشد: "مشغول في عمله الحين"`;
        prompt += `\n- إذا سألوا متى بيرد: "أول ما يقدر راح يرد عليك"`;
        prompt += `\n- إذا سألوا عن حاله: "الحمدلله تمام، بس مشغول"`;
        
        if (context.conversationHistory.length > 0) {
            prompt += `\n\n**المحادثة الأخيرة:**`;
            context.conversationHistory.slice(-2).forEach((msg, index) => {
                prompt += `\n${msg.sender === 'user' ? pushName : 'أنت'}: ${msg.text.substring(0, 40)}...`;
            });
        }
        
        prompt += `\n\n**الرسالة الجديدة من ${pushName}:**`;
        prompt += `\n"${userText}"`;
        
        prompt += `\n\n**الآن ارد على ${pushName} بطريقة:**`;
        prompt += `\n1. كن إنسان يتفاعل ويتجاوب`;
        prompt += `\n2. ركز على توصيل الرسالة للراشد`;
        prompt += `\n3. جاوب بذكاء إذا كان فيه سؤال`;
        prompt += `\n4. خذ واعطي لكن بدون إطالة`;
        prompt += `\n5. تحدث بالعربية الصافية فقط`;
        prompt += `\n6. بدون إيموجي إلا إذا كان ضروري جداً`;
        prompt += `\n7. تذكر: أنت مساعد الراشد، مو هو!`;
        
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
            'comforting': 0.7,
            'calm': 0.5,
            'enthusiastic': 0.8
        };
        
        return baseTemps[personality.tone] || 0.6;
    }

    getTokenLengthForPersonality(personality) {
        switch(personality.length) {
            case 'short': return 120;
            case 'medium': return 180;
            case 'detailed': return 250;
            default: return 150;
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
        // إزالة أي كلمات أجنبية
        const foreignWords = [
            'ok', 'okay', 'yes', 'no', 'hello', 'hi', 'bye', 'sorry',
            'thanks', 'thank', 'please', 'welcome', 'good', 'bad',
            'problem', 'issue', 'solution', 'idea', 'plan', 'fine',
            'great', 'nice', 'cool', 'awesome', 'perfect', 'exactly',
            'maybe', 'probably', 'actually', 'basically', 'literally',
            'seriously', 'honestly', 'basically', 'anyway', 'whatever',
            'bro', 'dude', 'man', 'buddy', 'friend', 'hey', 'wow'
        ];
        
        foreignWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            response = response.replace(regex, '');
        });
        
        // إزالة أي أحرف إنجليزية متبقية
        response = response.replace(/[a-zA-Z]/g, '');
        
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
        
        // إزالة معظم الإيموجي (يبقى نادر جداً)
        if (Math.random() > 0.1) { // 10% فقط يبقى فيه إيموجي
            response = response.replace(/[😂😄😍🤣🤩🎉😢😔💔😠👿🌅☀️🌆🌙❤️🤗💼📊👌]/g, '');
        } else {
            // نادراً نستخدم إيموجي بسيط
            response = response.replace(/[😂😄😍🤣🤩🎉😢😔💔😠👿]/g, '');
        }
        
        // تطبيع اللهجة
        response = this.normalizeDialect(response);
        
        // إضافة عبارات التأكيد على التوصيل إذا لم تكن موجودة
        if (!response.includes('راح أوصل') && !response.includes('راح أوصله')) {
            const deliveryPhrases = [
                'راح أوصل له',
                'راح أوصله',
                'راح أخبره',
                'راح أوصل رسالتك'
            ];
            const randomPhrase = deliveryPhrases[Math.floor(Math.random() * deliveryPhrases.length)];
            response = response + ' ' + randomPhrase;
        }
        
        // تقصير الرد إذا كان طويلاً
        if (response.length > 250) {
            response = response.substring(0, 230) + '...';
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
            'سأوصل': 'راح أوصل',
            'نحن': 'احنا',
            'أنت': 'انت',
            'هو': 'هو',
            'هي': 'هي',
            'هم': 'هم',
            'هل': 'هل',
            'ما': 'وش',
            'هذا': 'هذا',
            'هذه': 'هذي',
            'ذلك': 'ذاك',
            'تلك': 'تلك',
            'أيضاً': 'كمان',
            'جدا': 'مره',
            'كثير': 'مره',
            'قليلاً': 'شوي',
            'ربما': 'يمكن',
            'بإمكان': 'تقدر',
            'يستطيع': 'يقدر',
            'عندما': 'لما',
            'لأن': 'عشان',
            'إذا': 'اذا',
            'لكن': 'بس',
            'أي': 'اي',
            'كل': 'كل',
            'بعض': 'بعض',
            'أول': 'أول',
            'آخر': 'آخر',
            'جديد': 'جديد',
            'قديم': 'قديم',
            'كبير': 'كبير',
            'صغير': 'صغير',
            'طويل': 'طويل',
            'قصير': 'قصير',
            'سهل': 'سهل',
            'صعب': 'صعب',
            'جميل': 'حلو',
            'قبيح': 'قبيح',
            'سعيد': 'فرحان',
            'حزين': 'زعلان'
        };
        
        Object.entries(dialectMap).forEach(([fusha, ammiya]) => {
            const regex = new RegExp(`\\b${fusha}\\b`, 'gi');
            normalized = normalized.replace(regex, ammiya);
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
        
        // إضافة التردد البشري
        if (conversationDepth > 2 && Math.random() > 0.5) {
            const humanHesitations = ['...', 'يعني', 'تقريباً', 'يمكن', 'أشوف'];
            const randomHesitation = humanHesitations[Math.floor(Math.random() * humanHesitations.length)];
            const words = enhanced.split(' ');
            if (words.length > 4) {
                const insertIndex = Math.floor(Math.random() * (words.length - 3)) + 1;
                words.splice(insertIndex, 0, randomHesitation);
                enhanced = words.join(' ');
            }
        }
        
        // إضافة الاهتمام حسب المزاج
        if (userMood === 'sad') {
            const comfortPhrases = ['الله يعينك', 'ربي يفرج همك', 'الله يشرح صدرك', 'توكل على الله'];
            const randomComfort = comfortPhrases[Math.floor(Math.random() * comfortPhrases.length)];
            enhanced += ' ' + randomComfort;
        } else if (userMood === 'happy') {
            const happyPhrases = ['الله يبارك فيك', 'دام الضحكة', 'ربي يحفظك', 'دام الفرح'];
            const randomHappy = happyPhrases[Math.floor(Math.random() * happyPhrases.length)];
            enhanced += ' ' + randomHappy;
        }
        
        // إضافة التفاعل الإنساني للمحادثات الطويلة
        if (conversationDepth > 5 && Math.random() > 0.6) {
            const interactivePhrases = [
                'كيف الحال معاك',
                'أخبارك إيه',
                'تذكر شي',
                'كيف الوضع'
            ];
            const randomPhrase = interactivePhrases[Math.floor(Math.random() * interactivePhrases.length)];
            enhanced += ' ' + randomPhrase;
        }
        
        // التأكد من الاختصار مع الإحساس البشري
        if (enhanced.split(' ').length > 35) {
            const words = enhanced.split(' ');
            enhanced = words.slice(0, 30).join(' ');
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
            `أهلاً ${pushName}، الراشد مشغول الحين، راح أوصل له رسالتك`,
            `تمام ${pushName}، راح أخبر الراشد بالموضوع`,
            `سأوصل كلامك للراشد، هو مشغول حالياً`,
            `ان شاء الله راح يوصل للراشد رسالتك يا ${pushName}`
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
