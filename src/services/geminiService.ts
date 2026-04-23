import { GoogleGenAI } from "@google/genai";

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Don't throw here at module load, but handle it gracefully
      console.warn("GEMINI_API_KEY is missing. AI features will not work.");
      // Return a dummy object or handle in functions
    }
    genAI = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return genAI;
}

export async function summarizePaper(paperText: string, targetLength?: string, originalSource?: string): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview"; // Use Pro for complex reasoning/summarization
  const prompt = `
    你是一位專業的護理期刊編輯。請將以下護理論文/論文摘要（或全文）濃縮成適合投稿至學術期刊的版本。
    
    ${originalSource ? `參考原稿資訊：
    [這份原稿是作者最初的底稿，請從中提取核心發現與關鍵論點，協助優化當前的工作版本。]
    原稿內容摘要：
    ${originalSource.substring(0, 3000)}... (省略過長內容)
    ` : ''}

    當前工作版本內容：
    ${paperText}

    要求：
    1. 保持學術精確性與護理專業術語。
    2. 結構應包含：背景、目的、方法、結果、結論/建議（IMRAD格式）。
    3. ${targetLength ? `目標長度約為 ${targetLength} 字。` : '請濃縮成精華版本，刪除冗餘資訊。'}
    4. **特別注意：如果原文中包含數據表格，請務必精簡並以 Markdown 表格格式保留在「結果 (Results)」章節中。**
    5. 請使用繁體中文（除非原文為英文）。
    6. 若提供參考原稿，請確保當前版本的邏輯與原稿核心一致，但語氣更學術化。
    `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      text: response.text || "",
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Summarization error:", error);
    throw error;
  }
}

export async function formatByGuidelines(paperText: string, guidelines: string, citationStyle?: string, originalSource?: string): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    你是一位資深的護理期刊排版與內容專家。請依照「期刊作者指引 (Author Guidelines)」修正以下論文內容。
    
    ${citationStyle ? `特別要求：請使用「${citationStyle}」引用格式。` : ''}
    
    ${originalSource ? `參考原稿資訊：
    [請參考原稿中的核心精神與數據，確保修正後的投稿版本不會偏離研究初衷。]
    原稿內容摘要：
    ${originalSource.substring(0, 3000)}...
    ` : ''}

    期刊指引內容：
    ${guidelines}
    
    待修正論文內容：
    ${paperText}
    
    要求：
    1. 修正標題格式、摘要結構。
    2. 調整引用格式${citationStyle ? `（嚴格執行 ${citationStyle} 規範）` : '（如 APA, Harvard 等，依指引而定）'}。
    3. 核心內容字數限制與用語修正。
    4. **若原文或指引提及表格，請確保輸出中的表格符合護理期刊標準（三線表格式：上、中、下橫線）。**
    5. 若指引中有具體限制（如字數、段落數），請嚴格遵守並在輸出中標註。
    6. 請返回修正後的全文，並在最後列出主要的修改項目。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      text: response.text || "",
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Formatting error:", error);
    throw error;
  }
}

export async function reviseByReviews(paperText: string, reviewerComments: string, originalSource?: string): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    你是一位經驗豐富的護理研究專家。請根據「審查者建議」對以下論文進行修正。
    
    ${originalSource ? `參考原稿資訊：
    [若審查建議涉及研究細節，請優先從此原稿中提取相關資訊來回覆與修正。]
    原稿內容摘要：
    ${originalSource.substring(0, 3000)}...
    ` : ''}

    審查者建議：
    ${reviewerComments}
    
    當前論文內容：
    ${paperText}
    
    要求：
    1. 針對每條建議進行內容修正。
    2. 若建議提到邏輯不清或資料不足，請以專業護理知識輔助潤飾（若需補充資料，優先參考原稿；若無，請用引號 [...] 提醒作者）。
    3. 生成兩個部分：
       a. 修正後的論文全文。
       b. 點對點回覆審查意見的對照表 (Response to Reviewers Table)。
    4. 語氣應專業、客觀且有禮貌。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      text: response.text || "",
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Revision error:", error);
    throw error;
  }
}

export async function extractGlossary(paperText: string): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    你是一位護理學術專家。請從以下論文內容中提取關鍵術語、專業術語或縮寫，並生成一份術語表 (Glossary)。
    
    要求：
    1. 識別臨床術語、研究方法學術語、統計術語以及特定的護理概念。
    2. 對於每個術語，請提供簡明扼要的定義或說明。
    3. 如果包含縮寫，請列出其全稱。
    4. 以 Markdown 格式輸出，結構清晰。
    5. 使用繁體中文說明。
    
    論文內容：
    ${paperText}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      text: response.text || "",
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Glossary extraction error:", error);
    throw error;
  }
}

export async function analyzeTone(outputText: string): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3-flash-preview"; // Upgraded from gemini-1.5-flash
  const prompt = `
    你是一位專業的護理學術期刊審稿人。請分析以下這段學術內容的「寫作語氣」與「專業度」，並提供改進建議。
    
    分析維度：
    1. **學術化程度**：是否足夠正式？是否使用了精確的學術動詞與句構？
    2. **口語化檢查**：是否存在過於非正式、口語或不專業的排句？
    3. **偏見與中立性**：是否使用了帶有偏見、標籤化或不夠中立的詞彙（例如：以病為名而非以人為本的表達）？
    
    請以 Markdown 格式回傳，格式要求如下：
    - ## 語氣分析報告
    - **綜合點評**：[簡述整體寫作語氣]
    - **優點**：[列出 1-2 個寫作優點]
    - **需改進處**：[具體指出問題點]
    - **建議修正**：[提供 1-2 段具體的潤飾建議]
    
    待分析內容：
    ${outputText}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      text: response.text || "",
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Tone analysis error:", error);
    throw error;
  }
}

export async function generateSummaryReport(originalText: string, aiResult: string, toneAnalysis: string, taskType: string): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3-flash-preview"; 
  const prompt = `
    你是一位專業的學術顧問。請根據以下 AI 的分析與修正結果，為使用者產出一份「研究修正簡報 (Concise Analysis Report)」。
    這份報告旨在讓使用者快速了解修改重點。
    
    任務類型：${taskType}
    
    1. 原始內容摘要：[簡述原始內容的核心]
    2. 主要修正建議：[列出 3 個最關鍵的修改動作]
    3. 語氣與專業度評估：[綜合語氣分析結果的關鍵結論]
    4. 下一步建議：[建議使用者接下來應注意的 1-2 個細節]
    
    要求：
    - 語氣簡潔、專業、具有指導性。
    - 使用 Markdown 標記，適合在行動裝置或快速瀏覽時閱讀。
    - 使用繁體中文。
    
    資料來源：
    [AI 修正結果]: ${aiResult.substring(0, 3000)}
    [語氣分析結論]: ${toneAnalysis.substring(0, 1000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      text: response.text || "",
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Summary report generation error:", error);
    throw error;
  }
}

export async function polishResult(content: string, tone: 'academic' | 'concise' | 'persuasive' | 'standard'): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3-flash-preview"; 
  
  const tonePrompts = {
    academic: "請將以下內容調整為更具「學術化 (Academic)」的語氣。使用更精確的科學動詞、被動語態與嚴謹的句構，確保符合國際護理期刊的發布標準。",
    concise: "請將以下內容調整為更「簡潔 (Concise)」的表達方式。去除贅字、冗長修飾與重複資訊，直接點出核心重點，適合字數限制嚴格的摘要。",
    persuasive: "請將以下內容調整為更具「說服力 (Persuasive)」的語氣。強調研究的重要性、臨床應用價值與創新貢獻，增強對審稿人的吸引力。",
    standard: "請對以下內容進行標準的學術潤飾。優化流暢度、修正字元錯誤並微調專業用語。"
  };

  const prompt = `
    你是一位專業的學術編輯。
    指令：${tonePrompts[tone]}
    
    待處理內容：
    ${content}
    
    要求：
    1. 僅回傳修正後的內容，不需要額外的解釋。
    2. 保留原有的 Markdown 格式（如表格、標題、清單）。
    3. 專業術語不可隨意更改含義。
    4. 使用繁體中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return {
      text: response.text || "",
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Polishing error:", error);
    throw error;
  }
}
