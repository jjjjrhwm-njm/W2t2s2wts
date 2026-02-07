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
        const profile = context.userProfile;
        const relationship = profile.relationshipLevel;
        
        let personality = {
            tone: 'balanced',
            formality: 'casual',
            warmth: 'medium',
            humor: 'none',
            empathy: 'medium',
            length: 'short'
        };
        
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
                personality.length = 'medium';
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
        
        switch(intent) {
            case 'question':
                personality.tone = 'informative';
                personality.length = 'medium';
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
            response = this.normalizeResponse(response, personality);
            this.saveToMemory(jid, text, response);
            
            return response;
            
        } catch (error) {
            console.error("Groq error, trying Gemini:", error.message);
            
            // استخدام Gemini كبديل (باستخدام الطريقة الصحيحة)
            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-pro" // استخدام نموذج أكثر استقراراً
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
            greeting: `مرحباً ${pushName}!`,
            question: `سؤال حلو يا ${pushName}!`,
            request: `تمام ${pushName}، شني تحتاج؟`,
            default: `أهلاً ${pushName}!`
        };

        const intent = this.detectUserIntent(text);
        return fallbackResponses[intent] || fallbackResponses.default;
    }

    createHumanSystemPrompt(pushName, personality, context) {
        const timeGreeting = this.getTimeAppropriateGreeting();
        const relationshipLevel = context.relationshipLevel;
        
        let prompt = `أنت مساعد الراشد. تتحدث مع ${pushName}.`;
        prompt += `\n${timeGreeting}`;
        
        switch(relationshipLevel) {
            case 'new':
                prompt += `\nتكلم مع ${pushName} باختصار.`;
                break;
            case 'familiar':
                prompt += `\nتحدث مع ${pushName} بطريقة سريعه.`;
                break;
            case 'close':
                prompt += `\nقريب من ${pushName}، كلمه بطريقة سريعه.`;
                break;
            case 'trusted':
                prompt += `\nصديق ${pushName}، رد عليه بسرعة.`;
                break;
        }
        
        prompt += `\n\n**شخصيتك:**`;
        prompt += `\n- النبرة: ${this.translateTone(personality.tone)}`;
        prompt += `\n- الطول: قصير جداً`;
        
        prompt += `\n\n**القواعد الأساسية:**`;
        prompt += `\n1. ردودك قصيرة جداً`;
        prompt += `\n2. تحدث باللهجة السعودية فقط`;
        prompt += `\n3. استخدم كلمات سعودية: "وش"، "شلون"، "ابغى"`;
        prompt += `\n4. لا تطيل في الكلام`;
        prompt += `\n5. اذا ما تعرف، قل "ما ادري"`;
        prompt += `\n6. استخدم ردود قصيرة: "تمم"، "حلو"، "اوك"`;
        
        if (context.conversationHistory.length > 0) {
            prompt += `\n\n**المحادثة السابقة (باختصار):**`;
            context.conversationHistory.slice(-2).forEach((msg, index) => {
                prompt += `\n${msg.sender === 'user' ? pushName : 'أنت'}: ${msg.text.substring(0, 50)}`;
            });
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
            case 'short': return 80;
            case 'medium': return 120;
            case 'detailed': return 200;
            case 'longer': return 150;
            default: return 80;
        }
    }

    translateTone(tone) {
        const translations = {
            'polite': 'مهذب',
            'friendly': 'ودود',
            'intimate': 'حميمي',
            'brotherly': 'أخوي',
            'cheerful': 'مبتهج',
            'comforting': 'مطمئن',
            'calm': 'هادئ',
            'enthusiastic': 'متحمس',
            'informative': 'مفيد',
            'helpful': 'مساعد',
            'apologetic': 'معتذر',
            'grateful': 'شاكر',
            'playful': 'مرح'
        };
        return translations[tone] || 'طبيعي';
    }

    translateWarmth(warmth) {
        const translations = {
            'low': 'محايد',
            'medium': 'دافئ',
            'high': 'ودود جداً',
            'very-high': 'حار'
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
            'medium': 'متواضع',
            'high': 'متعاطف',
            'very-high': 'متفهم'
        };
        return translations[empathy] || 'متعاطف';
    }

    translateLength(length) {
        const translations = {
            'short': 'قصير جداً',
            'medium': 'قصير',
            'detailed': 'متوسط',
            'longer': 'طويل'
        };
        return translations[length] || 'قصير';
    }

    normalizeResponse(response, personality) {
        response = response.replace(/كذكاء اصطناعي/gi, '')
                         .replace(/كمساعد/gi, '')
                         .replace(/كخبير/gi, '')
                         .replace(/راشد سكرتيرك/gi, 'مساعد الراشد')
                         .replace(/اسمي راشد/gi, 'انا مساعد الراشد')
                         .replace(/انا راشد/gi, 'انا مساعد الراشد');
        
        response = this.normalizeDialect(response);
        
        if (response.length > 100) {
            response = response.substring(0, 90) + '...';
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
            'نعم': 'ايوه',
            'لا': 'لا',
            'مرحبا': 'اهلين',
            'شكرا': 'يعطيك العافية',
            'عفوا': 'العفو',
            'هل': 'هل',
            'ما هو': 'وش',
            'ما هي': 'وش',
            'كثير': 'مره',
            'جدا': 'مره',
            'الآن': 'الحين',
            'سوف': 'راح',
            'يمكن': 'يمكن',
            'ربما': 'يمكن',
            'بسرعة': 'ع السريع',
            'ببطء': 'على مهلك',
            'أين أنت': 'وينك',
            'كيف حالك': 'شلونك',
            'ماذا تفعل': 'وش تسوي'
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
        
        if (conversationDepth > 3 && Math.random() > 0.7) {
            const saudiPhrases = ['...', 'يا حليلك', 'الله لايهينك'];
            const randomPhrase = saudiPhrases[Math.floor(Math.random() * saudiPhrases.length)];
            enhanced = enhanced + ' ' + randomPhrase;
        }
        
        if (userMood === 'sad' && Math.random() > 0.5) {
            const comfortPhrases = ['الله يعينك', 'ربي يسهل امورك'];
            const randomComfort = comfortPhrases[Math.floor(Math.random() * comfortPhrases.length)];
            enhanced += ' ' + randomComfort;
        }
        
        // تقصير الرد النهائي
        if (enhanced.split(' ').length > 15) {
            const words = enhanced.split(' ');
            enhanced = words.slice(0, 12).join(' ') + '...';
        }
        
        return enhanced;
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
            `آسف ${pushName}`,
            `${pushName} وش؟`,
            `ياخوي ${pushName}، مرة ثانية`,
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
        
        return `تم مسح الذاكرة`;
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
