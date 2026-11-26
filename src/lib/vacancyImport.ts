import type { AiRequestMeta } from '../types/career';
import { GeminiApiError } from './gemini';

export const MAX_VACANCY_IMAGES = 5;
export const MAX_VACANCY_IMAGE_BYTES = 10 * 1024 * 1024; // 10 МБ
const MAX_DIMENSION_PX = 1600;
const JPEG_QUALITY = 0.85;
const INVALID_IMAGE_ERROR = 'Загрузите JPG, PNG или WEBP до 10 МБ';

export interface VacancyImportResult {
  text: string;
  jobTitle: string | null;
  _meta?: AiRequestMeta;
}

export interface CompressedImagePayload {
  mimeType: 'image/jpeg';
  data: string;
}

export function isSupportedVacancyImage(file: File): boolean {
  if (file.size > MAX_VACANCY_IMAGE_BYTES || file.size === 0) {
    return false;
  }

  const lowerName = file.name.toLowerCase();
  const allowedExt =
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp');
  const allowedMime =
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === 'image/png' ||
    file.type === 'image/webp';

  // Отсекаем HEIC/HEIF и любые другие неподдерживаемые форматы даже если браузер передал пустой type
  if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif') || /heic|heif/i.test(file.type)) {
    return false;
  }

  return allowedMime || (file.type === '' && allowedExt);
}

export async function compressVacancyImage(file: File): Promise<CompressedImagePayload> {
  if (!isSupportedVacancyImage(file)) {
    throw new Error(INVALID_IMAGE_ERROR);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(INVALID_IMAGE_ERROR));
      el.src = objectUrl;
    });

    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) {
      throw new Error(INVALID_IMAGE_ERROR);
    }

    const longestSide = Math.max(naturalWidth, naturalHeight);
    const scale = longestSide > MAX_DIMENSION_PX ? MAX_DIMENSION_PX / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Не удалось подготовить изображение для распознавания.');
    }

    // Белый фон нужен при конвертации прозрачных PNG/WEBP в JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      throw new Error(INVALID_IMAGE_ERROR);
    }

    return {
      mimeType: 'image/jpeg',
      data: dataUrl.slice(commaIdx + 1),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function extractVacancyFromImages(files: File[]): Promise<VacancyImportResult> {
  if (files.length === 0) {
    throw new Error('Выберите хотя бы одно изображение вакансии.');
  }

  const limitedFiles = files.slice(0, MAX_VACANCY_IMAGES);
  for (const file of limitedFiles) {
    if (!isSupportedVacancyImage(file)) {
      throw new Error(INVALID_IMAGE_ERROR);
    }
  }

  const compressedImages = await Promise.all(
    limitedFiles.map((file) => compressVacancyImage(file))
  );

  let response: Response;
  try {
    response = await fetch('/api/vacancy/from-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ images: compressedImages }),
    });
  } catch {
    throw new GeminiApiError(
      'Ошибка сети: не удалось связаться с сервером. Проверьте подключение к интернету.'
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMsg =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Ошибка сервера (HTTP ${response.status}). Попробуйте повторить запрос.`;
    throw new GeminiApiError(errorMsg, response.status);
  }

  const result = payload as Partial<VacancyImportResult> | null;
  if (!result || typeof result.text !== 'string' || !result.text.trim()) {
    throw new GeminiApiError(
      'Не удалось найти вакансию на изображении. Попробуйте другой снимок или вставьте текст'
    );
  }

  return {
    text: result.text.trim(),
    jobTitle: typeof result.jobTitle === 'string' && result.jobTitle.trim() ? result.jobTitle.trim() : null,
    _meta: result._meta,
  };
}

export async function extractVacancyFromUrl(url: string): Promise<VacancyImportResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Введите ссылку на вакансию.');
  }

  let response: Response;
  try {
    response = await fetch('/api/vacancy/from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: trimmed }),
    });
  } catch {
    throw new GeminiApiError(
      'Ошибка сети: не удалось связаться с сервером. Проверьте подключение к интернету.'
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMsg =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Ошибка сервера (HTTP ${response.status}). Попробуйте повторить запрос.`;
    throw new GeminiApiError(errorMsg, response.status);
  }

  const result = payload as Partial<VacancyImportResult> | null;
  if (!result || typeof result.text !== 'string' || !result.text.trim()) {
    throw new GeminiApiError(
      'Не удалось найти вакансию по этой ссылке. Вставьте текст вручную или загрузите скриншот.'
    );
  }

  return {
    text: result.text.trim(),
    jobTitle: typeof result.jobTitle === 'string' && result.jobTitle.trim() ? result.jobTitle.trim() : null,
    _meta: result._meta,
  };
}
