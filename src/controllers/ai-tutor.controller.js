
import { getAiTutorAnswer } from '../services/ai-tutor.service.js';

export const askAiTutor = async (req, res) => {
  try {
    const { question } = req.body;
    console.log("🚀 ~ askAiTutor ~ question:", question)

    if (!question) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }

    const answer = await getAiTutorAnswer(question);
    console.log("🚀 ~ askAiTutor ~ answer:", answer)

    return res.status(200).json({
      success: true,
      data: {
        answer
      }
    });
  } catch (error) {
    console.error('AI Tutor Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
