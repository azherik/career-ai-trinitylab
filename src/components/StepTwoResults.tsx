import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  GraduationCap,
  Loader2,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import {
  downloadAnalysisReportPdf,
  downloadAnalysisReportTxt,
  downloadImprovedResumePdf,
  downloadImprovedResumeTxt,
} from '../lib/exportDocuments';
import { KNOWLEDGE_BASE_CRITERIA } from '../lib/knowledgeBase';
import type { AiRequestMeta, ResumeAnalysis } from '../types/career';
import { BlockFeedback } from './BlockFeedback';
import { DevelopmentPlanSection } from './DevelopmentPlanSection';
import { MatchGauge } from './MatchGauge';

interface StepTwoResultsProps {
  analysis: ResumeAnalysis;
  resumeText: string;
  vacancyText: string;
  isTestMode: boolean;
  aiMetrics: AiRequestMeta[];
  onAiMeta: (meta: AiRequestMeta) => void;
}

export function StepTwoResults({
  analysis,
  resumeText,
  vacancyText,
  isTestMode,
  aiMetrics,
  onAiMeta,
}: StepTwoResultsProps) {
  const [copied, setCopied] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isExportingResumePdf, setIsExportingResumePdf] = useState(false);
  const [isExportingReportPdf, setIsExportingReportPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleCopyResume = async () => {
    try {
      await navigator.clipboard.writeText(analysis.improvedResumeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy method if Clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = analysis.improvedResumeText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadResumePdf = async () => {
    setExportError(null);
    setIsExportingResumePdf(true);
    try {
      await downloadImprovedResumePdf(analysis.improvedResumeText);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Не удалось сформировать PDF-файл резюме.'
      );
    } finally {
      setIsExportingResumePdf(false);
    }
  };

  const handleDownloadReportPdf = async () => {
    setExportError(null);
    setIsExportingReportPdf(true);
    try {
      await downloadAnalysisReportPdf(analysis);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Не удалось сформировать PDF-отчёт анализа.'
      );
    } finally {
      setIsExportingReportPdf(false);
    }
  };

  return (
    <section id="step-2" className="scroll-mt-20 space-y-8 border-t border-slate-200 pt-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-wide text-indigo-600">
            Шаг 2 из 3
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Результаты анализа
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadReportPdf}
            disabled={isExportingReportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExportingReportPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" aria-hidden="true" />
            ) : (
              <FileDown className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
            )}
            <span>Скачать отчёт анализа (PDF)</span>
          </button>

          <button
            type="button"
            onClick={() => downloadAnalysisReportTxt(analysis)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
            <span>Скачать отчёт анализа (TXT)</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <span>{exportError}</span>
        </div>
      )}

      {/* 1. Круговой индикатор соответствия */}
      <MatchGauge score={analysis.matchScore} summary={analysis.summary} />

      {/* 2. Данные из резюме */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-bold text-slate-900">Данные из резюме</h3>
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <GraduationCap className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              <span>Образование</span>
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
              {analysis.extractedData.education.map((edu, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{edu}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Wrench className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              <span>Навыки</span>
            </div>
            {analysis.extractedData.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.extractedData.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Ключевые навыки не выделены.</p>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Briefcase className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              <span>Опыт и проекты</span>
            </div>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
              {analysis.extractedData.experience.map((exp, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{exp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Анализ навыков (две колонки) */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Анализ навыков</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Что уже подходит */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>Что уже подходит</span>
            </div>
            <div className="space-y-3">
              {analysis.matchingSkills.length > 0 ? (
                analysis.matchingSkills.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4"
                  >
                    <p className="text-sm font-semibold text-emerald-950">{item.skill}</p>
                    <p className="mt-1 text-sm leading-relaxed text-emerald-900/90">
                      {item.explanation}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Прямых совпадений не обнаружено.
                </div>
              )}
            </div>
          </div>

          {/* Чего не хватает */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <span>Чего не хватает</span>
            </div>
            <div className="space-y-3">
              {analysis.missingSkills.length > 0 ? (
                analysis.missingSkills.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"
                  >
                    <p className="text-sm font-semibold text-amber-950">{item.skill}</p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
                      {item.explanation}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">
                  Критичных пробелов не найдено — резюме закрывает основные требования!
                </div>
              )}
            </div>
          </div>
        </div>

        <BlockFeedback blockId="skillsAnalysis" blockLabel="Анализ навыков" />
      </div>

      {/* 4. Улучшение резюме */}
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-slate-900">Улучшение резюме</h3>

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {analysis.recommendations.map((rec, index) => (
            <div key={index} className="p-5">
              <p className="text-sm font-bold text-indigo-700">{rec.section}</p>
              <div className="mt-2.5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Что не так</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">{rec.issue}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Как исправить</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">{rec.fix}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Готовый улучшенный текст резюме */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Готовый улучшенный текст резюме
              </h4>
              <p className="mt-0.5 text-xs text-slate-600">
                Адаптировано под выбранную вакансию с учётом ваших сильных сторон
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadResumePdf}
                disabled={isExportingResumePdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isExportingResumePdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Скачать улучшенное резюме (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadImprovedResumeTxt(analysis.improvedResumeText)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                <span>Скачать (TXT)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyResume}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    <span className="text-emerald-700">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                    <span>Скопировать</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-sans text-sm leading-relaxed text-slate-800">
            {analysis.improvedResumeText}
          </pre>
        </div>

        <BlockFeedback blockId="resumeImprovement" blockLabel="Улучшение резюме" />
      </div>

      {/* 5. План развития на 4 недели (четвёртая функция результатов) */}
      <DevelopmentPlanSection
        missingSkills={analysis.missingSkills}
        resumeText={resumeText}
        vacancyText={vacancyText}
        onAiMeta={onAiMeta}
      />

      {isTestMode && aiMetrics.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Activity className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <span>Режим тестирования: телеметрия запросов к ИИ</span>
          </div>

          <div className="mt-3 divide-y divide-indigo-100 rounded-lg border border-indigo-100 bg-white">
            {aiMetrics.map((metric, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center"
              >
                <span className="font-semibold text-slate-800">{metric.label}</span>
                <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-slate-600">
                  <span>Время ответа: {metric.durationSeconds.toFixed(2)} сек</span>
                  {metric.usage && typeof metric.usage.totalTokens === 'number' ? (
                    <span>
                      Токены: {metric.usage.totalTokens}
                      {typeof metric.usage.promptTokens === 'number' &&
                      typeof metric.usage.candidatesTokens === 'number'
                        ? ` (вход: ${metric.usage.promptTokens}, выход: ${metric.usage.candidatesTokens})`
                        : ''}
                    </span>
                  ) : (
                    <span>Токены не переданы API</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Сворачиваемый блок: На каких правилах работает ИИ */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setIsRulesOpen((prev) => !prev)}
          aria-expanded={isRulesOpen}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors rounded-xl cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-900">
              На каких правилах работает ИИ
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
              isRulesOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {isRulesOpen && (
          <div className="border-t border-slate-200 px-5 py-5">
            <ul className="space-y-3.5">
              {KNOWLEDGE_BASE_CRITERIA.map((item) => (
                <li key={item.number} className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-indigo-600 shrink-0">
                    {item.number}.
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
