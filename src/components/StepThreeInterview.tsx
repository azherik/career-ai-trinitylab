import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  evaluateInterviewAnswer,
  GeminiApiError,
  generateInterviewQuestions,
  summarizeInterviewSession,
} from '../lib/gemini';
import { useRetryNotice } from '../lib/useRetryNotice';
import type {
  AiRequestMeta,
  AnswerEvaluation,
  InterviewAnswerRecord,
  InterviewQuestion,
  InterviewSummary,
  ResumeAnalysis,
} from '../types/career';
import { BlockFeedback } from './BlockFeedback';

interface StepThreeInterviewProps {
  resumeText: string;
  vacancyText: string;
  analysis: ResumeAnalysis;
  onAiMeta?: (meta: AiRequestMeta) => void;
}

type TrainerStage = 'idle' | 'question' | 'summary';

export function StepThreeInterview({
  resumeText,
  vacancyText,
  analysis,
  onAiMeta,
}: StepThreeInterviewProps) {
  const [stage, setStage] = useState<TrainerStage>('idle');
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [currentEvaluation, setCurrentEvaluation] = useState<AnswerEvaluation | null>(null);
  const [records, setRecords] = useState<InterviewAnswerRecord[]>([]);
  const [summary, setSummary] = useState<InterviewSummary | null>(null);

  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRetrying = useRetryNotice(isGeneratingQuestions || isEvaluating || isSummarizing);

  const handleError = (err: unknown) => {
    if (err instanceof GeminiApiError || err instanceof Error) {
      setErrorMsg(err.message);
    } else {
      setErrorMsg('Произошла непредвиденная ошибка. Попробуйте ещё раз.');
    }
  };

  const handleStartTraining = async () => {
    if (isGeneratingQuestions) return;
    setErrorMsg(null);
    setIsGeneratingQuestions(true);

    try {
      const result = await generateInterviewQuestions(resumeText, vacancyText, analysis);
      setQuestions(result.questions);
      setCurrentIndex(0);
      setAnswerText('');
      setCurrentEvaluation(null);
      setRecords([]);
      setSummary(null);
      setStage('question');
      if (result._meta && onAiMeta) {
        onAiMeta(result._meta);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleSubmitAnswer = async () => {
    const activeQuestion = questions[currentIndex];
    if (!activeQuestion || !answerText.trim() || isEvaluating) return;

    setErrorMsg(null);
    setIsEvaluating(true);

    try {
      const evaluation = await evaluateInterviewAnswer(
        activeQuestion,
        answerText.trim(),
        resumeText,
        vacancyText
      );
      setCurrentEvaluation(evaluation);
      setRecords((prev) => [
        ...prev.slice(0, currentIndex),
        {
          question: activeQuestion,
          answer: answerText.trim(),
          evaluation,
        },
      ]);
      if (evaluation._meta && onAiMeta) {
        onAiMeta(evaluation._meta);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextQuestion = async () => {
    if (isSummarizing) return;
    const nextIdx = currentIndex + 1;
    if (nextIdx < questions.length) {
      setCurrentIndex(nextIdx);
      setAnswerText('');
      setCurrentEvaluation(null);
      setErrorMsg(null);
      return;
    }

    // Завершение последнего вопроса — генерируем итог
    setErrorMsg(null);
    setIsSummarizing(true);
    try {
      const finalSummary = await summarizeInterviewSession(records, vacancyText);
      setSummary(finalSummary);
      setStage('summary');
      if (finalSummary._meta && onAiMeta) {
        onAiMeta(finalSummary._meta);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const activeQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const starItems = currentEvaluation
    ? [
        { key: 'S', label: 'Ситуация', data: currentEvaluation.star.situation },
        { key: 'T', label: 'Задача', data: currentEvaluation.star.task },
        { key: 'A', label: 'Действие', data: currentEvaluation.star.action },
        { key: 'R', label: 'Результат', data: currentEvaluation.star.result },
      ]
    : [];

  return (
    <section id="step-3" className="scroll-mt-20 space-y-6 border-t border-slate-200 pt-12">
      <div>
        <p className="text-xs font-semibold tracking-wide text-indigo-600">
          Шаг 3 из 3
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Тренажёр собеседования
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Отработайте 5 вопросов под эту вакансию и получите разбор каждого ответа по методу STAR.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {stage === 'idle' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="max-w-xl space-y-1.5">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                <MessageSquare className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                <span>Персональное тренировочное интервью</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                ИИ составит 5 вопросов с учётом требований вакансии и ваших пробелов, а затем
                оценит каждый ответ по критериям Ситуация, Задача, Действие и Результат.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartTraining}
              disabled={isGeneratingQuestions}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isGeneratingQuestions && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>
                {isGeneratingQuestions
                  ? isRetrying
                    ? 'Сервис занят, повторяю попытку...'
                    : 'Составляю вопросы...'
                  : 'Начать тренировку собеседования'}
              </span>
            </button>
          </div>
        </div>
      )}

      {stage === 'question' && activeQuestion && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-sm font-semibold tabular-nums text-indigo-600">
                Вопрос {currentIndex + 1} из {questions.length}
              </span>
              <span className="text-xs font-medium text-slate-500">
                Фокус: {activeQuestion.focus}
              </span>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>

            <h3 className="mt-5 text-lg font-bold leading-snug text-slate-900 sm:text-xl">
              {activeQuestion.question}
            </h3>

            <div className="mt-5">
              <label htmlFor="interview-answer-textarea" className="sr-only">
                Ваш ответ на вопрос собеседования
              </label>
              <textarea
                id="interview-answer-textarea"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                disabled={isEvaluating || Boolean(currentEvaluation)}
                rows={5}
                placeholder="Опишите конкретную ситуацию, вашу задачу, предпринятые действия и итоговый результат..."
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 disabled:bg-slate-50 disabled:text-slate-700"
              />
            </div>

            {!currentEvaluation && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={!answerText.trim() || isEvaluating}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer"
                >
                  {isEvaluating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {isEvaluating
                      ? isRetrying
                        ? 'Сервис занят, повторяю попытку...'
                        : 'Оцениваю ответ...'
                      : 'Отправить ответ'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {currentEvaluation && (
            <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Разбор ответа по методу STAR
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Оценка структуры и убедительности ответа
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-bold tabular-nums text-indigo-600">
                    {currentEvaluation.score}
                  </span>
                  <span className="font-mono text-sm font-medium text-slate-500">/ 10</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {starItems.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-lg border p-4 ${
                      item.data.present
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-amber-200 bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {item.key} · {item.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          item.data.present ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        {item.data.present ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Есть</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Нет</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                      {item.data.comment}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-bold text-slate-900">Что улучшить</h5>
                <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                  {currentEvaluation.improvements.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-600" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
                <h5 className="text-sm font-bold text-indigo-950">Пример сильного ответа</h5>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                  {currentEvaluation.strongExample}
                </p>
              </div>

              <BlockFeedback
                key={`eval-${currentIndex}`}
                blockId="interviewEvaluation"
                blockLabel="Тренажёр собеседования"
              />

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={isSummarizing}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70 transition-colors cursor-pointer"
                >
                  {isSummarizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>
                        {isRetrying ? 'Сервис занят, повторяю попытку...' : 'Подвожу итоги...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {isLastQuestion ? 'Завершить и посмотреть итоги' : 'Следующий вопрос'}
                      </span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'summary' && summary && (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Award className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Итоги тренировки</h3>
                <p className="mt-0.5 text-sm text-slate-600">
                  Пройдено вопросов: {records.length} из {questions.length}
                </p>
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-600 mr-1.5">Средний балл:</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-indigo-600">
                {summary.averageScore}
              </span>
              <span className="font-mono text-sm text-slate-500">/ 10</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-900">Общий вывод</h4>
            <p className="text-sm leading-relaxed text-slate-700">{summary.overallVerdict}</p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-sm font-bold text-slate-900">Главные рекомендации</h4>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
              {summary.mainRecommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <span className="font-mono text-xs font-bold text-indigo-600 mt-0.5">
                    0{idx + 1}.
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-sm font-bold text-slate-900">Результаты по вопросам</h4>
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {records.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 text-slate-800">
                    <span className="font-mono text-xs text-slate-500 mr-2">#{idx + 1}</span>
                    {rec.question.question}
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-indigo-600 shrink-0">
                    {rec.evaluation.score}/10
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleStartTraining}
              disabled={isGeneratingQuestions}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isGeneratingQuestions ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isGeneratingQuestions
                  ? isRetrying
                    ? 'Сервис занят, повторяю попытку...'
                    : 'Генерирую новые вопросы...'
                  : 'Пройти тренировку заново'}
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
