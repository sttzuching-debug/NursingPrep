import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF.js worker using Vite's URL import for the bundle
// This ensures the worker is bundled and served correctly without relying on external CDNs
// @ts-ignore - Vite asset import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extracts text from a PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // We don't need useWorkerFetch or isEvalSupported: false is usually for specific envs
    });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => {
          if ('str' in item) return item.str;
          return '';
        })
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error("PDF extraction failed:", error);
    throw new Error("無法解析 PDF 檔案。這可能是因為檔案受保護或格式不相容。建議嘗試將內容複製貼上。");
  }
}

/**
 * Extracts text from a DOCX file
 */
export async function extractTextFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Extracts text from a generic text file
 */
export async function extractTextFromTXT(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}
