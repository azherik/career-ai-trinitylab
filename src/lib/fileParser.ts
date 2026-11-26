import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const MAX_RESUME_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 МБ
const FALLBACK_READ_ERROR = 'Не удалось прочитать файл, вставьте текст резюме вручную';

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error(FALLBACK_READ_ERROR));
      }
    };
    reader.onerror = () => reject(new Error(FALLBACK_READ_ERROR));
    reader.readAsArrayBuffer(file);
  });
}

function readTxtWithFileReader(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error(FALLBACK_READ_ERROR));
      }
    };
    reader.onerror = () => reject(new Error(FALLBACK_READ_ERROR));
    reader.readAsText(file, encoding);
  });
}

async function parseTxtFile(file: File): Promise<string> {
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);

  // Проверяем UTF-16 BOM
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return readTxtWithFileReader(file, 'UTF-16LE');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return readTxtWithFileReader(file, 'UTF-16BE');
  }

  // Читаем через FileReader как UTF-8; если встречаются битые символы (например Windows-1251), пробуем windows-1251
  const utf8Text = await readTxtWithFileReader(file, 'UTF-8');
  if (utf8Text.includes('\uFFFD')) {
    return readTxtWithFileReader(file, 'windows-1251');
  }
  return utf8Text;
}

async function parseDocxFile(file: File): Promise<string> {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.normalize('NFC');
}

async function parsePdfFile(file: File): Promise<string> {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  });

  const pdf = await loadingTask.promise;
  const pagesText: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if (!('str' in item)) continue;

      const text = item.str;
      const y = Array.isArray(item.transform) && typeof item.transform[5] === 'number'
        ? item.transform[5]
        : null;

      const yChanged = lastY !== null && y !== null && Math.abs(y - lastY) > 2;
      if (yChanged && currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = '';
      }

      if (text) {
        if (currentLine && !currentLine.endsWith(' ') && !text.startsWith(' ')) {
          currentLine += ' ';
        }
        currentLine += text;
      }

      if (item.hasEOL && currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = '';
        lastY = null;
      } else if (y !== null) {
        lastY = y;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    const pageStr = lines.join('\n').trim();
    if (pageStr) {
      pagesText.push(pageStr);
    }
  }

  return pagesText.join('\n\n').normalize('NFC');
}

export async function extractTextFromResumeFile(file: File): Promise<string> {
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new Error('Файл слишком большой. Максимальный размер — 5 МБ.');
  }

  if (file.size === 0) {
    throw new Error(FALLBACK_READ_ERROR);
  }

  const lowerName = file.name.toLowerCase();
  const isTxt = lowerName.endsWith('.txt') || file.type === 'text/plain';
  const isDocx =
    lowerName.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';

  if (!isTxt && !isDocx && !isPdf) {
    throw new Error('Неподдерживаемый формат файла. Загрузите PDF, DOCX или TXT.');
  }

  try {
    let rawText = '';
    if (isTxt) {
      rawText = await parseTxtFile(file);
    } else if (isDocx) {
      rawText = await parseDocxFile(file);
    } else if (isPdf) {
      rawText = await parsePdfFile(file);
    }

    const cleaned = rawText
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleaned) {
      throw new Error(FALLBACK_READ_ERROR);
    }

    return cleaned;
  } catch {
    throw new Error(FALLBACK_READ_ERROR);
  }
}
