import { ExternalLink, MessageSquareHeart } from 'lucide-react';
import { useState } from 'react';
import { Header } from './components/Header';
import { StepOneInput } from './components/StepOneInput';
import { StepThreeInterview } from './components/StepThreeInterview';
import { StepTwoResults } from './components/StepTwoResults';
import { FEEDBACK_FORM_URL } from './lib/config';
import { getTestMode, setTestMode } from './lib/feedbackStorage';
import { analyzeResumeAndVacancy, GeminiApiError } from './lib/gemini';
import type { AiRequestMeta, ResumeAnalysis } from './types/career';

export default function App() {
  const [resumeText, setResumeText] = useState('');
  const [vacancyText, setVacancyText] = useState('');

  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [analysisRunId, setAnalysisRunId] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [isTestMode, setIsTestMode] = useState<boolean>(() => getTestMode());
  const [aiMetrics, setAiMetrics] = useState<AiRequestMeta[]>([]);

  const handleToggleTestMode = (enabled: boolean) => {
    setIsTestMode(enabled);
    setTestMode(enabled);
  };

  const handleRecordAiMeta = (meta: AiRequestMeta) => {
    setAiMetrics((prev) => [...prev, meta]);
  };

  const handleAnalyze = async () => {
    if (isAnalyzing || !resumeText.trim() || !vacancyText.trim()) return;

    setAnalysisError(null);
    setIsAnalyzing(true);

    try {
      const result = await analyzeResumeAndVacancy(resumeText.trim(), vacancyText.trim());
      setAnalysis(result);
      setAnalysisRunId((prev) => prev + 1);
      setAiMetrics(result._meta ? [result._meta] : []);

      requestAnimationFrame(() => {
        const el = document.getElementById('step-2');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    } catch (err) {
      if (err instanceof GeminiApiError || err instanceof Error) {
        setAnalysisError(err.message);
      } else {
        setAnalysisError('Не удалось выполнить анализ. Попробуйте ещё раз.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/40 text-slate-900 flex flex-col">
      <Header
        hasResults={Boolean(analysis)}
        isTestMode={isTestMode}
        onToggleTestMode={handleToggleTestMode}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-10 max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
            Подготовьте резюме и пройдите собеседование уверенно
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Интеллектуальный помощник для студентов, выпускников и начинающих специалистов:
            оцените совпадение с вакансией, улучшите резюме и потренируйтесь отвечать по методу
            STAR.
          </p>
        </div>

        <div className="space-y-12">
          <StepOneInput
            resumeText={resumeText}
            vacancyText={vacancyText}
            onResumeChange={setResumeText}
            onVacancyChange={setVacancyText}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            analysisError={analysisError}
            onAiMeta={handleRecordAiMeta}
          />

          {analysis && (
            <>
              <StepTwoResults
                key={`results-${analysisRunId}`}
                analysis={analysis}
                resumeText={resumeText}
                vacancyText={vacancyText}
                isTestMode={isTestMode}
                aiMetrics={aiMetrics}
                onAiMeta={handleRecordAiMeta}
              />
              <StepThreeInterview
                key={`interview-${analysisRunId}`}
                resumeText={resumeText}
                vacancyText={vacancyText}
                analysis={analysis}
                onAiMeta={handleRecordAiMeta}
              />
            </>
          )}

          {/* Карточка обратной связи в конце страницы */}
          <section
            aria-label="Обратная связь"
            className="border-t border-slate-200 pt-10"
          >
            <div className="flex flex-col items-start justify-between gap-5 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:p-7">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <MessageSquareHeart className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Помогите улучшить CareerAI
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
                    Поделитесь впечатлениями о точности анализа, плане развития и тренажёре
                    собеседования — это займёт пару минут.
                  </p>
                </div>
              </div>

              <a
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Оставить отзыв</span>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <span className="font-medium text-slate-600">CareerAI</span>
          <span>
            Учебный прототип. ИИ может ошибаться, проверяйте рекомендации. Резюме не сохраняются
            и передаются только в Gemini API для анализа
          </span>
        </div>
      </footer>
    </div>
  );
}
