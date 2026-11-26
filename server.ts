import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { KNOWLEDGE_BASE } from './src/lib/knowledgeBase.ts';
import type {
  AiRequestMeta,
  AiTokenUsage,
  AnswerEvaluation,
  DevelopmentPlan,
  InterviewAnswerRecord,
  InterviewQuestion,
  InterviewSummary,
  ResumeAnalysis,
  SkillComparisonItem,
} from './src/types/career.ts';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const PORT = Number(process.env.PORT) || 3000;

const GLOBAL_SYSTEM_RULES = `ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА ПОВЕДЕНИЯ:
1. Отвечай строго на русском языке.
2. Приложение универсальное — работай с резюме и вакансиями любых профессий и отраслей (не ограничивайся IT), бери требования строго из текста вакансии и никогда не приписывай кандидату отсутствующие навыки или факты.
3. Соблюдай этику и нейтральность: никогда не учитывай пол, возраст, национальность, семейное положение, фото, место рождения или религию кандидата; не делай выводов о его личности и не обещай трудоустройство (твой вывод — рекомендация, а не решение).
4. Если в резюме есть лишние личные данные (паспортные данные, ИИН, точный домашний адрес, семейное положение, фото), мягко порекомендуй их убрать, оставив город и контакты; если данных в резюме или вакансии недостаточно, прямо укажи на это и снизь уверенность оценки.
5. Будь доброжелательным, поддерживающим, конкретным и конструктивным.
6. Если текст в поле «резюме» или «вакансия» явно не похож на резюме или описание вакансии (бессмысленный набор символов, посторонний текст, бытовой вопрос и т.п.), вежливо откажи в анализе и попроси указать реальное резюме или вакансию.
7. Возвращай ответ строго в формате валидного JSON по заданной схеме.`;

function buildSystemInstruction(roleInstruction: string): string {
  return `${roleInstruction}\n\n${GLOBAL_SYSTEM_RULES}\n\n${KNOWLEDGE_BASE}`;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ServerApiError(
      'Сервис ИИ временно не настроен на сервере. Пожалуйста, попробуйте позже.',
      500
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

class ServerApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'ServerApiError';
    this.statusCode = statusCode;
  }
}

function clamp(num: number, min: number, max: number): number {
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function parseJsonSafely<T>(rawText: string): T {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']');
    }

    if (start !== -1 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(slice) as T;
      } catch {
        // fall through
      }
    }

    throw new ServerApiError(
      'Не удалось разобрать JSON-ответ от ИИ. Попробуйте выполнить запрос ещё раз.',
      502
    );
  }
}

function extractErrorDetails(error: unknown): { status: number; message: string } {
  const errObj = error as {
    status?: number;
    statusCode?: number;
    code?: number;
    message?: string;
    cause?: { status?: number; statusCode?: number; code?: number; message?: string };
  } | null;

  const status =
    typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.statusCode === 'number'
        ? errObj.statusCode
        : typeof errObj?.code === 'number'
          ? errObj.code
          : typeof errObj?.cause?.status === 'number'
            ? errObj.cause.status
            : typeof errObj?.cause?.statusCode === 'number'
              ? errObj.cause.statusCode
              : 500;

  const message =
    typeof errObj?.message === 'string'
      ? errObj.message
      : typeof errObj?.cause?.message === 'string'
        ? errObj.cause.message
        : '';

  return { status, message };
}

function redactResumePii(text: string): string {
  // 1. Замена email-адресов
  let sanitized = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL]'
  );

  // 2. Замена URL-ссылок и ссылок на соцсети / профили
  sanitized = sanitized.replace(
    /(?:https?:\/\/|www\.)[^\s,;)>\]"']+/gi,
    '[ССЫЛКА]'
  );
  sanitized = sanitized.replace(
    /(?:t\.me|telegram\.me|telegram\.dog|vk\.com|linkedin\.com|instagram\.com|facebook\.com|fb\.com|ok\.ru|twitter\.com|x\.com|tiktok\.com|threads\.net|wa\.me|youtube\.com|youtu\.be|github\.com|gitlab\.com|behance\.net|dribbble\.com|hh\.ru|hh\.kz)\/[^\s,;)>\]"']+/gi,
    '[ССЫЛКА]'
  );
  // Хэндлы мессенджеров/соцсетей вида @username
  sanitized = sanitized.replace(
    /(^|[\s:(,])@[a-zA-Z0-9_]{3,}(?=$|[\s.,;!?)\]])/g,
    '$1[ССЫЛКА]'
  );

  // 3. Замена телефонных номеров (10–15 цифр, без ложных срабатываний на годы и суммы)
  sanitized = sanitized.replace(
    /(?:\+\d{1,3}[\s().-]*|(?<!\d)8[\s().-]*)(?:\(?\d{3,4}\)?[\s().-]*){1,2}\d{2,4}[\s().-]*\d{2}[\s().-]*\d{2,4}|\(\d{3,4}\)[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}/g,
    (match) => {
      const digitsCount = match.replace(/\D/g, '').length;
      return digitsCount >= 10 && digitsCount <= 15 ? '[ТЕЛЕФОН]' : match;
    }
  );

  return sanitized;
}

function mapGeminiError(error: unknown): ServerApiError {
  if (error instanceof ServerApiError) {
    return error;
  }

  const { status, message } = extractErrorDetails(error);

  if (
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|PERMISSION_DENIED|api[_ ]?key/i.test(message)
  ) {
    return new ServerApiError(
      'Ошибка авторизации сервиса ИИ на сервере. Попробуйте повторить запрос позже.',
      502
    );
  }

  if (status === 429 || /RESOURCE_EXHAUSTED|\b429\b/i.test(message)) {
    return new ServerApiError(
      'Слишком много запросов, подождите минуту и повторите',
      429
    );
  }

  if (status === 503 || /UNAVAILABLE|\b503\b/i.test(message)) {
    return new ServerApiError(
      'Слишком много запросов, подождите минуту и повторите',
      503
    );
  }

  if (status === 404 || /NOT_FOUND/i.test(message)) {
    return new ServerApiError(
      `Модель ${GEMINI_MODEL} недоступна. Попробуйте повторить запрос позже.`,
      502
    );
  }

  return new ServerApiError(
    'Ошибка при обращении к сервису ИИ. Попробуйте повторить запрос.',
    502
  );
}

function isRetryableGeminiError(error: unknown): boolean {
  const { status, message } = extractErrorDetails(error);
  return (
    status === 429 ||
    status === 503 ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|\b429\b|\b503\b/i.test(message)
  );
}

const RETRY_DELAYS_MS = [3000, 6000, 12000] as const;

async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const delayMs = RETRY_DELAYS_MS[attempt];
      if (delayMs === undefined || !isRetryableGeminiError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function generateStructuredJson<T>(
  prompt: string,
  systemInstruction: string,
  responseSchema: Record<string, unknown>,
  label: string
): Promise<{ data: T; meta: AiRequestMeta }> {
  const ai = getGeminiClient();
  const startedAt = performance.now();

  try {
    let lastJsonError: ServerApiError | null = null;

    // Если ответ не удалось разобрать как JSON — повторяем запрос один раз
    for (let jsonAttempt = 0; jsonAttempt < 2; jsonAttempt += 1) {
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.4,
          },
        })
      );

      const durationSeconds = Math.round(((performance.now() - startedAt) / 1000) * 100) / 100;
      const rawUsage = response.usageMetadata;
      const usage: AiTokenUsage | null = rawUsage
        ? {
            promptTokens:
              typeof rawUsage.promptTokenCount === 'number' ? rawUsage.promptTokenCount : undefined,
            candidatesTokens:
              typeof rawUsage.candidatesTokenCount === 'number'
                ? rawUsage.candidatesTokenCount
                : undefined,
            totalTokens:
              typeof rawUsage.totalTokenCount === 'number' ? rawUsage.totalTokenCount : undefined,
          }
        : null;

      const text = (response.text ?? '').trim();
      if (!text) {
        lastJsonError = new ServerApiError(
          'ИИ вернул некорректный или пустой ответ. Попробуйте повторить запрос.',
          502
        );
        continue;
      }

      try {
        const parsed = parseJsonSafely<T>(text);
        return {
          data: parsed,
          meta: {
            label,
            durationSeconds,
            usage,
          },
        };
      } catch (err) {
        lastJsonError =
          err instanceof ServerApiError
            ? err
            : new ServerApiError(
                'Не удалось разобрать JSON-ответ от ИИ. Попробуйте выполнить запрос ещё раз.',
                502
              );
      }
    }

    throw (
      lastJsonError ??
      new ServerApiError(
        'Не удалось разобрать JSON-ответ от ИИ. Попробуйте выполнить запрос ещё раз.',
        502
      )
    );
  } catch (error) {
    throw mapGeminiError(error);
  }
}

const app = express();
app.use(express.json({ limit: '15mb' }));

interface RawAnalysisResponse extends Partial<ResumeAnalysis> {
  isValidInput?: boolean;
  rejectionReason?: string;
}

app.post('/api/analyze', async (req, res) => {
  try {
    const body = req.body as { resumeText?: unknown; vacancyText?: unknown };
    const resumeText = typeof body?.resumeText === 'string' ? body.resumeText.trim() : '';
    const vacancyText = typeof body?.vacancyText === 'string' ? body.vacancyText.trim() : '';

    if (!resumeText || !vacancyText) {
      res.status(400).json({ error: 'Заполните текст резюме и описание вакансии.' });
      return;
    }

    const systemInstruction = buildSystemInstruction(
      'Ты — опытный HR-рекрутер и карьерный консультант, работающий с соискателями любых специальностей на рынке труда Казахстана (стандарты hh.kz). Помогаешь студентам, выпускникам, начинающим специалистам и людям, меняющим профессию.'
    );

    const prompt = `Сначала проверь входные данные. Если текст в поле «Резюме» или «Вакансия» явно не похож на резюме или описание вакансии (бессмысленный набор букв, случайный текст, запрос не по теме поиска работы), установи isValidInput = false и напиши вежливый отказ в rejectionReason с просьбой вставить настоящее резюме и/или вакансию.

Если входные данные корректны (isValidInput = true, rejectionReason = ""), выполни полный анализ резюме и вакансии по правилам встроенной базы знаний:

1. isValidInput: true/false.
2. rejectionReason: пустая строка при isValidInput = true, либо вежливый отказ при false.
3. matchScore: целое число от 0 до 100 по формуле весов (50% обязательные требования вакансии, 25% ключевые слова и инструменты для ATS, 15% опыт/проекты и достижения, 10% образование и языки).
4. summary: краткий вывод (2–3 предложения): из чего именно сложился итоговый процент (сильные совпадения и ключевой разрыв/следующий шаг).
5. extractedData:
   - education: список строк с образованием из резюме (если не указано, верни ["Не указано в резюме"]).
   - skills: список ключевых навыков, программ и инструментов из резюме в виде коротких тегов.
   - experience: список пунктов опыта работы, стажировок, практики или учебных/конкурсных проектов из резюме (если нет, верни ["Опыт не указан в резюме"]).
6. matchingSkills: 3–6 пунктов «Что уже подходит» (skill: навык/инструмент/требование из вакансии, explanation: краткое пояснение, как это подтверждено в резюме, включая синонимы).
7. missingSkills: 3–6 пунктов «Чего не хватает» (skill: отсутствующее ключевое слово, программа или требование строго из текста вакансии, explanation: почему это важно для ATS/рекрутера и как новичку закрыть пробел).
8. recommendations: 3–5 конкретных рекомендаций по улучшению разделов резюме с учётом чек-листа hh.kz (структура, совпадение должности, город/переезд/удалёнка, языки: казахский/русский/английский, ссылки/портфолио, формула «Действие + Цифра/Результат» с подсказкой метрик без выдумывания фактов).
9. improvedResumeText: готовый, структурированный, улучшенный текст резюме кандидата по стандартам hh.kz на русском языке, адаптированный под эту вакансию (строго без выдумывания несуществующего опыта или цифр — там, где не хватает метрик, можно оставить аккуратную подсказку в квадратных скобках, например [уточнить показатель]).

РЕЗЮМЕ КАНДИДАТА:
"""
${redactResumePii(resumeText)}
"""

ОПИСАНИЕ ВАКАНСИИ:
"""
${vacancyText}
"""`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        isValidInput: { type: Type.BOOLEAN },
        rejectionReason: { type: Type.STRING },
        matchScore: { type: Type.INTEGER },
        summary: { type: Type.STRING },
        extractedData: {
          type: Type.OBJECT,
          properties: {
            education: { type: Type.ARRAY, items: { type: Type.STRING } },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            experience: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['education', 'skills', 'experience'],
        },
        matchingSkills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skill: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['skill', 'explanation'],
          },
        },
        missingSkills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skill: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['skill', 'explanation'],
          },
        },
        recommendations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              section: { type: Type.STRING },
              issue: { type: Type.STRING },
              fix: { type: Type.STRING },
            },
            required: ['section', 'issue', 'fix'],
          },
        },
        improvedResumeText: { type: Type.STRING },
      },
      required: [
        'isValidInput',
        'rejectionReason',
        'matchScore',
        'summary',
        'extractedData',
        'matchingSkills',
        'missingSkills',
        'recommendations',
        'improvedResumeText',
      ],
    };

    const { data: raw, meta } = await generateStructuredJson<RawAnalysisResponse>(
      prompt,
      systemInstruction,
      schema,
      'Анализ резюме и вакансии'
    );

    if (raw.isValidInput === false) {
      const politeRefusal =
        raw.rejectionReason?.trim() ||
        'Похоже, в одном из полей указан текст, который не является резюме или описанием вакансии. Пожалуйста, вставьте реальное резюме и вакансию для анализа.';
      res.status(422).json({ error: politeRefusal });
      return;
    }

    const normalized: ResumeAnalysis = {
      matchScore: clamp(Number(raw.matchScore ?? 0), 0, 100),
      summary:
        (raw.summary ?? '').trim() ||
        'Анализ завершён. Ознакомьтесь с детальным разбором ниже.',
      extractedData: {
        education:
          Array.isArray(raw.extractedData?.education) &&
          raw.extractedData.education.length > 0
            ? raw.extractedData.education
            : ['Не указано в резюме'],
        skills: Array.isArray(raw.extractedData?.skills)
          ? raw.extractedData.skills
          : [],
        experience:
          Array.isArray(raw.extractedData?.experience) &&
          raw.extractedData.experience.length > 0
            ? raw.extractedData.experience
            : ['Опыт не указан в резюме'],
      },
      matchingSkills: Array.isArray(raw.matchingSkills) ? raw.matchingSkills : [],
      missingSkills: Array.isArray(raw.missingSkills) ? raw.missingSkills : [],
      recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
      improvedResumeText: (raw.improvedResumeText ?? '').trim(),
      _meta: meta,
    };

    res.json(normalized);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.statusCode).json({ error: mapped.message });
  }
});

app.post('/api/interview/questions', async (req, res) => {
  try {
    const body = req.body as {
      resumeText?: unknown;
      vacancyText?: unknown;
      analysis?: Partial<ResumeAnalysis>;
    };

    const resumeText = typeof body?.resumeText === 'string' ? body.resumeText.trim() : '';
    const vacancyText = typeof body?.vacancyText === 'string' ? body.vacancyText.trim() : '';
    const analysis = body?.analysis;

    if (!resumeText || !vacancyText) {
      res.status(400).json({ error: 'Недостаточно данных для генерации вопросов.' });
      return;
    }

    const systemInstruction = buildSystemInstruction(
      'Ты — профессиональный интервьюер и HR-специалист, который проводит собеседование для кандидатов любых специальностей (включая студентов, выпускников и соискателей при смене профессии).'
    );

    const gapsList = Array.isArray(analysis?.missingSkills)
      ? analysis.missingSkills.map((item) => item.skill).join(', ')
      : '';
    const strengthsList = Array.isArray(analysis?.matchingSkills)
      ? analysis.matchingSkills.map((item) => item.skill).join(', ')
      : '';

    const prompt = `Сгенерируй ровно 5 вопросов для тренировочного собеседования именно под эту вакансию и пробелы кандидата, строго соблюдая раздел 7 базы знаний:
- 2–3 профессиональных или кейсовых вопроса (по требованиям конкретной вакансии и пробелам кандидата);
- 2–3 поведенческих вопроса, на которые удобно отвечать по методу STAR (Ситуация — Задача — Действие — Результат) на основе опыта, практики, учёбы, проектов или прошлых ролей кандидата.

Сильные стороны кандидата: ${strengthsList || 'не выделены'}
Пробелы кандидата: ${gapsList || 'не выделены'}

РЕЗЮМЕ:
"""
${redactResumePii(resumeText)}
"""

ВАКАНСИЯ:
"""
${vacancyText}
"""

Для каждого из 5 вопросов укажи:
- id: номер от 1 до 5
- question: сам вопрос на русском языке
- focus: краткое пояснение (1 короткая фраза), что именно проверяет этот вопрос (например, «Профессиональный кейс: учёт в 1С» или «Поведенческий вопрос (STAR): работа в команде»).`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              question: { type: Type.STRING },
              focus: { type: Type.STRING },
            },
            required: ['id', 'question', 'focus'],
          },
        },
      },
      required: ['questions'],
    };

    const { data: raw, meta } = await generateStructuredJson<{ questions?: InterviewQuestion[] }>(
      prompt,
      systemInstruction,
      schema,
      'Генерация вопросов собеседования'
    );

    const questions = Array.isArray(raw.questions) ? raw.questions.slice(0, 5) : [];
    if (questions.length === 0) {
      throw new ServerApiError(
        'ИИ не смог сформировать список вопросов. Попробуйте ещё раз.',
        502
      );
    }

    res.json({
      questions: questions.map((q, index) => ({
        id: index + 1,
        question:
          q.question?.trim() ||
          'Расскажите о задаче или проекте из вашего опыта, которыми вы больше всего гордитесь.',
        focus: q.focus?.trim() || 'Соответствие требованиям вакансии',
      })),
      _meta: meta,
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.statusCode).json({ error: mapped.message });
  }
});

app.post('/api/interview/evaluate', async (req, res) => {
  try {
    const body = req.body as {
      question?: Partial<InterviewQuestion>;
      answer?: unknown;
      resumeText?: unknown;
      vacancyText?: unknown;
    };

    const questionText =
      typeof body?.question?.question === 'string' ? body.question.question.trim() : '';
    const questionFocus =
      typeof body?.question?.focus === 'string' ? body.question.focus.trim() : '';
    const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';
    const resumeText = typeof body?.resumeText === 'string' ? body.resumeText.trim() : '';
    const vacancyText = typeof body?.vacancyText === 'string' ? body.vacancyText.trim() : '';

    if (!questionText || !answer) {
      res.status(400).json({ error: 'Введите ответ на вопрос для оценки.' });
      return;
    }

    const systemInstruction = buildSystemInstruction(
      'Ты — доброжелательный и объективный карьерный коуч и интервьюер для кандидатов любых специальностей. Оценивай ответ строго по критериям STAR и шкале из базы знаний.'
    );

    const prompt = `Оцени ответ кандидата на вопрос собеседования по методу STAR, опираясь на раздел 7 базы знаний.

ВОПРОС ИНТЕРВЬЮЕРА:
"${questionText}"
(Фокус вопроса: ${questionFocus})

ОТВЕТ КАНДИДАТА:
"""
${answer}
"""

КОНТЕКСТ ВАКАНСИИ:
"""
${vacancyText.slice(0, 1500)}
"""

КОНТЕКСТ РЕЗЮМЕ КАНДИДАТА:
"""
${redactResumePii(resumeText).slice(0, 1500)}
"""

Верни JSON со следующими полями:
1. score: целое число от 1 до 10 по шкале: 1–3 (нет структуры), 4–6 (есть часть пунктов STAR), 7–8 (структурно и конкретно), 9–10 (структурно, с цифрами и выводами).
2. star: разбор по каждому из 4 компонентов (present: true если компонент раскрыт в ответе, false если отсутствует или раскрыт слишком поверхностно; comment: короткий конкретный комментарий):
   - situation (Ситуация)
   - task (Задача)
   - action (Действие)
   - result (Результат)
3. improvements: массив из 2–4 конкретных советов, что именно улучшить в этом ответе.
4. strongExample: пример сильного улучшенного ответа по методу STAR (от первого лица, 4–6 предложений), основанный строго на реальных фактах из резюме кандидата (без вымышленных проектов или компаний).`;

    const criterionSchema = {
      type: Type.OBJECT,
      properties: {
        present: { type: Type.BOOLEAN },
        comment: { type: Type.STRING },
      },
      required: ['present', 'comment'],
    };

    const schema = {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        star: {
          type: Type.OBJECT,
          properties: {
            situation: criterionSchema,
            task: criterionSchema,
            action: criterionSchema,
            result: criterionSchema,
          },
          required: ['situation', 'task', 'action', 'result'],
        },
        improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
        strongExample: { type: Type.STRING },
      },
      required: ['score', 'star', 'improvements', 'strongExample'],
    };

    const { data: raw, meta } = await generateStructuredJson<Partial<AnswerEvaluation>>(
      prompt,
      systemInstruction,
      schema,
      'Оценка ответа по STAR'
    );

    const normalized: AnswerEvaluation = {
      score: clamp(Number(raw.score ?? 5), 1, 10),
      star: {
        situation: {
          present: Boolean(raw.star?.situation?.present),
          comment: raw.star?.situation?.comment?.trim() || 'Контекст ситуации не раскрыт.',
        },
        task: {
          present: Boolean(raw.star?.task?.present),
          comment: raw.star?.task?.comment?.trim() || 'Поставленная задача не обозначена.',
        },
        action: {
          present: Boolean(raw.star?.action?.present),
          comment: raw.star?.action?.comment?.trim() || 'Личные действия не описаны.',
        },
        result: {
          present: Boolean(raw.star?.result?.present),
          comment: raw.star?.result?.comment?.trim() || 'Итоговый результат не приведён.',
        },
      },
      improvements:
        Array.isArray(raw.improvements) && raw.improvements.length > 0
          ? raw.improvements
          : ['Добавьте больше конкретики о ваших личных действиях и измеримом результате.'],
      strongExample:
        raw.strongExample?.trim() ||
        'Опишите конкретную ситуацию из вашего резюме, задачу, предпринятые шаги и достигнутый результат.',
      _meta: meta,
    };

    res.json(normalized);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.statusCode).json({ error: mapped.message });
  }
});

app.post('/api/interview/summary', async (req, res) => {
  try {
    const body = req.body as {
      records?: InterviewAnswerRecord[];
      vacancyText?: unknown;
    };

    const records = Array.isArray(body?.records) ? body.records : [];
    const vacancyText = typeof body?.vacancyText === 'string' ? body.vacancyText.trim() : '';

    if (records.length === 0) {
      res.status(400).json({ error: 'Нет ответов для подведения итогов.' });
      return;
    }

    const scores = records.map((r) => Number(r.evaluation?.score ?? 0));
    const computedAvg =
      scores.length > 0
        ? Math.round((scores.reduce((acc, s) => acc + s, 0) / scores.length) * 10) / 10
        : 0;

    const systemInstruction = buildSystemInstruction(
      'Ты — карьерный коуч, подводящий итоги тренировочного собеседования для кандидатов любых специальностей.'
    );

    const digest = records
      .map(
        (r, idx) =>
          `Вопрос ${idx + 1}: ${r.question.question}\nБалл: ${r.evaluation.score}/10\nSTAR: S=${r.evaluation.star.situation.present}, T=${r.evaluation.star.task.present}, A=${r.evaluation.star.action.present}, R=${r.evaluation.star.result.present}\nЧто улучшить: ${r.evaluation.improvements.join('; ')}`
      )
      .join('\n\n');

    const prompt = `Подведи итог тренировочного собеседования из ${records.length} вопросов под вакансию.
Средний балл кандидата: ${computedAvg} из 10.

ИСТОРИЯ ОТВЕТОВ:
${digest}

ФРАГМЕНТ ВАКАНСИИ:
"""
${vacancyText.slice(0, 1200)}
"""

Верни JSON:
- overallVerdict: краткое резюме готовности кандидата к собеседованию (2–3 предложения).
- mainRecommendations: 3–5 главных практических рекомендаций, на чём сфокусироваться перед реальным интервью.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        overallVerdict: { type: Type.STRING },
        mainRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['overallVerdict', 'mainRecommendations'],
    };

    const { data: raw, meta } = await generateStructuredJson<{
      overallVerdict?: string;
      mainRecommendations?: string[];
    }>(prompt, systemInstruction, schema, 'Итоги собеседования');

    const summary: InterviewSummary = {
      averageScore: computedAvg,
      overallVerdict:
        raw.overallVerdict?.trim() ||
        'Тренировка завершена. Вы отработали ключевые вопросы под вакансию.',
      mainRecommendations:
        Array.isArray(raw.mainRecommendations) && raw.mainRecommendations.length > 0
          ? raw.mainRecommendations
          : [
              'Структурируйте каждый кейс по методу STAR, уделяя особое внимание личным действиям и результату.',
            ],
      _meta: meta,
    };

    res.json(summary);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.statusCode).json({ error: mapped.message });
  }
});

app.post('/api/development-plan', async (req, res) => {
  try {
    const body = req.body as {
      missingSkills?: SkillComparisonItem[];
      resumeText?: unknown;
      vacancyText?: unknown;
    };

    const missingSkills = Array.isArray(body?.missingSkills)
      ? body.missingSkills.slice(0, 5)
      : [];
    const resumeText = typeof body?.resumeText === 'string' ? body.resumeText.trim() : '';
    const vacancyText = typeof body?.vacancyText === 'string' ? body.vacancyText.trim() : '';

    if (!vacancyText || !resumeText) {
      res.status(400).json({ error: 'Недостаточно данных для составления плана развития.' });
      return;
    }

    const systemInstruction = buildSystemInstruction(
      'Ты — карьерный ментор и специалист по обучению и развитию (L&D) для соискателей любых специальностей. Составляешь реалистичные 4-недельные планы закрытия пробелов под конкретную вакансию.'
    );

    const gapsFormatted =
      missingSkills.length > 0
        ? missingSkills
            .map((item, idx) => `${idx + 1}. ${item.skill}: ${item.explanation}`)
            .join('\n')
        : 'Явных критических пробелов не выявлено — сфокусируйся на углублении ключевых требований вакансии.';

    const prompt = `Составь практический «План развития на 4 недели» на основе списка недостающих навыков из анализа (максимум 5 навыков, в порядке приоритета для данной вакансии).

СПИСОК НЕДОСТАЮЩИХ НАВЫКОВ ИЗ АНАЛИЗА:
${gapsFormatted}

РЕЗЮМЕ КАНДИДАТА:
"""
${redactResumePii(resumeText).slice(0, 2000)}
"""

ВАКАНСИЯ:
"""
${vacancyText.slice(0, 2000)}
"""

СТРОГИЕ ПРАВИЛА:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать URL-ссылки, названия конкретных курсов, онлайн-школ, платформ или авторов. Указывай ТОЛЬКО типы ресурсов (например: «официальная документация инструмента», «бесплатный видеокурс по нужной программе», «учебный мини-проект», «интерактивный тренажёр по теме», «разбор практических кейсов и шаблонов»).
2. Для каждого из недостающих навыков (максимум 5, по убыванию приоритета) укажи:
   - priority: число от 1 до 5
   - skill: название навыка/инструмента
   - whyImportant: почему это важно именно для этой вакансии
   - whatToLearn: чему конкретно научиться (конкретные темы/операции)
   - practiceFormat: формат практики (мини-проект, учебное задание или портфолио-работа с понятной задачей)
   - resourceTypes: 2–3 типа ресурсов (без ссылок и брендов!)
   - resumeProof: чем конкретно доказать освоенный навык в резюме (без выдумывания коммерческого опыта)
3. Разбей обучение и практику на 4 недели (Неделя 1, Неделя 2, Неделя 3, Неделя 4):
   - week: 1, 2, 3, 4
   - title: понятное название этапа недели
   - goal: главная цель недели
   - tasks: 3–4 конкретных проверяемых задания (id: уникальная строка например "w1-t1", title: формулировка задачи, resourceType: тип ресурса, relatedSkill: связанный навык)
4. В блоке resumeUpdatePreview опиши «Как обновится резюме после выполнения плана»:
   - summary: как изменится профиль кандидата и готовность к отклику после 4 недель
   - updatedBullets: 3–4 готовых примера новых пунктов для раздела проектов/навыков в резюме по формуле «Действие + Цифра/Результат» (на основе выполненных учебных заданий/портфолио-работ из плана)
   - addedKeywords: список ключевых слов для ATS, которые кандидат сможет честно добавить в резюме.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        skills: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              priority: { type: Type.INTEGER },
              skill: { type: Type.STRING },
              whyImportant: { type: Type.STRING },
              whatToLearn: { type: Type.STRING },
              practiceFormat: { type: Type.STRING },
              resourceTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
              resumeProof: { type: Type.STRING },
            },
            required: [
              'priority',
              'skill',
              'whyImportant',
              'whatToLearn',
              'practiceFormat',
              'resourceTypes',
              'resumeProof',
            ],
          },
        },
        weeks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              week: { type: Type.INTEGER },
              title: { type: Type.STRING },
              goal: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    resourceType: { type: Type.STRING },
                    relatedSkill: { type: Type.STRING },
                  },
                  required: ['id', 'title', 'resourceType', 'relatedSkill'],
                },
              },
            },
            required: ['week', 'title', 'goal', 'tasks'],
          },
        },
        resumeUpdatePreview: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            updatedBullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            addedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'updatedBullets', 'addedKeywords'],
        },
      },
      required: ['skills', 'weeks', 'resumeUpdatePreview'],
    };

    const { data: raw, meta } = await generateStructuredJson<Partial<DevelopmentPlan>>(
      prompt,
      systemInstruction,
      schema,
      'План развития на 4 недели'
    );

    const normalizedSkills = Array.isArray(raw.skills)
      ? raw.skills.slice(0, 5).map((item, idx) => ({
          priority: idx + 1,
          skill: item.skill?.trim() || `Навык ${idx + 1}`,
          whyImportant: item.whyImportant?.trim() || 'Важное требование данной вакансии.',
          whatToLearn: item.whatToLearn?.trim() || 'Изучить базовые принципы и практическое применение.',
          practiceFormat: item.practiceFormat?.trim() || 'Учебный мини-проект',
          resourceTypes:
            Array.isArray(item.resourceTypes) && item.resourceTypes.length > 0
              ? item.resourceTypes
              : ['официальная документация инструмента', 'учебный мини-проект'],
          resumeProof:
            item.resumeProof?.trim() ||
            'Описать выполненную учебную работу в разделе проектов и добавить ключевой навык.',
        }))
      : [];

    const normalizedWeeks = Array.isArray(raw.weeks)
      ? raw.weeks.slice(0, 4).map((w, wIdx) => ({
          week: wIdx + 1,
          title: w.title?.trim() || `Неделя ${wIdx + 1}`,
          goal: w.goal?.trim() || 'Закрепление приоритетных навыков на практике.',
          tasks: Array.isArray(w.tasks)
            ? w.tasks.map((t, tIdx) => ({
                id: t.id?.trim() || `w${wIdx + 1}-t${tIdx + 1}`,
                title: t.title?.trim() || 'Выполнить практическое задание',
                resourceType: t.resourceType?.trim() || 'учебное задание',
                relatedSkill: t.relatedSkill?.trim() || '',
              }))
            : [],
        }))
      : [];

    const plan: DevelopmentPlan = {
      skills: normalizedSkills,
      weeks: normalizedWeeks,
      resumeUpdatePreview: {
        summary:
          raw.resumeUpdatePreview?.summary?.trim() ||
          'После выполнения плана вы закроете ключевые пробелы и сможете подтвердить новые навыки учебными работами.',
        updatedBullets: Array.isArray(raw.resumeUpdatePreview?.updatedBullets)
          ? raw.resumeUpdatePreview.updatedBullets
          : [],
        addedKeywords: Array.isArray(raw.resumeUpdatePreview?.addedKeywords)
          ? raw.resumeUpdatePreview.addedKeywords
          : [],
      },
      _meta: meta,
    };

    res.json(plan);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.statusCode).json({ error: mapped.message });
  }
});

function extractJobTitleFromVacancyText(text: string): string | null {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 6)) {
    const labeled = line.match(
      /^(?:название должности|должность|вакансия|позиция|role|position|title)\s*[:—-]\s*(.+)$/i
    );
    if (labeled && labeled[1]) {
      const candidate = labeled[1].trim();
      if (candidate.length >= 2 && candidate.length <= 100) {
        return candidate;
      }
    }
  }

  const firstLine = lines[0] ?? '';
  if (
    firstLine.length >= 3 &&
    firstLine.length <= 90 &&
    !/^(о компании|обязанности|требования|условия|описание)\s*[:—-]?$/i.test(firstLine)
  ) {
    return firstLine.replace(/[:—-]+$/, '').trim();
  }

  return null;
}

app.post('/api/vacancy/from-images', async (req, res) => {
  try {
    const body = req.body as {
      images?: Array<{ mimeType?: unknown; data?: unknown }>;
    };

    const rawImages = Array.isArray(body?.images) ? body.images.slice(0, 5) : [];
    const validImages = rawImages
      .filter(
        (img): img is { mimeType: string; data: string } =>
          Boolean(
            img &&
              typeof img.mimeType === 'string' &&
              typeof img.data === 'string' &&
              img.data.trim().length > 0 &&
              /^image\/(jpeg|jpg|png|webp)$/i.test(img.mimeType)
          )
      )
      .map((img) => ({
        inlineData: {
          mimeType: img.mimeType === 'image/jpg' ? 'image/jpeg' : img.mimeType,
          data: img.data,
        },
      }));

    if (validImages.length === 0) {
      res.status(400).json({ error: 'Загрузите JPG, PNG или WEBP до 10 МБ' });
      return;
    }

    const ai = getGeminiClient();
    const startedAt = performance.now();

    const ocrPrompt =
      'Это скриншот или фото вакансии. Распознай текст и выпиши вакансию полностью на языке оригинала: название должности, компания, город, обязанности, требования, условия, зарплата, если указана. Если изображений несколько, объедини их в один текст по порядку. Ничего не выдумывай и не пропускай требования. Если на изображении нет вакансии, ответь одним словом: ОШИБКА';

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [...validImages, { text: ocrPrompt }],
        },
        config: {
          temperature: 0.1,
        },
      })
    );

    const durationSeconds = Math.round(((performance.now() - startedAt) / 1000) * 100) / 100;
    const rawUsage = response.usageMetadata;
    const usage: AiTokenUsage | null = rawUsage
      ? {
          promptTokens:
            typeof rawUsage.promptTokenCount === 'number' ? rawUsage.promptTokenCount : undefined,
          candidatesTokens:
            typeof rawUsage.candidatesTokenCount === 'number'
              ? rawUsage.candidatesTokenCount
              : undefined,
          totalTokens:
            typeof rawUsage.totalTokenCount === 'number' ? rawUsage.totalTokenCount : undefined,
        }
      : null;

    const recognized = (response.text ?? '').trim();
    if (!recognized || /^ОШИБКА[.!]?$/i.test(recognized)) {
      res.status(422).json({
        error: 'Не удалось найти вакансию на изображении. Попробуйте другой снимок или вставьте текст',
      });
      return;
    }

    res.json({
      text: recognized,
      jobTitle: extractJobTitleFromVacancyText(recognized),
      _meta: {
        label: 'Распознавание вакансии с изображения',
        durationSeconds,
        usage,
      },
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.statusCode).json({ error: mapped.message });
  }
});

app.post('/api/vacancy/from-url', async (req, res) => {
  try {
    const body = req.body as { url?: unknown };
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Введите корректную ссылку на вакансию (https://...).' });
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      res.status(400).json({ error: 'Поддерживаются только ссылки http:// и https://.' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let htmlText = '';
    try {
      const pageRes = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!pageRes.ok) {
        res.status(422).json({
          error: 'Не удалось загрузить страницу по ссылке. Скопируйте текст или загрузите скриншот вакансии.',
        });
        return;
      }
      htmlText = await pageRes.text();
    } catch {
      res.status(422).json({
        error: 'Не удалось открыть ссылку. Скопируйте текст или загрузите скриншот вакансии.',
      });
      return;
    } finally {
      clearTimeout(timer);
    }

    const stripped = htmlText
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 14000);

    if (!stripped) {
      res.status(422).json({
        error: 'На странице не найден текст вакансии. Вставьте текст вручную или загрузите скриншот.',
      });
      return;
    }

    const ai = getGeminiClient();
    const startedAt = performance.now();
    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Извлеки из текста веб-страницы только описание вакансии на языке оригинала: название должности, компания, город, обязанности, требования, условия, зарплата (если указана). Удали меню сайта, рекламу и посторонние блоки. Ничего не выдумывай. Если вакансии нет, ответь одним словом: ОШИБКА\n\nТЕКСТ СТРАНИЦЫ:\n${stripped}`,
        config: { temperature: 0.1 },
      })
    );

    const durationSeconds = Math.round(((performance.now() - startedAt) / 1000) * 100) / 100;
    const rawUsage = response.usageMetadata;
    const usage: AiTokenUsage | null = rawUsage
      ? {
          promptTokens:
            typeof rawUsage.promptTokenCount === 'number' ? rawUsage.promptTokenCount : undefined,
          candidatesTokens:
            typeof rawUsage.candidatesTokenCount === 'number'
              ? rawUsage.candidatesTokenCount
              : undefined,
          totalTokens:
            typeof rawUsage.totalTokenCount === 'number' ? rawUsage.totalTokenCount : undefined,
        }
      : null;

    const extracted = (response.text ?? '').trim();
    if (!extracted || /^ОШИБКА[.!]?$/i.test(extracted)) {
      res.status(422).json({
        error: 'Не удалось найти вакансию по этой ссылке. Вставьте текст вручную или загрузите скриншот.',
      });
      return;
    }

    res.json({
      text: extracted,
      jobTitle: extractJobTitleFromVacancyText(extracted),
      _meta: {
        label: 'Извлечение вакансии по ссылке',
        durationSeconds,
        usage,
      },
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.statusCode).json({ error: mapped.message });
  }
});

const GOOGLE_FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScfyOG3NBTIaOl6Czu_Aok7AG_ZSQMhZexB8imCOZvSK1qZLg/formResponse';

const ALLOWED_FEEDBACK_BLOCKS = new Set([
  'Анализ навыков',
  'Улучшение резюме',
  'План развития',
  'Тренажёр собеседования',
]);

const ALLOWED_FEEDBACK_RATINGS = new Set(['Полезно', 'Не точно']);

app.post('/api/feedback', async (req, res) => {
  try {
    const body = req.body as {
      block?: unknown;
      rating?: unknown;
      comment?: unknown;
    };

    const block = typeof body?.block === 'string' ? body.block.trim() : '';
    const rating = typeof body?.rating === 'string' ? body.rating.trim() : '';
    const rawComment = body?.comment;

    if (!block || block.length > 100 || !ALLOWED_FEEDBACK_BLOCKS.has(block)) {
      res.status(400).json({ error: 'Некорректное название блока для отзыва.' });
      return;
    }

    if (!rating || rating.length > 50 || !ALLOWED_FEEDBACK_RATINGS.has(rating)) {
      res.status(400).json({ error: 'Некорректная оценка отзыва.' });
      return;
    }

    if (rawComment !== undefined && rawComment !== null && typeof rawComment !== 'string') {
      res.status(400).json({ error: 'Комментарий должен быть строкой.' });
      return;
    }

    const comment = typeof rawComment === 'string' ? rawComment.trim() : '';
    if (comment.length > 1000) {
      res.status(400).json({ error: 'Комментарий не должен превышать 1000 символов.' });
      return;
    }

    const formParams = new URLSearchParams();
    formParams.set('entry.1487439502', block);
    formParams.set('entry.1286542735', rating);
    formParams.set('entry.602582333', comment);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const formResponse = await fetch(GOOGLE_FEEDBACK_FORM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: formParams.toString(),
        signal: controller.signal,
      });

      if (!formResponse.ok) {
        res.status(502).json({ error: 'Не удалось отправить, попробуйте ещё раз' });
        return;
      }

      res.json({ ok: true });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    res.status(502).json({ error: 'Не удалось отправить, попробуйте ещё раз' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CareerAI server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
