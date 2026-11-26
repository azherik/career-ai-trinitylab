interface MatchGaugeProps {
  score: number;
  summary: string;
}

export function MatchGauge({ score, summary }: MatchGaugeProps) {
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const getVisualTier = (value: number) => {
    if (value < 50) {
      return {
        stroke: '#DC2626',
        textClass: 'text-red-600',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        label: 'Низкое соответствие',
      };
    }
    if (value < 75) {
      return {
        stroke: '#D97706',
        textClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        label: 'Среднее соответствие',
      };
    }
    return {
      stroke: '#16A34A',
      textClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
      label: 'Высокое соответствие',
    };
  };

  const tier = getVisualTier(clampedScore);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="10"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={tier.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`font-mono text-2xl font-bold tabular-nums ${tier.textClass}`}>
              {clampedScore}%
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold text-slate-900">Соответствие вакансии</h3>
            <span
              className={`text-xs font-semibold ${tier.textClass}`}
            >
              · {tier.label}
            </span>
          </div>
          <p className="text-base leading-relaxed text-slate-700">{summary}</p>
        </div>
      </div>
    </div>
  );
}
