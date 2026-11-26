import type {
  AiRequestMeta,
  AnswerEvaluation,
  DevelopmentPlan,
  InterviewAnswerRecord,
  InterviewQuestion,
  InterviewSummary,
  ResumeAnalysis,
  SkillComparisonItem,
} from '../types/career';

export class GeminiApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'GeminiApiError';
    this.statusCode = statusCode;
  }
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

  if (!payload || typeof payload !== 'object') {
    throw new GeminiApiError('Сервер вернул некорректный ответ. Попробуйте повторить запрос.');
  }

  const elapsedSeconds = Math.round(((performance.now() - startedAt) / 1000) * 100) / 100;
  const typed = payload as TResponse & { _meta?: AiRequestMeta };
  if (typed._meta && typeof typed._meta.durationSeconds !== 'number') {
    typed._meta.durationSeconds = elapsedSeconds;
  }

  return typed;
}

export async function analyzeResumeAndVacancy(
  resumeText: string,
  vacancyText: string
): Promise<ResumeAnalysis> {
  return postJson<ResumeAnalysis>('/api/analyze', { resumeText, vacancyText });
}

export async function generateDevelopmentPlan(
  missingSkills: SkillComparisonItem[],
  resumeText: string,
  vacancyText: string
): Promise<DevelopmentPlan> {
  return postJson<DevelopmentPlan>('/api/development-plan', {
    missingSkills,
    resumeText,
    vacancyText,
  });
}

export async function generateInterviewQuestions(
  resumeText: string,
  vacancyText: string,
  analysis: ResumeAnalysis
): Promise<{ questions: InterviewQuestion[]; _meta?: AiRequestMeta }> {
  return postJson<{ questions: InterviewQuestion[]; _meta?: AiRequestMeta }>(
    '/api/interview/questions',
    {
      resumeText,
      vacancyText,
      analysis,
    }
  );
}

export async function evaluateInterviewAnswer(
  question: InterviewQuestion,
  answer: string,
  resumeText: string,
  vacancyText: string
): Promise<AnswerEvaluation> {
  return postJson<AnswerEvaluation>('/api/interview/evaluate', {
    question,
    answer,
    resumeText,
    vacancyText,
  });
}

export async function summarizeInterviewSession(
  records: InterviewAnswerRecord[],
  vacancyText: string
): Promise<InterviewSummary> {
  return postJson<InterviewSummary>('/api/interview/summary', { records, vacancyText });
}
