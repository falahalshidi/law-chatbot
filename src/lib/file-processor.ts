import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker - use local worker file instead of CDN
// The worker file is copied to public directory during build by Vite plugin
// This ensures it works in production environments like Netlify
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Extract text from PDF file (browser-compatible)
 */
export async function extractTextFromPDF(file: File | ArrayBuffer): Promise<string> {
  try {
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = "";
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }
    
    return fullText.trim();
  } catch (error) {
    throw new Error(`فشل استخراج النص من PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract text from DOCX file (browser-compatible)
 */
export async function extractTextFromDOCX(file: File | ArrayBuffer): Promise<string> {
  try {
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new Error(`فشل استخراج النص من DOCX: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract text from TXT file
 */
export async function extractTextFromTXT(file: File | ArrayBuffer): Promise<string> {
  try {
    if (file instanceof File) {
      return await file.text();
    } else {
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(file);
    }
  } catch (error) {
    throw new Error(`فشل استخراج النص من TXT: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract text from file based on file type
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const filename = file.name;
  const fileExtension = filename.split(".").pop()?.toLowerCase() || "";
  const fileType = file.type || "";

  if (fileExtension === "pdf" || fileType.includes("pdf")) {
    return await extractTextFromPDF(file);
  } else if (
    fileExtension === "docx" ||
    fileType.includes("wordprocessingml") ||
    fileType.includes("msword")
  ) {
    return await extractTextFromDOCX(file);
  } else if (
    fileExtension === "txt" ||
    fileExtension === "md" ||
    fileType.includes("text/plain")
  ) {
    return await extractTextFromTXT(file);
  } else {
    throw new Error(`نوع الملف غير مدعوم: ${fileExtension}`);
  }
}

/**
 * Split text into chunks with overlap
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  try {
    if (!text || typeof text !== "string") {
      return [];
    }

    const textLength = text.length;
    if (textLength === 0) {
      return [];
    }

    // If text is shorter than chunkSize, return it as single chunk
    if (textLength <= chunkSize) {
      const trimmed = text.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }

    const chunks: string[] = [];
    let start = 0;
    const safeOverlap = Math.min(overlap, Math.floor(chunkSize * 0.5));
    const stepSize = Math.max(1, chunkSize - safeOverlap);

    while (start < textLength) {
      const end = Math.min(start + chunkSize, textLength);
      
      if (end <= start) {
        break;
      }
      
      const chunk = text.substring(start, end);
      const trimmedChunk = chunk.trim();
      
      if (trimmedChunk.length > 0) {
        if (trimmedChunk.length > chunkSize * 2) {
          console.warn(`Chunk too large (${trimmedChunk.length}), truncating`);
          chunks.push(trimmedChunk.substring(0, chunkSize * 2));
        } else {
          chunks.push(trimmedChunk);
        }
      }
      
      start += stepSize;
      
      if (start >= textLength) {
        break;
      }
    }

    return chunks.filter((chunk) => chunk && typeof chunk === "string" && chunk.length > 0);
  } catch (error) {
    console.error("Error in splitTextIntoChunks:", error);
    throw new Error(`فشل تقسيم النص: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
