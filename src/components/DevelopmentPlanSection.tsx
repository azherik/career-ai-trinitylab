import {
  AlertCircle,
  CalendarDays,
  Check,
  Download,
  FileCheck2,
  Loader2,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { GeminiApiError, generateDevelopmentPlan } from '../lib/gemini';
import { useRetryNotice } from '../lib/useRetryNotice';
import type { AiRequestMeta, DevelopmentPlan, SkillComparisonItem } from '../types/career';
import { BlockFeedback } from './BlockFeedback';

interface DevelopmentPlanSectionProps {
  missingSkills: SkillComparisonItem[];
  resumeText: string;
  vacancyText: string;
  onAiMeta?: (meta: AiRequestMeta) => void;
}

export function DevelopmentPlanSection({
  missingSkills,
  resumeText,
  vacancyText,
  onAiMeta,
}: DevelopmentPlanSectionProps) {
  const [plan, setPlan] = useState<DevelopmentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, boolean>>({});
  const isRetrying = useRetryNotice(isLoading);

  const handleGeneratePlan = async () => {
    if (isLoading) return;
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const generated = await generateDevelopmentPlan(missingSkills, resumeText, vacancyText);
      setPlan(generated);
      setCompletedTaskIds({});
      if (generated._meta && onAiMeta) {
        onAiMeta(generated._meta);
      }
    } catch (err) {
      if (err instanceof GeminiApiError || err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Не удалось составить план развития. Попробуйте ещё раз.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const allTasks = plan ? plan.weeks.flatMap((w) => w.tasks) : [];
  const completedCount = allTasks.filter((t) => completedTaskIds[t.id]).length;
  const totalTasks = allTasks.length;

  const handleDownloadTxt = () => {
    if (!plan) return;

    const lines: string[] = [];
    lines.push('CAREERAI — ПЛАН РАЗВИТИЯ НА 4 НЕДЕЛИ');
    lines.push('======================================');
    lines.push('');
    lines.push('1. ПРИОРИТЕТНЫЕ НАВЫКИ ДЛЯ ИЗУЧЕНИЯ:');
    lines.push('');

    plan.skills.forEach((item) => {
      lines.push(`${item.priority}. ${item.skill}`);
      lines.push(`   - Почему важно для вакансии: ${item.whyImportant}`);
      lines.push(`   - Чему научиться: ${item.whatToLearn}`);
      lines.push(`   - Формат практики: ${item.practiceFormat}`);
      lines.push(`   - Типы ресурсов: ${item.resourceTypes.join(', ')}`);
      lines.push(`   - Чем доказать в резюме: ${item.resumeProof}`);
      lines.push('');
    });

    lines.push('2. ПЛАН ПО НЕДЕЛЯМ (НЕДЕЛЯ 1–4):');
    lines.push('');

    plan.weeks.forEach((week) => {
      lines.push(`Неделя ${week.week}. ${week.title}`);
      lines.push(`Цель: ${week.goal}`);
      week.tasks.forEach((task) => {
        const mark = completedTaskIds[task.id] ? '[x]' : '[ ]';
        const skillTag = task.relatedSkill ? ` (${task.relatedSkill})` : '';
        lines.push(`  ${mark} ${task.title}${skillTag} — ресурс: ${task.resourceType}`);
      });
      lines.push('');
    });

    lines.push('3. КАК ОБНОВИТСЯ РЕЗЮМЕ ПОСЛЕ ВЫПОЛНЕНИЯ ПЛАНА:');
    lines.push('');
    lines.push(plan.resumeUpdatePreview.summary);
    if (plan.resumeUpdatePreview.updatedBullets.length > 0) {
      lines.push('');
      lines.push('Новые формулировки для резюме:');
      plan.resumeUpdatePreview.updatedBullets.forEach((bullet) => {
        lines.push(`  • ${bullet}`);
      });
    }
    if (plan.resumeUpdatePreview.addedKeywords.length > 0) {
      lines.push('');
      lines.push(`Добавленные ключевые слова: ${plan.resumeUpdatePreview.addedKeywords.join(', ')}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plan-razvitiya-4-nedeli.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">План развития на 4 недели</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Персональная дорожная карта по приоритетным недостающим навыкам из анализа.
          </p>
        </div>

        {plan && (
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 sm:self-auto cursor-pointer"
          >
            <Download className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <span>Скачать план (TXT)</span>
          </button>
        )}
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

      {!plan ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="max-w-xl space-y-1.5">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Target className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                <span>Пошаговый план закрытия пробелов</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                ИИ разберёт до 5 приоритетных недостающих навыков, подберёт формат практики и
                типы ресурсов, составит чек-лист на Недели 1–4 и покажет, как обновится ваше
                резюме.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>
                {isLoading
                  ? isRetrying
                    ? 'Сервис занят, повторяю попытку...'
                    : 'Составляю план...'
                  : 'Составить план развития'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Приоритетные навыки */}
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {plan.skills.map((item) => (
              <div key={item.priority} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-base font-bold text-slate-900">
                    <span className="mr-2 font-mono text-sm font-semibold text-indigo-600">
                      0{item.priority}.
                    </span>
                    {item.skill}
                  </h4>
                  <span className="text-xs font-semibold text-slate-500">
                    Приоритет {item.priority}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Почему это важно для вакансии
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">
                      {item.whyImportant}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Чему конкретно научиться</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">
                      {item.whatToLearn}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Формат практики</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">
                      {item.practiceFormat}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Чем доказать в резюме</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">
                      {item.resumeProof}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">Типы ресурсов:</span>
                  {item.resourceTypes.map((resType, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700"
                    >
                      {resType}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Недели 1–4 с чекбоксами */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                <h4 className="text-base font-bold text-slate-900">Чек-лист на 4 недели</h4>
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-600">
                Выполнено: {completedCount} из {totalTasks}
              </span>
            </div>

            {totalTasks > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${(completedCount / totalTasks) * 100}%` }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {plan.weeks.map((week) => (
                <div
                  key={week.week}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <p className="font-mono text-xs font-semibold text-indigo-600">
                      Неделя {week.week}
                    </p>
                    <h5 className="mt-0.5 text-base font-bold text-slate-900">{week.title}</h5>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{week.goal}</p>
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {week.tasks.map((task) => {
                      const isChecked = Boolean(completedTaskIds[task.id]);
                      return (
                        <li key={task.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50 transition-colors">
                            <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleTask(task.id)}
                                className="peer sr-only"
                              />
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                                  isChecked
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isChecked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-sm leading-snug ${
                                  isChecked
                                    ? 'text-slate-400 line-through'
                                    : 'font-medium text-slate-800'
                                }`}
                              >
                                {task.title}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                {task.relatedSkill && <span>{task.relatedSkill}</span>}
                                {task.relatedSkill && <span aria-hidden="true">·</span>}
                                <span>{task.resourceType}</span>
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Как обновится резюме после выполнения плана */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileCheck2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h4>Как обновится резюме после выполнения плана</h4>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
              {plan.resumeUpdatePreview.summary}
            </p>

            {plan.resumeUpdatePreview.updatedBullets.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  Какие формулировки можно будет добавить в резюме:
                </p>
                <ul className="space-y-1.5 text-sm leading-relaxed text-slate-800">
                  {plan.resumeUpdatePreview.updatedBullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-600" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.resumeUpdatePreview.addedKeywords.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  Новые ключевые слова:
                </span>
                {plan.resumeUpdatePreview.addedKeywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-900"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          <BlockFeedback blockId="developmentPlan" blockLabel="План развития" />
        </div>
      )}
    </div>
  );
}
