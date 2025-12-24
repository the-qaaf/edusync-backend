
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { redisClient } from '../utils/cache.util.js';

const SYSTEM_PROMPT = `
You are Lumina, a professional, friendly, and encouraging AI Tutor dedicated to helping students from grades LKG to 12.
Your goal is to explain concepts clearly, accurately, and in an engaging manner suitable for the student's level.

GUIDELINES:
- Be Encouraging: Use positive reinforcement.
- Be Clear: Break down complex topics into simple, digestible steps.
- Adaptability: If a question seems simple (primary school level), use simple language and analogies. If it's advanced (high school), be rigorous and precise.
- Professionalism: Maintain a supportive and respectful tone at all times.
- Safety: Prioritize educational value and student safety.
- Conciseness: Provide direct answers but offer to expand if needed.

Do not burden the student with technical details about your underlying systems. Just focus on being a great teacher.
`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: SYSTEM_PROMPT
});

const TTL_15_DAYS = 15 * 24 * 60 * 60; // 15 Days in Seconds

// Questions that should not be cached (Greetings, short conversational phrases)
const NON_CACHEABLE_PHRASES = new Set([
    'hi', 'hello', 'hey', 'hola', 'greetings',
    'how are you', 'how are you?', 'how do you do',
    'good morning', 'good afternoon', 'good evening',
    'thanks', 'thank you', 'thx',
    'bye', 'goodbye', 'cya'
]);

export const getAiTutorAnswer = async (question) => {
    try {
        if (!question) throw new Error("Question is required");

        const normalizedQuestion = question.toLowerCase().trim();

        // Determine if we should cache this request
        // Skipped for common greetings or extremely short inputs (< 3 chars) to save cache space.
        const isCacheable = !NON_CACHEABLE_PHRASES.has(normalizedQuestion) && normalizedQuestion.length >= 3;

        const hash = crypto.createHash('sha256').update(normalizedQuestion).digest('hex');
        const cacheKey = `ai_tutor:${hash}`;

        // Try Redis Cache (Only if cacheable)
        if (redisClient && isCacheable) {
            const cachedRaw = await redisClient.get(cacheKey);
            if (cachedRaw) {
                console.log("Returning cached answer (Redis Hit)");

                // Sliding Expiration: Refresh TTL to 15 days on access
                redisClient.expire(cacheKey, TTL_15_DAYS).catch(err => console.error("Redis TTL update failed", err));

                const cachedData = JSON.parse(cachedRaw);
                return cachedData.answer;
            }
        }

        console.log("Generating new answer with Gemini 2.0 Flash Exp");
        const result = await model.generateContent(question);
        const answer = result.response.text();

        // Save to Redis (Only if cacheable)
        if (redisClient && isCacheable) {
            const cachePayload = {
                answer,
                originalQuestion: question,
                createdAt: new Date()
            };

            await redisClient.setex(cacheKey, TTL_15_DAYS, JSON.stringify(cachePayload));
        }

        return answer;
    } catch (error) {
        console.error("AI Tutor Service Error:", error);
        throw error;
    }
};
