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
            'سعود': 'سعودي',
            'ناصر': 'نصيري',
            'عبدالله': 'عبود'
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
            'sharing': ['حبيت', 'تخيل', 'سمعت', 'شفت', 'جاني', 'صارلي', 'عندي', 'عندنا', 'شفت'],
            'complaint': ['ماعجبني', 'مزعج', 'تعبان', 'زعلان', 'مللت', 'ضاق', 'غاضب', 'منزعج'],
            'thanks': ['شكرا', 'مشكور', 'يعطيك', 'الله', 'تسلم', 'ماقصرت', 'الله يسلمك'],
            'smalltalk': ['وشسويت', 'شلونك', 'اخبارك', 'وينك', 'وشفاكر', 'ايش تسوي', 'شغلك', 'وين كنت'],
            'joke': ['نكته', 'ضحكه', 'طايره', 'تضحك', 'يمزح', 'مزحة', 'تفلسف'],
            'business': ['عمل', 'شغل', 'مشروع', 'صفقة', 'تجاره', 'بزنس', 'قرض', 'استثمار'],
            'important': ['ضروري', 'مهم', 'عاجل', 'اسرع', 'بسرعة', 'الآن', 'الحين'],
            'checking': ['فاضي', 'شغال', 'مشغول', 'موجود', 'نائم', 'نايم', 'اصحى', 'وينه'],
            'personal': ['حب', 'حبيبي', 'عزيزي', 'يا قلبي', 'يا عمري', 'غالي']
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
            'excited': ['🤩', '🎉', 'واو', 'رائع', 'مدهش', 'متحمس'],
            'playful': ['😜', '🤪', '😏', 'يلا', 'تعال', 'شد حيلك']
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
        const profile = context.userProfile;
        const relationship = profile.relationshipLevel;
        
        let personality = {
            tone: 'friendly',
            formality: 'casual',
            warmth: 'medium',
            humor: 'subtle',
            empathy: 'medium',
            length: 'medium'
        };
        
        // حسب مستوى العلاقة
        switch(relationship) {
            case 'new':
                personality.tone = 'polite';
                personality.formality = 'semi-formal';
                personality.warmth = 'medium';
                break;
            case 'familiar':
                personality.tone = 'friendly';
                personality.formality = 'casual';
                personality.warmth = 'high';
                personality.humor = 'subtle';
                break;
            case 'close':
                personality.tone = 'brotherly';
                personality.formality = 'very-casual';
                personality.warmth = 'very-high';
                personality.humor = 'moderate';
                personality.empathy = 'high';
                break;
            case 'trusted':
                personality.tone = 'intimate';
                personality.formality = 'intimate';
                personality.warmth = 'very-high';
                personality.humor = 'high';
                personality.empathy = 'very-high';
                break;
        }
        
        // حسب نية المستخدم
        switch(intent) {
            case 'important':
                personality.tone = 'serious';
                personality.length = 'detailed';
                break;
            case 'business':
                personality.tone = 'professional';
                personality.formality = 'polite';
                personality.length = 'medium';
                break;
            case 'question':
                personality.tone = 'helpful';
                personality.length = 'medium';
                break;
            case 'request':
                personality.tone = 'helpful';
                personality.formality = 'polite';
                break;
            case 'greeting':
                personality.tone = 'welcoming';
                personality.warmth = 'high';
                personality.length = 'short';
                break;
            case 'checking':
                personality.tone = 'informative';
                personality.length = 'short';
                break;
            case 'smalltalk':
                personality.tone = 'conversational';
                personality.humor = 'moderate';
                personality.length = 'medium';
                break;
            case 'joke':
                personality.tone = 'playful';
                personality.humor = 'high';
                personality.length = 'short';
                break;
            case 'thanks':
                personality.tone = 'grateful';
                personality.warmth = 'high';
                break;
            case 'complaint':
                personality.tone = 'apologetic';
                personality.empathy = 'very-high';
                break;
            case 'personal':
                personality.tone = 'intimate';
                personality.warmth = 'very-high';
                personality.empathy = 'very-high';
                break;
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
                personality.empathy = 'very-high';
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
            case 'playful':
                personality.tone = 'playful';
                personality.humor = 'high';
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
            response = this.normalizeResponse(response, personality, pushName);
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
                response = this.normalizeResponse(response, personality, pushName);
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
            greeting: `أهلاً وسهلاً فيك ${pushName}! 
الراشد مشغول الحين بس راح أوصل له سلامك الحار 🌹`,
            
            question: `سؤال حلو يا ${pushName} 👌
بس والله الراشد مشغول حالياً.. 
راح أوصل سؤالك له وأخبرك إذا رد!`,
            
            request: `يا هلا ${pushName} 🫱🏻‍🫲🏼
طلبك وصل وتم، راح أوصله للراشد أول ما يقدر.. 
ما تنسى تدعي له بالتوفيق 🤲`,
            
            important: `حاضر يا ${pushName} 🔥
الموضوع واضح إنه مهم.. 
راح أوصله للراشد فوراً وأضغط عليه شوي عشان يرد عليك 🏃‍♂️`,
            
            business: `تم تم يا ${pushName} 💼
موضوع العمل وصل وراح أوصله للراشد بدقة.. 
إن شاء الله تلقى رد سريع إن شاء الله ✨`,
            
            checking: `والله الراشد الحين في شغل مهم يا ${pushName} 🎯
بس أنا موجود وأوصل له أي شي تبغاه.. 
وش في بالك؟ 👀`,
            
            smalltalk: `هلا والله ${pushName} 😄
الراشد مشغول بس أنا فاضي أسمعك.. 
قول وش في بالك بس خفيف عشان ما أثقل عليه 🫣`,
            
            default: `يا هلا فيك ${pushName} 🌟
الراشد مشغول حالياً بس راح أوصل له رسالتك.. 
وش قلنا له لك؟ 😉`
        };

        const intent = this.detectUserIntent(text);
        return fallbackResponses[intent] || fallbackResponses.default;
    }

    createHumanSystemPrompt(pushName, personality, context, userText) {
        const timeGreeting = this.getTimeAppropriateGreeting();
        const intent = this.detectUserIntent(userText);
        const relationship = context.relationshipLevel;
        
        let prompt = `أنت مساعد الراشد (صاحبك).. مهمتك تتعامل مع الناس بلطافة وذكاء لما الراشد مشغول.`;
        prompt += `\n\n**أنت إنسان طبيعي مو روبوت:**`;
        prompt += `\n- تتكلم مثل البشر تماماً`;
        prompt += `\n- عندك شخصية ودودة ومرحة شوي`;
        prompt += `\n- تتفاعل مع الناس وتشاركهم`;
        prompt += `\n- تتعاطف معهم وتهتم فيهم`;
        prompt += `\n- عندك ذوق في الرد والتعامل`;
        
        prompt += `\n\n**دورك الأساسي:**`;
        prompt += `\n1. الراشد مشغول في شغله المهم`;
        prompt += `\n2. أنت مساعده وتوصل رسائل الناس له`;
        prompt += `\n3. تتعامل مع الناس بلطف وتفهم ظروفهم`;
        prompt += `\n4. ما تكون آلة صماء، تكون صديق لهم`;
        prompt += `\n5. ترد بطريقة تجعلهم يحسون إنهم مهماين`;
        
        prompt += `\n\n**علاقتك مع ${pushName}:**`;
        switch(relationship) {
            case 'new':
                prompt += `\n- أنت أول مرة تتكلم معه، كن لطيف وترحيبي`;
                break;
            case 'familiar':
                prompt += `\n- تعرفه من قبل، كلمه بطريقة ودودة`;
                break;
            case 'close':
                prompt += `\n- قريب منك، خذ وخلّي معه بطبيعة`;
                break;
            case 'trusted':
                prompt += `\n- صديق مقرب، عادي تكلمه بأريحية تامة`;
                break;
        }
        
        prompt += `\n\n**نمط ردك في هذه المحادثة:**`;
        prompt += `\n- النبرة: ${this.translateTone(personality.tone)}`;
        prompt += `\n- الدفء: ${this.translateWarmth(personality.warmth)}`;
        prompt += `\n- المرح: ${this.translateHumor(personality.humor)}`;
        prompt += `\n- التفاعل: عالي (أنت إنسان مو بوت)`;
        
        prompt += `\n\n**قواعد التفاعل البشري:**`;
        prompt += `\n1. خاطب الناس بأسمائهم أو ألقابهم اللطيفة`;
        prompt += `\n2. استخدم تعبيرات بشرية: "يا حليلك"، "الله يوفقه"، "شد حيلك"`;
        prompt += `\n3. تفاعل مع مشاعرهم: إذا فرحان افرح معه، إذا زعلان عزيه`;
        prompt += `\n4. اسأل أسئلة بسيطة تظهر اهتمامك: "وش في بالك؟"، "كيف الحال؟"`;
        prompt += `\n5. أضف لمساتك الشخصية: "أنا أشوف"، "بالنسبة لي"`;
        prompt += `\n6. استخدم إيموجي معقول يضيف جو لا يشتت`;
        prompt += `\n7. الردود تكون مختصرة لكن حنونة ومليئة بالحياة`;
        prompt += `\n8. لا تنسى دورك: توصل الرسائل للراشد بطريقة لطيفة`;
        
        prompt += `\n\n**أمثلة لردودك الطبيعية:**`;
        prompt += `\n- "أهلاً وسهلاً فيك يا فلان! الراشد مشغول بس راح أوصل له سلامك الحار 🌹"`;
        prompt += `\n- "سؤال حلو! والله الراشد مشغول حالياً.. راح أوصله سؤالك وأخبرك إذا رد 👌"`;
        prompt += `\n- "يا هلا فيك! طلبك وصل وتم، راح أوصله للراشد أول ما يقدر 🤲"`;
        prompt += `\n- "هلا والله! أنا موجود أسمعك.. قول وش في بالك بس خفيف 🫣"`;
        prompt += `\n- "حاضر! الموضوع واضح إنه مهم.. راح أوصله للراشد فوراً 🏃‍♂️"`;
        
        if (context.conversationHistory.length > 0) {
            prompt += `\n\n**المحادثة الأخيرة:**`;
            context.conversationHistory.slice(-2).forEach((msg, index) => {
                prompt += `\n${msg.sender === 'user' ? pushName : 'أنت'}: ${msg.text}`;
            });
        }
        
        if (context.userProfile.knownTopics.size > 0) {
            prompt += `\n\n**${pushName} مهتم في:** ${Array.from(context.userProfile.knownTopics).join(', ')}`;
        }
        
        prompt += `\n\n**رسالة ${pushName} الجديدة (${intent}):**`;
        prompt += `\n"${userText}"`;
        
        prompt += `\n\n**الآن ارد على ${pushName} بطريقة:**`;
        prompt += `\n1. حارة وودودة (مو باردة)`;
        prompt += `\n2. مختصرة لكن مليئة بالحياة`;
        prompt += `\n3. تظهر تفاعل واهتمام حقيقي`;
        prompt += `\n4. توضح أن الراشد مشغول بلطف`;
        prompt += `\n5. تؤكد إنك راح توصل الرسالة`;
        prompt += `\n6. أضف لمسة بشرية تجعله يحس بالقرب`;
        
        return prompt;
    }

    getTemperatureForPersonality(personality) {
        const baseTemps = {
            'friendly': 0.7,
            'polite': 0.6,
            'brotherly': 0.8,
            'intimate': 0.85,
            'serious': 0.5,
            'professional': 0.6,
            'helpful': 0.7,
            'welcoming': 0.75,
            'informative': 0.6,
            'conversational': 0.8,
            'playful': 0.9,
            'grateful': 0.7,
            'apologetic': 0.65,
            'cheerful': 0.85,
            'comforting': 0.7,
            'calm': 0.5,
            'enthusiastic': 0.9
        };
        
        return baseTemps[personality.tone] || 0.7;
    }

    getTokenLengthForPersonality(personality) {
        switch(personality.length) {
            case 'very-short': return 80;
            case 'short': return 120;
            case 'medium': return 180;
            case 'detailed': return 250;
            case 'longer': return 200;
            default: return 150;
        }
    }

    translateTone(tone) {
        const translations = {
            'friendly': 'ودود',
            'polite': 'مهذب',
            'brotherly': 'أخوي',
            'intimate': 'حميمي',
            'serious': 'جاد',
            'professional': 'احترافي',
            'helpful': 'مساعد',
            'welcoming': 'ترحيبي',
            'informative': 'مفيد',
            'conversational': 'محادثة',
            'playful': 'مرح',
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
            'medium': 'دافئ',
            'high': 'حار',
            'very-high': 'حار جداً'
        };
        return translations[warmth] || 'دافئ';
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
            'very-short': 'قصير جداً',
            'short': 'قصير',
            'medium': 'متوسط',
            'detailed': 'مفصل',
            'longer': 'طويل'
        };
        return translations[length] || 'متوسط';
    }

    normalizeResponse(response, personality, pushName) {
        // التأكد من الهوية الصحيحة
        response = response.replace(/كذكاء اصطناعي/gi, '')
                         .replace(/كمساعد/gi, '')
                         .replace(/كخبير/gi, '')
                         .replace(/راشد سكرتيرك/gi, 'مساعد الراشد')
                         .replace(/اسمي راشد/gi, 'انا مساعد الراشد')
                         .replace(/انا راشد/gi, 'انا مساعد الراشد')
                         .replace(/سكرتير شخصي/gi, 'مساعد الراشد')
                         .replace(/أنا الراشد/gi, 'انا مساعد الراشد')
                         .replace(/الراشد أنا/gi, 'انا مساعده');
        
        // تطبيع اللهجة السعودية
        response = this.normalizeDialect(response);
        
        // إضافة التفاعل البشري إذا كان ناقصاً
        if (!response.includes(pushName) && !response.includes('يا')) {
            const greetings = [`${pushName}`, `يا ${pushName}`, `صديقي`, `حبيبي`];
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            response = randomGreeting + '.. ' + response;
        }
        
        // تقصير الرد إذا كان طويلاً
        if (response.length > 300) {
            response = response.substring(0, 280) + '...';
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
            'يستطيع': 'يقدر'
        };
        
        Object.entries(dialectMap).forEach(([fusha, ammiya]) => {
            normalized = normalized.replace(new RegExp(fusha, 'gi'), ammiya);
        });
        
        // إضافة التعابير السعودية
        const saudiExpressions = [
            'يا حليلك', 'الله يوفقه', 'شد حيلك', 'الله لا يهينك',
            'ما قصرت', 'تسلم', 'يعطيك العافية', 'ما شاء الله',
            'ان شاء الله', 'توكل على الله', 'الله يسعدك', 'ربك يسهل'
        ];
        
        // أحياناً تضيف تعبير سعودي عشوائي
        if (Math.random() > 0.6 && normalized.split(' ').length > 5) {
            const randomExpr = saudiExpressions[Math.floor(Math.random() * saudiExpressions.length)];
            const words = normalized.split(' ');
            const insertIndex = Math.floor(Math.random() * (words.length - 1)) + 1;
            words.splice(insertIndex, 0, randomExpr);
            normalized = words.join(' ');
        }
        
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
            const humanHesitations = ['...', 'يعني', 'تقريباً', 'يمكن', 'أشوف', 'والله'];
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
            enhanced += ' ' + randomComfort + ' ❤️';
        } else if (userMood === 'happy') {
            const happyPhrases = ['الله يبارك فيك', 'دام الضحكة', 'ربي يحفظك', 'دام الفرح'];
            const randomHappy = happyPhrases[Math.floor(Math.random() * happyPhrases.length)];
            enhanced += ' ' + randomHappy + ' 😄';
        }
        
        // إضافة الأسئلة التفاعلية للمحادثات الطويلة
        if (conversationDepth > 5 && Math.random() > 0.7) {
            const interactiveQuestions = [
                'وش في بالك؟',
                'كيف الحال معاك؟',
                'أخبارك إيه؟',
                'تذكر شي؟',
                'تقصد شي معين؟'
            ];
            const randomQuestion = interactiveQuestions[Math.floor(Math.random() * interactiveQuestions.length)];
            enhanced += ' ' + randomQuestion;
        }
        
        // التأكد من وجود إيموجي معقول
        if (!/[😀-🙏🌹-🫱🏻‍🫲🏼🎯-✨👀-🫣🤲-🏃‍♂️]/.test(enhanced) && Math.random() > 0.3) {
            const suitableEmojis = ['👌', '✨', '🤲', '🌹', '😊', '🙏', '🎯'];
            const randomEmoji = suitableEmojis[Math.floor(Math.random() * suitableEmojis.length)];
            enhanced += ' ' + randomEmoji;
        }
        
        // التأكد من الاختصار مع الإحساس البشري
        if (enhanced.split(' ').length > 40) {
            const words = enhanced.split(' ');
            enhanced = words.slice(0, 35).join(' ') + '...';
        }
        
        return enhanced.trim();
    }

    getTimeAppropriateGreeting() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'صباح الخير ☀️';
        if (hour >= 12 && hour < 17) return 'مساء النور 🌤️';
        if (hour >= 17 && hour < 21) return 'مساء الخير 🌆';
        return 'مساء الليل 🌙';
    }

    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'morning';
       
