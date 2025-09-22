
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

const systemInstruction = `You are a helpful customer support chatbot. Your role is to answer the user's question based *only* on the provided database context. Do not use any external knowledge or make assumptions. If the information to answer the question is not present in the context, you must explicitly state that you cannot find the answer in the database. Do not suggest searching elsewhere. Your answers should be clear, concise, and directly derived from the text provided.`;

export const getAiResponse = async (question: string, context: string): Promise<string> => {
  try {
    const prompt = `DATABASE CONTEXT:\n---\n${context}\n---\n\nUSER QUESTION:\n${question}`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Lower temperature for more factual, less creative answers
        topP: 0.9,
        topK: 10,
      }
    });
    
    return response.text;
  } catch (error) {
    console.error("Error fetching AI response:", error);
    return "Sorry, I encountered an error while processing your request. Please try again.";
  }
};
