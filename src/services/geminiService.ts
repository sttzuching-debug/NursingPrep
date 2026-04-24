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

export async function summarizePaper(paperText: string, targetLength?: string, originalSource?: string, bibliography?: string[]): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview"; 
  const prompt = `
    你是一位專業的護理期刊編輯。請將以下護理論文/論文摘要（或全文）濃縮成適合投稿至學術期刊的版本。
    
    ${originalSource ? `參考原稿資訊：
    [這份原稿是作者最初的底稿，請從中提取核心發現與關鍵論點，協助優化當前的工作版本。]
    原稿內容摘要：
    ${originalSource.substring(0, 3000)}... (省略過長內容)
    ` : ''}

    ${bibliography && bibliography.length > 0 ? `參考文獻清單 (Bibliography)：
    [請在文中適當位置標註這些文獻的引用，並在文末列出完整的參考文獻列表。]
    ${bibliography.join('\n')}
    ` : ''}

    當前工作版本內容：
    ${paperText}

    要求：
    1. 保持學術精確性與護理專業術語。
    2. 結構應包含：背景、目的、方法、結果、結論/建議（IMRAD格式）。
    3. **排除 LaTeX 語法 (Clean Symbols)**：**嚴禁輸出 LaTeX 格式（如 $...$, \ge, ^{}, \beta）**。
       - **不可使用 $...$ 包裹數學公式或變數**。
       - **請使用標準 Unicode 符號**：
         - 使用 \`R²\` 或 \`R^2\` (非 LaTeX) 代替 \`$R^2$\`。
         - 使用 \`p < .05\` (非 LaTeX) 代替 \`$p < .05$\`。
         - 使用 \`≥\`, \`≤\`, \`±\`, \`≈\`, \`α\`, \`β\`, \`χ²\` 等標準符號。
         - 顯著性標註請使用標準星號，例如：\`*p* < .05\`, \`**p* < .01\`。
    4. ${targetLength ? `目標長度約為 ${targetLength} 字。` : '請濃縮成精華版本，刪除冗餘資訊。'}
    5. **特別注意：如果原文中包含數據表格，請務必精簡並以 Markdown 表格格式保留在「結果 (Results)」章節中。**
    6. 請使用繁體中文。
    7. 若提供參考文獻，請確保文中的引用與文末的列表一致。
    `;
// ...

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

export async function formatByGuidelines(paperText: string, guidelines: string, citationStyle?: string, originalSource?: string, bibliography?: string[], targetLength?: string): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    你是一位資深的護理期刊排版與內容專家。請依照「期刊作者指引 (Author Guidelines)」修正以下論文內容。
    
    ${targetLength ? `特別任務：請在符合指引的前提下，將論文內容濃縮至約 ${targetLength} 字左右。` : ''}
    
    ${citationStyle ? `特別要求：請使用「${citationStyle}」引用格式。` : ''}
    
    ${originalSource ? `參考原稿資訊：
    [請參考原稿中的核心精神與數據，確保修正後的投稿版本不會偏離研究初衷。]
    原稿內容摘要：
    ${originalSource.substring(0, 3000)}...
    ` : ''}

    ${bibliography && bibliography.length > 0 ? `參考文獻清單 (Bibliography)：
    [請根據指定的 ${citationStyle || '學術'} 格式，在文中插入正確的引用標記，並在文末生成對應的參考文獻列表。]
    ${bibliography.join('\n')}
    ` : ''}

    期刊指引內容：
    ${guidelines}
    
    待修正論文內容：
    ${paperText}
    
    要求：
    1. **結構完整性 (Full Presentation)**：必須輸出包含完整結構（標題、摘要、背景、方法、結果、討論、結論、參考文獻）的論文版本。嚴禁只提供片段、大綱或「...」省略號。
    2. **數據表格化 (Automatic Tables)**：請主動從原文或「參考原稿」中挖掘具體的統計數據（如：中位數、平均值、P 值、受試者分佈），並將其轉換為標準的 Markdown 三線表格式插入「結果 (Results)」章節。
    3. **排除 LaTeX 語法 (Clean Symbols)**：**嚴禁輸出 LaTeX 格式（如 $...$, \ge, ^{}, \beta）**。
       - **不可使用 $...$ 包裹數學公式或變數**。
       - **請使用標準 Unicode 符號**：
         - 使用 \`R²\` 或 \`R^2\` (非 LaTeX) 代替 \`$R^2$\`。
         - 使用 \`p < .05\` (非 LaTeX) 代替 \`$p < .05$\`。
         - 使用 \`≥\`, \`≤\`, \`±\`, \`≈\`, \`α\`, \`β\`, \`χ²\` 等標準符號。
         - 顯著性標註請使用標準星號，例如：\`*p* < .05\`, \`**p* < .01\`。
    4. **格式化與配額**：${targetLength ? `根據投稿要求，請將全文精確濃縮至約 ${targetLength} 字左右。` : '在保持內容完整的前提下，盡可能精簡不必要的贅述。'}
    5. **引用格式**：依照「${citationStyle || '學術'}」規範標註文中引用與末尾文獻。
    6. **補齊文末聲明 (Back Matter)**：主動根據指引補齊 Funding, Author Contributions 等聲明區塊。
    7. **語氣與語言**：使用繁體中文，語氣應嚴謹、客觀且專業。
    8. 返回內容：[修正後的完整論文全文] + [期刊規格符合度檢查清單]。
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

export async function reviseByReviews(paperText: string, reviewerComments: string, originalSource?: string, bibliography?: string[]): Promise<AIResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    你是一位經驗豐富的護理研究專家。請根據「審查者建議」對以下論文進行修正。
    
    ${originalSource ? `參考原稿資訊：
    [若審查建議涉及研究細節，請優先從此原稿中提取相關資訊來回覆與修正。]
    原稿內容摘要：
    ${originalSource.substring(0, 3000)}...
    ` : ''}

    ${bibliography && bibliography.length > 0 ? `參考文獻清單 (Bibliography)：
    [若修正內容需要引用，請優先使用此清單中的原始文獻。]
    ${bibliography.join('\n')}
    ` : ''}

    審查者建議：
    ${reviewerComments}
    
    當前論文內容：
    ${paperText}
    
    要求：
    1. 針對每條建議進行內容修正。
    2. 強化學術严謹性，適當插入參考文獻引用。
    3. **排除 LaTeX 語法 (Clean Symbols)**：**嚴禁輸出 LaTeX 格式（如 $...$, \ge, ^{}）**。
       - **不可使用 $...$ 包裹數學公式或變數**。
       - **請使用標準 Unicode 符號**：使用 \`≥\`, \`≤\`, \`±\`, \`p < .05\` 等。
    4. 生成兩個部分：
       a. 修正後的論文全文。
       b. 點對點回覆審查意見的對照表。
    5. 語氣應專業、客觀且有禮貌。
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

export async function searchJournalGuidelines(journalName: string): Promise<AIResponse & { sourceUrl?: string; parsed?: { wordCount?: string; citationStyle?: string } }> {
  const ai = getAI();
  const model = "gemini-3-flash-preview"; 
  
  const prompt = `
    請使用 Google 搜尋尋找期刊「${journalName}」的官方「作者投稿指引 (Author Guidelines)」或「投稿須知 (Instructions for Authors)」。
    
    請從搜尋結果中提取以下關鍵資訊：
    1. 格式與結構：字數限制、摘要結構（如背景、方法等）、**圖表繪製規範（解析度、圖題格式）**。
    2. 引用格式：明確標註引用風格（如：APA, AMA, Vancouver）。
    3. **技術細節**：統計方法呈現要求（如：P 值、信賴區間、軟體資訊標註）。
    4. **文末聲明要求 (Back Matter)**：是否需要 Funding, Author Contributions, Conflicts of Interest 等特定章節。
    5. 投稿系統連結與官方指引頁面連結。
    
    你的回覆應包含兩個部分：
    1. 詳細的規範摘要（繁體中文）。
    2. 一個 JSON 程式碼區塊，包含以下欄位（若無則留空）：
       - "wordCount": 提取到的字數限制數字（如 "3000"）。
       - "citationStyle": 識別出的常用引用格式名稱（必須屬於這幾種：'APA 7th', 'AMA', 'Vancouver', 'Harvard', 'MLA 9th', 'Chicago'，若不確定則填寫最接近的）。

    JSON 格式示例：\`\`\`json {"wordCount": "3000", "citationStyle": "APA 7th"} \`\`\`
    
    要求：
    - 嚴格遵守搜尋結果，不可造假或憑空想像。
    - 若找不到確切指引，請老實說明。
    - 使用繁體中文進行第一部分的說明。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "";
    let parsed: { wordCount?: string; citationStyle?: string } | undefined;

    // Extract JSON from text
    const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse journal JSON:", e);
      }
    }

    // Extracting source URL if available from grounding metadata
    const groundMetadata = response.candidates?.[0]?.groundingMetadata;
    const sourceUrl = groundMetadata?.searchEntryPoint?.renderedContent;

    return {
      text: text.replace(/```json\s*\{[\s\S]*?\}\s*```/g, "").trim(),
      parsed,
      sourceUrl: sourceUrl,
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount || 0,
        candidatesTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error("Journal search error:", error);
    throw error;
  }
}
