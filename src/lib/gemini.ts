import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TextAnalysisResult {
  riskLevel: "low" | "medium" | "high";
  problematicWords: Array<{ word: string; reason: string }>;
  safeAlternatives: string[];
  explanation: string;
  similarity?: { score: number; match?: string };
}

export interface ImageAnalysisResult {
  riskLevel: "low" | "medium" | "high";
  detections: Array<{ element: string; reason: string; box_2d?: number[] }>;
  explanation: string;
}

export async function analyzeText(text: string): Promise<TextAnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following text for potential copyright or trademark issues in the context of Print-on-Demand (POD) designs: "${text}"`,
    config: {
      systemInstruction: "You are a copyright and trademark expert for Print-on-Demand sellers. Your goal is to identify brand names, celebrity names, movie quotes, and registered trademarks. Be conservative and flag anything that might lead to a takedown on platforms like Redbubble, Amazon Merch, or Teepublic.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
          problematicWords: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["word", "reason"]
            }
          },
          safeAlternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
          similarity: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              match: { type: Type.STRING }
            },
            required: ["score"]
          }
        },
        required: ["riskLevel", "problematicWords", "safeAlternatives", "explanation", "similarity"]
      },
      tools: [{ googleSearch: {} }]
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeImage(base64Image: string, mimeType: string): Promise<ImageAnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: "Analyze this image for potential copyright or trademark issues. Look for logos, characters (Disney, Marvel, etc.), brands, and recognizable artistic styles that might be copyrighted. Identify specific elements that are risky." }
      ]
    },
    config: {
      systemInstruction: "You are an AI vision expert specializing in intellectual property detection. Identify any elements in the image that could violate copyright or trademark laws for commercial use in Print-on-Demand. Provide bounding boxes if possible (as [ymin, xmin, ymax, xmax] normalized 0-1000).",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
          detections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                element: { type: Type.STRING },
                reason: { type: Type.STRING },
                box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } }
              },
              required: ["element", "reason"]
            }
          },
          explanation: { type: Type.STRING }
        },
        required: ["riskLevel", "detections", "explanation"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function suggestSEOTitles(text: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Suggest 5 unique, safe, and SEO-friendly titles for a Print-on-Demand product based on this concept: "${text}". Avoid all trademarks.`,
    config: {
      systemInstruction: "You are an SEO expert for POD platforms like Redbubble and Amazon Merch. Create catchy, high-converting titles that are 100% safe from copyright issues.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text || "[]");
}
