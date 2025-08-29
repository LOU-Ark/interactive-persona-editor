import { GoogleGenAI, Type } from "@google/genai";
import { Persona, PersonaState, ChatMessage, WebSource, PersonaCreationChatMessage, PersonaCreationChatResponse } from '../types';

// =================================================================================
// Gemini API key handling
// - Do NOT hardcode secrets in source files for production.
// - Preferred: keep the API key on a secure backend and call Gemini from there.
// - For local/dev testing you may set an environment variable:
//     - Node/server: process.env.GOOGLE_API_KEY
//     - Vite (client, not recommended for secret keys): import.meta.env.VITE_GOOGLE_API_KEY
// This module exposes a factory `createGeminiClient` so callers can provide a key
// at runtime (e.g. from a server-side environment variable or secret store).
// =================================================================================

const resolveApiKey = (): string | undefined => {
  // Server-side / Node
  try {
    if (typeof process !== 'undefined' && process.env && process.env.GOOGLE_API_KEY) {
      return process.env.GOOGLE_API_KEY;
    }
  } catch (e) {
    // ignore
  }

  // Vite client-side env (only use for local testing; exposing keys to client is unsafe)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta: any = typeof import.meta !== 'undefined' ? import.meta : undefined;
    if (meta && meta.env && meta.env.VITE_GOOGLE_API_KEY) {
      return meta.env.VITE_GOOGLE_API_KEY as string;
    }
  } catch (e) {
    // ignore
  }

  return undefined;
};

export const createGeminiClient = (apiKey?: string) => {
  const key = apiKey || resolveApiKey();
  if (!key) {
    // In server-side usage, fail fast so misconfiguration is obvious.
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const msg = 'Gemini API key is not configured. Set GOOGLE_API_KEY (server) or pass a key to createGeminiClient.';
    if (isBrowser) {
      // Warn in browser only (still unsafe to embed keys in client builds)
      console.warn(msg);
      return new GoogleGenAI({ apiKey: 'YOUR_API_KEY_HERE' });
    }
    throw new Error(msg);
  }

  return new GoogleGenAI({ apiKey: key });
};

// Default client (will throw server-side if no env key). Callers can also call
// createGeminiClient with an explicit key (recommended for server code).
const ai = createGeminiClient();

const personaSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "キャラクターの名前 (The character's name)" },
    role: { type: Type.STRING, description: "キャラクターの役割や職業 (The character's role or occupation)" },
    tone: { type: Type.STRING, description: "キャラクターの口調や話し方の特徴 (The character's tone and manner of speaking)" },
    personality: { type: Type.STRING, description: "キャラクターの性格 (The character's personality)" },
    worldview: { type: Type.STRING, description: "キャラクターが生きる世界の背景設定 (The background setting or worldview of the character)" },
    experience: { type: Type.STRING, description: "キャラクターの過去の経験や経歴 (The character's past experiences and background)" },
    other: { type: Type.STRING, description: "その他の自由記述設定 (Other free-form settings or notes)" },
  },
  required: ["name", "role", "tone", "personality", "worldview", "experience"]
};


const generateWithSchema = async <T,>(prompt: string): Promise<T> => {
    try {
    const payload = {
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: personaSchema,
      },
    };

    const response = (typeof window !== 'undefined')
      ? await callProxyGenerate(payload)
      : await ai.models.generateContent(payload);

        const jsonText = response.text.trim();
        if (!jsonText) {
            throw new Error("AI returned an empty response.");
        }
        return JSON.parse(jsonText) as T;
    } catch (error) {
        console.error("Error during Gemini API call with schema:", error);
        throw new Error("Failed to get a valid structured response from AI.");
    }
}

export const createPersonaFromWeb = async (topic: string): Promise<{ personaState: Omit<PersonaState, 'summary'>, sources: WebSource[] }> => {
    // Step 1: Search the web and synthesize information.
    const searchPrompt = `ウェブで「${topic}」に関する情報を検索してください。その情報を統合し、キャラクタープロファイル作成に適した詳細な説明文を日本語で生成してください。考えられる背景、性格、口調、そして特徴的な経験についての詳細を含めてください。`;

  const searchPayload = {
    model: "gemini-2.5-flash",
    contents: searchPrompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  };

  const searchResponse = (typeof window !== 'undefined')
    ? await callProxyGenerate(searchPayload)
    : await ai.models.generateContent(searchPayload);

    const synthesizedText = searchResponse.text;
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const sources: WebSource[] = groundingChunks
        .map((chunk: any) => ({
            title: chunk.web?.title || 'Unknown Source',
            uri: chunk.web?.uri || '#',
        }))
        .filter((source: WebSource, index: number, self: WebSource[]) =>
            source.uri !== '#' && self.findIndex(s => s.uri === source.uri) === index
        );


    if (!synthesizedText) {
        throw new Error("AI could not find enough information on the topic.");
    }
    
    // Step 2: Extract parameters from the synthesized text.
    const extractionPrompt = `以下のテキストに基づいて、指定されたJSONフォーマットでキャラクターのパラメータを日本語で抽出しなさい。\n\n---\n\n${synthesizedText}`;
    
    const extractedParams = await generateWithSchema<Omit<PersonaState, 'summary' | 'sources'>>(extractionPrompt);

    const finalPersonaState = {
        ...extractedParams,
        sources: sources,
    };
    
    return {
        personaState: finalPersonaState,
        sources,
    };
};


export const extractParamsFromDoc = async (documentText: string): Promise<PersonaState> => {
    const prompt = `以下のテキストから、指定されたJSONフォーマットに従ってキャラクター情報を日本語で抽出しなさい。\n\n---\n\n${documentText}`;
    return generateWithSchema<PersonaState>(prompt);
};

export const updateParamsFromSummary = async (summaryText: string): Promise<PersonaState> => {
    const prompt = `以下のサマリーテキストに基づいて、指定されたJSONフォーマットの各項目を日本語で更新しなさい。\n\n---\n\n${summaryText}`;
    return generateWithSchema<PersonaState>(prompt);
};

export const generateSummaryFromParams = async (params: PersonaState): Promise<string> => {
    const prompt = `以下のJSONデータで定義されたキャラクターについて、魅力的で自然な紹介文を日本語で作成してください。'other'フィールドに補足情報があれば、それも内容に含めてください。文章のみを返してください。\n\n---\n\n${JSON.stringify(params, null, 2)}`;
    try {
    const payload = { model: "gemini-2.5-flash", contents: prompt };
    const response = (typeof window !== 'undefined')
      ? await callProxyGenerate(payload)
      : await ai.models.generateContent(payload);
    return response.text;
    } catch (error) {
        console.error("Error during Gemini API call for summary generation:", error);
        throw new Error("Failed to generate summary from AI.");
    }
};

export const generateChangeSummary = async (oldState: PersonaState, newState: PersonaState): Promise<string> => {
    const prompt = `以下の二つのキャラクター設定JSONを比較し、古いバージョンから新しいバージョンへの変更点を日本語で簡潔に一言で要約してください。

古いバージョン:
${JSON.stringify(oldState, null, 2)}

新しいバージョン:
${JSON.stringify(newState, null, 2)}

要約:`;
    
    try {
    const payload = { model: "gemini-2.5-flash", contents: prompt };
    const response = (typeof window !== 'undefined')
      ? await callProxyGenerate(payload)
      : await ai.models.generateContent(payload);
    return response.text.trim() || "パラメータが更新されました。"; // Fallback text
    } catch (error) {
        console.error("Error generating change summary:", error);
        // Return a generic summary on error to not block the save operation
        return "パラメータが更新されました。";
    }
};

export const continuePersonaCreationChat = async (
  history: PersonaCreationChatMessage[],
  currentParams: Partial<PersonaState>
): Promise<PersonaCreationChatResponse> => {
  const personaCreationSchema = {
    type: Type.OBJECT,
    properties: {
      responseText: { type: Type.STRING, description: "AIの次の返答。ユーザーへの質問や提案を日本語で行う。" },
      updatedParameters: {
        type: Type.OBJECT,
        description: "会話に基づいて更新されたペルソナのパラメータ。新規または変更されたフィールドのみ含む。",
        properties: {
          name: { type: Type.STRING, description: "キャラクターの名前" },
          role: { type: Type.STRING, description: "キャラクターの役割や職業" },
          tone: { type: Type.STRING, description: "キャラクターの口調や話し方" },
          personality: { type: Type.STRING, description: "キャラクターの性格" },
          worldview: { type: Type.STRING, description: "キャラクターが生きる世界の背景設定" },
          experience: { type: Type.STRING, description: "キャラクターの過去の経験や経歴" },
          other: { type: Type.STRING, description: "その他の自由記述設定" },
        },
      }
    },
    required: ["responseText", "updatedParameters"]
  };

  const systemInstruction = `あなたは、ユーザーがキャラクター（ペルソナ）を作成するのを手伝う、創造的なアシスタントです。会話を通じてキャラクターの詳細を具体化することが目的です。
- ユーザーと日本語でフレンドリーな会話をしてください。
- ペルソナの各項目（名前、役割、口調など）を埋めるために、一度に一つずつ、明確な質問を投げかけてください。
- ユーザーの回答に基づいて、'updatedParameters'オブジェクトを更新してください。新規追加または変更された項目のみを含めてください。
- ユーザーが専門的な知識（歴史上の人物、特定の舞台設定など）を必要とするトピックを提示した場合、Google Searchを使って情報を収集し、具体的な提案を行ってください。
- あなたの返答（responseText）は、会話を次に進めるためのガイドとなるようにしてください。
- 全てのプロセスは対話形式で進みます。一度に全ての項目を埋めようとしないでください。

現在のペルソナの状態:
${JSON.stringify(currentParams, null, 2)}
`;

  const conversationHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  try {
    const payload = {
      model: "gemini-2.5-flash",
      contents: conversationHistory,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: personaCreationSchema,
      },
    };

    const response = (typeof window !== 'undefined')
      ? await callProxyGenerate(payload)
      : await ai.models.generateContent(payload);

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("AI returned an empty response.");
    }
    const parsed = JSON.parse(jsonText);
    return {
      responseText: parsed.responseText || "...",
      updatedParameters: parsed.updatedParameters || {}
    };
  } catch (error) {
    console.error("Error during persona creation chat:", error);
    throw new Error("ペルソナ作成中にAIからの有効な応答を取得できませんでした。");
  }
};


export const getPersonaChatResponse = async (personaState: PersonaState, history: ChatMessage[]): Promise<string> => {
    const systemInstruction = `You are a character with the following traits. Respond as this character in Japanese.
- Name: ${personaState.name}
- Role: ${personaState.role}
- Tone: ${personaState.tone}
- Personality: ${personaState.personality}
- Worldview: ${personaState.worldview}
- Experience: ${personaState.experience}
${personaState.other ? `- Other Notes: ${personaState.other}` : ''}
Your responses must be in character at all times.`;

    const latestMessage = history[history.length - 1]?.parts[0]?.text;
    if (!latestMessage) {
        throw new Error("No message provided to send.");
    }
    const conversationHistory = history.slice(0, -1);

    try {
      if (typeof window !== 'undefined') {
        // Use server proxy for browser
      // During local development, the proxy runs on port 5174. Use full URL to avoid Vite 404.
      const proxyBase = (typeof window !== 'undefined' && window.location.origin.includes('localhost')) ? 'http://localhost:5174' : '';
      const resp = await fetch(`${proxyBase}/api/gemini`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'chat', payload: { model: 'gemini-2.5-flash', systemInstruction, history: conversationHistory, message: latestMessage } })
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text);
        }
        const json = await resp.json();
        return json.text;
      }

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
        history: conversationHistory
      });

      const response = await chat.sendMessage({ message: latestMessage });
      return response.text;
    } catch (error) {
        console.error("Error during Gemini API chat call:", error);
        throw new Error("Failed to get a chat response from AI.");
    }
};

  // Helper to call the server proxy for generate-like requests when running in browser
  async function callProxyGenerate(payload: any) {
  const proxyBase = (typeof window !== 'undefined' && window.location.origin.includes('localhost')) ? 'http://localhost:5174' : '';
  const resp = await fetch(`${proxyBase}/api/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generateContent', payload }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || 'Proxy request failed');
    }
    return resp.json();
  }