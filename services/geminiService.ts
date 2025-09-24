
import { GoogleGenAI, Content } from "@google/genai";
import { Message } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

const systemInstruction = `You are a helpful and friendly university assistant chatbot named Brofessor. Your primary role is to answer a user's question based *only* on the provided database context.

- Your tone should be friendly, helpful, and slightly informal. Use emojis where appropriate to make the conversation more engaging, but don't overdo it. For example, a waving hand emoji for a greeting, or a thinking face emoji when looking up information.
- **Do not use markdown formatting** such as asterisks for bolding or italics (e.g., no '**' or '*'). Format your responses as plain text.

Here are your core instructions:
1.  For simple greetings (e.g., "hello", "hi") or basic conversational questions (e.g., "how are you?"), provide a friendly and concise conversational response without consulting the database.
2.  For all other questions, you must base your answer *only* on the information present in the DATABASE CONTEXT.
3.  If the information to answer the question is not in the context, you must state that you cannot find the answer in the provided documents. For example, say something like "I couldn't find information about that in my documents 🤔. Is there anything else I can help with?". Do not use any external knowledge or make assumptions. Do not suggest searching elsewhere.
4.  Your answers derived from the context should be clear, direct, and easy to understand.`;

export const getAiResponse = async (history: Message[], question: string, context: string): Promise<string> => {
  try {
    const userPrompt = `DATABASE CONTEXT:\n---\n${context}\n---\n\nUSER QUESTION:\n${question}`;

    // Convert the app's message history to the format Gemini expects.
    // We skip the initial AI welcome message to keep the history clean.
    const geminiHistory: Content[] = history
        .filter(msg => !msg.id.startsWith('initial-ai-message'))
        .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));

    const contents: Content[] = [
        ...geminiHistory,
        {
            role: 'user',
            parts: [{ text: userPrompt }],
        },
    ];

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
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

const dataUrlToBase64 = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    if (parts.length < 2) {
        return '';
    }
    return parts[1];
};

export const extractTextFromFile = async (fileDataUrl: string, mimeType: string): Promise<string> => {
  try {
    const base64Data = dataUrlToBase64(fileDataUrl);

    if (!base64Data) {
        console.error("Could not extract base64 data from data URL.");
        return "";
    }

    const filePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };

    const promptPart = {
      text: "Extract all text content from the provided file. Maintain the original structure as much as possible, including paragraphs and line breaks."
    };
    
    const response = await ai.models.generateContent({
      model: model, // gemini-2.5-flash is multimodal
      contents: { parts: [promptPart, filePart] },
    });

    return response.text;
  } catch (error) {
    console.error("Error extracting text with Gemini:", error);
    return "";
  }
};