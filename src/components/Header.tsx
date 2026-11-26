interface HeaderProps {
  hasResults: boolean;
  isTestMode: boolean;
  onToggleTestMode: (enabled: boolean) => void;
}

export function Header({ hasResults, isTestMode, onToggleTestMode }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-8 sm:px-6">
        <a
          href="#step-1"
          className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-xl"
        >
          Career<span className="text-indigo-600">AI</span>
        </a>

        <nav
          aria-label="Навигация по шагам"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <a
            href="#step-1"
            className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0"
          >
            Ввод данных
          </a>
          <a
            href="#step-2"
            className={`transition-colors whitespace-nowrap shrink-0 ${
              hasResults ? 'hover:text-indigo-600 text-slate-600' : 'text-slate-400 pointer-events-none'
            }`}
            aria-disabled={!hasResults}
          >
            Результаты
          </a>
          <a
            href="#step-3"
            className={`transition-colors whitespace-nowrap shrink-0 ${
              hasResults ? 'hover:text-indigo-600 text-slate-600' : 'text-slate-400 pointer-events-none'
            }`}
            aria-disabled={!hasResults}
          >
            Собеседование
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={isTestMode}
            onClick={() => onToggleTestMode(!isTestMode)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer sm:gap-2.5 sm:px-3.5 sm:py-2"
          >
            <span>Режим тестирования</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                isTestMode ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                  isTestMode ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
