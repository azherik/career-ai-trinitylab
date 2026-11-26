import { jsPDF } from 'jspdf';
import dejaVuBoldUrl from '../assets/fonts/DejaVuSans-Bold.ttf?url';
import dejaVuRegularUrl from '../assets/fonts/DejaVuSans.ttf?url';
import type { ResumeAnalysis } from '../types/career';

interface FontBase64Cache {
  regular: string;
  bold: string;
}

let cachedFonts: FontBase64Cache | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function loadCyrillicFonts(): Promise<FontBase64Cache> {
  if (cachedFonts) {
    return cachedFonts;
  }

  const [regularRes, boldRes] = await Promise.all([
    fetch(dejaVuRegularUrl),
    fetch(dejaVuBoldUrl),
  ]);

  if (!regularRes.ok || !boldRes.ok) {
    throw new Error('Не удалось загрузить кириллические шрифты для создания PDF.');
  }

  const [regularBuf, boldBuf] = await Promise.all([
    regularRes.arrayBuffer(),
    boldRes.arrayBuffer(),
  ]);

  cachedFonts = {
    regular: arrayBufferToBase64(regularBuf),
    bold: arrayBufferToBase64(boldBuf),
  };
  return cachedFonts;
}

async function createCyrillicPdf(): Promise<jsPDF> {
  const fonts = await loadCyrillicFonts();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.addFileToVFS('DejaVuSans.ttf', fonts.regular);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');

  doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');

  doc.setFont('DejaVuSans', 'normal');
  return doc;
}

function triggerTextDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('DejaVuSans', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`CareerAI · Стр. ${i} из ${totalPages}`, pageWidth - 18, pageHeight - 10, {
      align: 'right',
    });
  }
}

const KNOWN_SECTION_HEADERS = new Set([
  'цель',
  'желаемая должность',
  'контакты',
  'контактная информация',
  'о себе',
  'резюме',
  'образование',
  'опыт работы',
  'опыт',
  'проекты',
  'учебные проекты',
  'учебные и pet-проекты',
  'навыки',
  'ключевые навыки',
  'профессиональные навыки',
  'языки',
  'знание языков',
  'дополнительно',
  'дополнительная информация',
  'достижения',
  'сертификаты',
  'лицензии и сертификаты',
]);

function isLikelyResumeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 55) return false;
  if (/^[-•*—]/.test(trimmed)) return false;

  const cleanNoColon = trimmed.replace(/:$/, '').toLowerCase();
  if (KNOWN_SECTION_HEADERS.has(cleanNoColon)) {
    return true;
  }

  if (trimmed.endsWith(':') && trimmed.split(/\s+/).length <= 5) {
    return true;
  }

  const lettersOnly = trimmed.replace(/[^А-ЯЁA-Zа-яёa-z]/g, '');
  if (lettersOnly.length >= 4 && trimmed === trimmed.toUpperCase()) {
    return true;
  }

  return false;
}

export function downloadImprovedResumeTxt(resumeText: string) {
  triggerTextDownload(resumeText.trim(), 'uluchshennoe-rezyume.txt');
}

export async function downloadImprovedResumePdf(resumeText: string) {
  const doc = await createCyrillicPdf();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 20;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2;

  // Верхняя акцентная линия
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.9);
  doc.line(marginX, 13, pageWidth - marginX, 13);

  let y = marginTop;
  const lines = resumeText.replace(/\r\n/g, '\n').split('\n');

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  let firstNonEmptyHandled = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      y += 3;
      continue;
    }

    if (!firstNonEmptyHandled) {
      firstNonEmptyHandled = true;
      doc.setFont('DejaVuSans', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      const wrapped = doc.splitTextToSize(trimmed, contentWidth) as string[];
      ensureSpace(wrapped.length * 7 + 3);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 7 + 2;
      continue;
    }

    if (isLikelyResumeHeading(trimmed)) {
      y += 3;
      ensureSpace(12);
      const headingText = trimmed.replace(/:$/, '');
      doc.setFont('DejaVuSans', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(55, 48, 163);
      doc.text(headingText, marginX, y);
      y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 5;
      continue;
    }

    const bulletMatch = trimmed.match(/^([-•*—])\s+(.*)$/);
    if (bulletMatch) {
      const bulletBody = bulletMatch[2];
      doc.setFont('DejaVuSans', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const wrapped = doc.splitTextToSize(bulletBody, contentWidth - 5) as string[];
      ensureSpace(wrapped.length * 4.8 + 1.5);
      doc.text('•', marginX + 1, y);
      doc.text(wrapped, marginX + 5, y);
      y += wrapped.length * 4.8 + 1.2;
      continue;
    }

    doc.setFont('DejaVuSans', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const wrapped = doc.splitTextToSize(trimmed, contentWidth) as string[];
    ensureSpace(wrapped.length * 4.8 + 1.5);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4.8 + 1.2;
  }

  addPageNumbers(doc);
  doc.save('uluchshennoe-rezyume.pdf');
}

export function downloadAnalysisReportTxt(analysis: ResumeAnalysis) {
  const lines: string[] = [];
  lines.push('CAREERAI — ОТЧЁТ АНАЛИЗА РЕЗЮМЕ И ВАКАНСИИ');
  lines.push('===========================================');
  lines.push('');
  lines.push(`Соответствие вакансии: ${analysis.matchScore}%`);
  lines.push(`Вывод: ${analysis.summary}`);
  lines.push('');
  lines.push('1. ДАННЫЕ ИЗ РЕЗЮМЕ');
  lines.push('-------------------');
  lines.push('Образование:');
  analysis.extractedData.education.forEach((item) => lines.push(`  • ${item}`));
  lines.push('');
  lines.push(`Навыки: ${analysis.extractedData.skills.join(', ') || 'Не указаны'}`);
  lines.push('');
  lines.push('Опыт и проекты:');
  analysis.extractedData.experience.forEach((item) => lines.push(`  • ${item}`));
  lines.push('');
  lines.push('2. ЧТО УЖЕ ПОДХОДИТ');
  lines.push('------------------');
  if (analysis.matchingSkills.length === 0) {
    lines.push('  • Прямых совпадений не выявлено.');
  } else {
    analysis.matchingSkills.forEach((item) => {
      lines.push(`  + ${item.skill}`);
      lines.push(`    ${item.explanation}`);
    });
  }
  lines.push('');
  lines.push('3. ЧЕГО НЕ ХВАТАЕТ');
  lines.push('-----------------');
  if (analysis.missingSkills.length === 0) {
    lines.push('  • Критических пробелов не найдено.');
  } else {
    analysis.missingSkills.forEach((item) => {
      lines.push(`  - ${item.skill}`);
      lines.push(`    ${item.explanation}`);
    });
  }
  lines.push('');
  lines.push('4. РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ РЕЗЮМЕ');
  lines.push('-----------------------------------');
  analysis.recommendations.forEach((rec, idx) => {
    lines.push(`${idx + 1}. Раздел: ${rec.section}`);
    lines.push(`   Что не так: ${rec.issue}`);
    lines.push(`   Как исправить: ${rec.fix}`);
    lines.push('');
  });

  if (analysis.improvedResumeText) {
    lines.push('5. УЛУЧШЕННЫЙ ТЕКСТ РЕЗЮМЕ');
    lines.push('--------------------------');
    lines.push(analysis.improvedResumeText);
  }

  triggerTextDownload(lines.join('\n'), 'otchet-analiza-careerai.txt');
}

export async function downloadAnalysisReportPdf(analysis: ResumeAnalysis) {
  const doc = await createCyrillicPdf();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 20;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2;

  let y = marginTop;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const drawSectionHeading = (title: string, r = 55, g = 48, b = 163) => {
    y += 3;
    ensureSpace(12);
    doc.setFont('DejaVuSans', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(r, g, b);
    doc.text(title, marginX, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
  };

  const drawParagraph = (text: string, fontSize = 10, color: [number, number, number] = [30, 41, 59], bold = false) => {
    doc.setFont('DejaVuSans', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const wrapped = doc.splitTextToSize(text, contentWidth) as string[];
    ensureSpace(wrapped.length * (fontSize * 0.48) + 2);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * (fontSize * 0.48) + 2;
  };

  // Заголовок отчёта
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.9);
  doc.line(marginX, 13, pageWidth - marginX, 13);

  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Отчёт анализа резюме — CareerAI', marginX, y);
  y += 8;

  // Блок процента соответствия
  const scoreColor: [number, number, number] =
    analysis.matchScore < 50
      ? [220, 38, 38]
      : analysis.matchScore < 75
        ? [217, 119, 6]
        : [22, 163, 74];

  drawParagraph(`Соответствие вакансии: ${analysis.matchScore}%`, 13, scoreColor, true);
  drawParagraph(analysis.summary, 10, [51, 65, 85], false);

  // Данные из резюме
  drawSectionHeading('1. Данные из резюме');
  drawParagraph('Образование:', 10, [15, 23, 42], true);
  analysis.extractedData.education.forEach((edu) => {
    drawParagraph(`• ${edu}`, 9.5, [51, 65, 85], false);
  });

  if (analysis.extractedData.skills.length > 0) {
    y += 1;
    drawParagraph(`Навыки: ${analysis.extractedData.skills.join(', ')}`, 9.5, [30, 41, 59], false);
  }

  y += 1;
  drawParagraph('Опыт и проекты:', 10, [15, 23, 42], true);
  analysis.extractedData.experience.forEach((exp) => {
    drawParagraph(`• ${exp}`, 9.5, [51, 65, 85], false);
  });

  // Что уже подходит
  drawSectionHeading('2. Что уже подходит', 22, 101, 52);
  if (analysis.matchingSkills.length === 0) {
    drawParagraph('Прямых совпадений не обнаружено.', 9.5, [71, 85, 105]);
  } else {
    analysis.matchingSkills.forEach((item) => {
      drawParagraph(`+ ${item.skill}`, 10, [15, 23, 42], true);
      drawParagraph(item.explanation, 9.5, [51, 65, 85], false);
    });
  }

  // Чего не хватает
  drawSectionHeading('3. Чего не хватает', 180, 83, 9);
  if (analysis.missingSkills.length === 0) {
    drawParagraph('Критических пробелов не найдено.', 9.5, [71, 85, 105]);
  } else {
    analysis.missingSkills.forEach((item) => {
      drawParagraph(`— ${item.skill}`, 10, [15, 23, 42], true);
      drawParagraph(item.explanation, 9.5, [51, 65, 85], false);
    });
  }

  // Рекомендации
  drawSectionHeading('4. Рекомендации по улучшению резюме');
  analysis.recommendations.forEach((rec, idx) => {
    drawParagraph(`${idx + 1}. ${rec.section}`, 10.5, [55, 48, 163], true);
    drawParagraph(`Что не так: ${rec.issue}`, 9.5, [51, 65, 85], false);
    drawParagraph(`Как исправить: ${rec.fix}`, 9.5, [30, 41, 59], false);
    y += 1;
  });

  addPageNumbers(doc);
  doc.save('otchet-analiza-careerai.pdf');
}
