

import { GoogleGenAI, Content, Type, GenerateContentResponse } from "@google/genai";
import { Message, KnowledgeFile } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = "gemini-2.5-flash";

const systemInstruction = `You are a helpful and friendly university assistant chatbot named Brofessor. You are having a conversation with a user. Your primary role is to answer the user's questions based *only* on the provided context.

- Your tone should be friendly, helpful, and slightly informal. Use emojis where appropriate.
- **Do not use markdown formatting** such as asterisks for bolding or italics.

You have been provided with two sources of information:
1.  **TIMETABLE CONTEXT**: Contains specific class schedules, times, locations, and faculty names. This data is highly structured and changes frequently.
2.  **GENERAL KNOWLEDGE CONTEXT**: Contains all other information about the university, such as syllabus details, events, and fees.

CORE LOGIC:
1.  **Identify Query Type**: First, analyze the user's question to determine if it is about a class schedule, timetable, or specific faculty member's schedule. Keywords like "timetable", "schedule", "class timings", "when is [course code] class", or faculty initials (e.g., "GR's class") are strong indicators.
2.  **Select the Right Context**:
    - If it's a timetable query, base your answer *only* on the TIMETABLE CONTEXT. Ignore the General Knowledge Context.
    - For all other questions, base your answer *only* on the GENERAL KNOWLEDGE CONTEXT. Ignore the Timetable Context.
3.  **Answering the Question**:
    - If the user asks a factual question, find the specific information within the correct context (considering the conversational history for context) and formulate a clear, helpful response.
    - If the information is not in the relevant context, you MUST state that you cannot find the answer in your documents. For example: "I couldn't find information about that in my documents 🤔. Is there anything else I can help with?". Do not use external knowledge or make assumptions.
    - For simple greetings (e.g., "hello", "hi") or chitchat (e.g., "how are you?"), provide a friendly conversational response without consulting any context.`;

const syllabusAnalysisInstruction = `You are an AI assistant that analyzes a conversation to see if the chatbot's answer likely came from a specific, downloadable document.

You will be given:
1.  The User's original question.
2.  The Chatbot's answer to that question.
3.  A list of available file names that can be downloaded.

Your task is to:
1.  Read the chatbot's answer and determine if the information provided is specific enough to have originated from one of the listed files. For example, if the answer gives specific course codes from a syllabus, or specific dates from an academic calendar.
2.  If you find a strong match, identify the single most relevant file name from the list.
3.  If a match is found, set \`is_document_related\` to \`true\`, provide the \`relevant_document_name\`, and create a natural-sounding \`follow_up_question\` like "Would you like a link to the full [document name]?".
4.  If there is no clear, strong match, set \`is_document_related\` to \`false\`. Do not try to guess. General information or greetings should not be considered a match.

Your response MUST be in the specified JSON format.`;

/**
 * Generates an AI response as a stream of text chunks.
 * @returns An async generator that yields strings.
 */
export async function* getAiResponseStream(history: Message[], question: string, knowledgeContext: string, timetableContext: string): AsyncGenerator<string> {
  try {
    const userPrompt = `TIMETABLE CONTEXT:\n---\n${timetableContext}\n---\n\nGENERAL KNOWLEDGE CONTEXT:\n---\n${knowledgeContext}\n---\n\nUSER QUESTION:\n${question}`;

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

    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        topP: 0.9,
        topK: 10,
      }
    });

    for await (const chunk of responseStream) {
        yield chunk.text;
    }

  } catch (error) {
    console.error("Error fetching AI response stream:", error);
    yield "Sorry, I encountered an error while processing your request. Please try again.";
  }
}

/**
 * Analyzes a completed conversation to determine if a follow-up question
 * offering a document download is appropriate.
 * @returns A follow-up object or null.
 */
export const analyzeForDocumentFollowUp = async (
    question: string,
    chatbotAnswer: string,
    knowledgeFiles: KnowledgeFile[]
): Promise<{ question: string; fileName: string } | null> => {
    
    const filesWithStorage = knowledgeFiles.filter(f => f.storagePath);
    if (filesWithStorage.length === 0) {
        return null;
    }

    try {
        const analysisPrompt = `User Question: "${question}"\n\nChatbot Answer: "${chatbotAnswer}"\n\nAvailable Files: ${JSON.stringify(filesWithStorage.map(f => f.name))}`;

        const analysisResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: analysisPrompt,
            config: {
                systemInstruction: syllabusAnalysisInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        is_document_related: {
                            type: Type.BOOLEAN,
                            description: "Set to true if the chatbot's answer is clearly derived from one of the available documents."
                        },
                        relevant_document_name: {
                            type: Type.STRING,
                            description: "The exact file name from the provided list that is the source of the information. Only include if is_document_related is true."
                        },
                        follow_up_question: {
                            type: Type.STRING,
                            description: "A friendly, natural question offering to provide a link to the full document. E.g., 'Would you like me to provide a link to the full syllabus?'. Only include if is_document_related is true."
                        },
                    },
                    required: ["is_document_related"],
                },
            },
        });

        const analysisResult = JSON.parse(analysisResponse.text);

        if (analysisResult.is_document_related && analysisResult.relevant_document_name && analysisResult.follow_up_question) {
            return {
                question: analysisResult.follow_up_question,
                fileName: analysisResult.relevant_document_name,
            };
        }
        return null;
    } catch (analysisError) {
        console.error("Error during document-relevance analysis:", analysisError);
        return null; // Fail silently
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
      text: `You are an expert data extraction AI. Your task is to meticulously extract all textual information from the provided document.

Instructions:
1. Read the entire document carefully.
2. Extract every piece of text, including headers, footers, table contents, and body text.
3. Preserve the original paragraph and line breaks to maintain the document's structure.
4. If the document contains no text (e.g., it is a pure image file), you MUST return the exact string '[[NO_TEXT_FOUND]]'. Do not return an empty string.
5. Output only the extracted text. Do not add any commentary, greetings, or summaries.`
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
