import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import { extractTextFromResumeFile } from '../lib/fileParser';
import {
  extractVacancyFromImages,
  isSupportedVacancyImage,
  MAX_VACANCY_IMAGES,
} from '../lib/vacancyImport';
import { useRetryNotice } from '../lib/useRetryNotice';
import type { AiRequestMeta } from '../types/career';

interface StepOneInputProps {
  resumeText: string;
  vacancyText: string;
  onResumeChange: (value: string) => void;
  onVacancyChange: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analysisError: string | null;
  onAiMeta?: (meta: AiRequestMeta) => void;
}

type VacancyInputTab = 'text' | 'images';

interface UploadedVacancyImage {
  id: string;
  file: File;
  previewUrl: string;
}

const SAMPLE_RESUME = `Алексей Смирнов
Москва · Студент 4 курса, Прикладная информатика (НИУ ВШЭ, выпуск 2026)
GitHub: github.com/alexey-smirnov-dev · Telegram: @asmirnov_dev

Цель: Junior Frontend-разработчик / стажёр

Образование:
НИУ ВШЭ, Факультет компьютерных наук — Бакалавриат «Прикладная информатика», 2022–2026.

Навыки:
JavaScript (ES6+), TypeScript, React, HTML5, CSS3, Tailwind CSS, Git, REST API, Figma, базовый SQL.

Учебные и pet-проекты:
1. Трекер учебных дедлайнов «StudyFlow» (командный проект, 3 месяца)
— Разработал интерфейс на React и TypeScript, настроил фильтрацию задач по дисциплинам и статусам.
— Подключил REST API и сохранение состояния в localStorage.

2. Лендинг и каталог для локальной кофейни (учебная практика)
— Сверстал адаптивный интерфейс на HTML/CSS и Tailwind, оптимизировал загрузку изображений.

Опыт работы:
Волонтёр технической поддержки студенческого хакатона (осень 2025): помогал участникам с настройкой окружения и Git.`;

const SAMPLE_VACANCY = `Junior Frontend-разработчик (React / TypeScript)

О компании:
Развиваем образовательную платформу для онлайн-курсов и корпоративного обучения.

Задачи:
— Разработка новых пользовательских интерфейсов на React 18+ и TypeScript;
— Интеграция с backend через REST API и обработка ошибок / состояний загрузки;
— Адаптивная вёрстка по макетам из Figma с использованием Tailwind CSS;
— Написание модульных тестов (Vitest / React Testing Library) и участие в code review;
— Оптимизация производительности клиентских приложений.

Требования:
— Уверенное знание JavaScript (ES6+), TypeScript и React (хуки, управление состоянием);
— Опыт работы с Git и командной разработки;
— Понимание принципов адаптивной вёрстки и доступности (a11y);
— Будет плюсом: опыт с Next.js, базовые знания Docker или CI/CD, написание unit-тестов.

Условия:
— Гибрид или удалёнка, гибкий график от 30 часов в неделю (можно совмещать с учёбой);
— Менторство от Senior-разработчика и понятный план роста до Middle.`;

export function StepOneInput({
  resumeText,
  vacancyText,
  onResumeChange,
  onVacancyChange,
  onAnalyze,
  isAnalyzing,
  analysisError,
  onAiMeta,
}: StepOneInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const vacancyFileInputRef = useRef<HTMLInputElement | null>(null);
  const vacancyCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [vacancyTab, setVacancyTab] = useState<VacancyInputTab>('text');
  const [vacancyImages, setVacancyImages] = useState<UploadedVacancyImage[]>([]);
  const [isVacancyDragging, setIsVacancyDragging] = useState(false);
  const [isRecognizingVacancy, setIsRecognizingVacancy] = useState(false);
  const [vacancyImportError, setVacancyImportError] = useState<string | null>(null);
  const [autoRecognizedInfo, setAutoRecognizedInfo] = useState<{ jobTitle: string | null } | null>(
    null
  );

  const vacancyImagesRef = useRef<UploadedVacancyImage[]>([]);
  vacancyImagesRef.current = vacancyImages;

  const isAnalyzeRetrying = useRetryNotice(isAnalyzing);
  const isOcrRetrying = useRetryNotice(isRecognizingVacancy);

  useEffect(() => {
    return () => {
      for (const item of vacancyImagesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const canAnalyze =
    Boolean(resumeText.trim() && vacancyText.trim()) && !isAnalyzing && !isParsingFile;

  const processFile = async (file: File) => {
    setFileError(null);
    setIsParsingFile(true);
    try {
      const extracted = await extractTextFromResumeFile(file);
      onResumeChange(extracted);
      setUploadedFileName(file.name);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось прочитать файл, вставьте текст резюме вручную';
      setFileError(message);
      setUploadedFileName(null);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const addVacancyImages = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    setVacancyImportError(null);

    const invalidFound = incomingFiles.some((file) => !isSupportedVacancyImage(file));
    const validFiles = incomingFiles.filter((file) => isSupportedVacancyImage(file));

    if (invalidFound) {
      setVacancyImportError('Загрузите JPG, PNG или WEBP до 10 МБ');
    }

    if (validFiles.length === 0) {
      return;
    }

    setVacancyImages((prev) => {
      const remainingSlots = MAX_VACANCY_IMAGES - prev.length;
      if (remainingSlots <= 0) {
        setVacancyImportError(`Можно загрузить максимум ${MAX_VACANCY_IMAGES} изображений.`);
        return prev;
      }

      const toAdd = validFiles.slice(0, remainingSlots).map((file, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      if (validFiles.length > remainingSlots) {
        setVacancyImportError(
          `Добавлены первые ${remainingSlots} из ${validFiles.length}: максимум ${MAX_VACANCY_IMAGES} изображений.`
        );
      }

      return [...prev, ...toAdd];
    });
  };

  const handleRemoveVacancyImage = (id: string) => {
    setVacancyImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
    setVacancyImportError(null);
  };

  const handleVacancyImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    addVacancyImages(files);
    event.target.value = '';
  };

  const handleVacancyImageDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsVacancyDragging(false);
    const files = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
    addVacancyImages(files);
  };

  const handleVacancyPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const clipboardFiles: File[] = [];
    const items = event.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            clipboardFiles.push(file);
          }
        }
      }
    }

    if (clipboardFiles.length === 0 && event.clipboardData?.files?.length) {
      clipboardFiles.push(...Array.from(event.clipboardData.files));
    }

    if (clipboardFiles.length > 0) {
      event.preventDefault();
      setVacancyTab('images');
      addVacancyImages(clipboardFiles);
    }
  };

  const handleRecognizeVacancyImages = async () => {
    if (vacancyImages.length === 0 || isRecognizingVacancy) return;

    setVacancyImportError(null);
    setIsRecognizingVacancy(true);

    try {
      const result = await extractVacancyFromImages(vacancyImages.map((item) => item.file));
      onVacancyChange(result.text);
      setAutoRecognizedInfo({ jobTitle: result.jobTitle });
      if (result._meta && onAiMeta) {
        onAiMeta(result._meta);
      }
      setVacancyTab('text');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось найти вакансию на изображении. Попробуйте другой снимок или вставьте текст';
      setVacancyImportError(message);
    } finally {
      setIsRecognizingVacancy(false);
    }
  };

  const handleClearVacancy = () => {
    onVacancyChange('');
    setAutoRecognizedInfo(null);
    setVacancyImportError(null);
    setVacancyImages((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  };

  const handleFillSample = () => {
    setFileError(null);
    setUploadedFileName(null);
    setAutoRecognizedInfo(null);
    setVacancyImportError(null);
    setVacancyTab('text');
    onResumeChange(SAMPLE_RESUME);
    onVacancyChange(SAMPLE_VACANCY);
  };

  return (
    <section id="step-1" className="scroll-mt-20">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-wide text-indigo-600">
            Шаг 1 из 3
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Ввод данных
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Загрузите резюме или вставьте текст, затем добавьте описание интересующей вакансии.
          </p>
        </div>

        <button
          type="button"
          onClick={handleFillSample}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Заполнить пример</span>
        </button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {/* Левая карточка: Ваше резюме */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">Ваше резюме</h3>
            {resumeText.trim() && (
              <button
                type="button"
                onClick={() => {
                  onResumeChange('');
                  setUploadedFileName(null);
                  setFileError(null);
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Очистить
              </button>
            )}
          </div>

          {isParsingFile ? (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/40 px-4 py-5 text-sm font-medium text-indigo-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Извлекаю текст из файла...</span>
            </div>
          ) : uploadedFileName ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50/40 px-4 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                <span className="truncate font-medium text-slate-800">
                  {uploadedFileName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  Заменить
                </button>
                <button
                  type="button"
                  onClick={() => setUploadedFileName(null)}
                  aria-label="Убрать имя файла"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/60'
                  : 'border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/30'
              }`}
            >
              <Upload className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-800">
                Загрузите файл резюме или перетащите сюда
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Поддерживаются форматы PDF, DOCX, TXT (до 5 МБ)
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />

          {fileError && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{fileError}</span>
            </div>
          )}

          <label htmlFor="resume-textarea" className="sr-only">
            Текст резюме
          </label>
          <textarea
            id="resume-textarea"
            value={resumeText}
            onChange={(e) => onResumeChange(e.target.value)}
            placeholder="Или вставьте текст вашего резюме сюда: образование, навыки, учебные проекты, стажировки..."
            rows={10}
            className="w-full flex-1 resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
          />
        </div>

        {/* Правая карточка: Описание вакансии */}
        <div
          onPaste={handleVacancyPaste}
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">Описание вакансии</h3>
            {(vacancyText.trim() || vacancyImages.length > 0) && (
              <button
                type="button"
                onClick={handleClearVacancy}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Очистить
              </button>
            )}
          </div>

          {/* Вкладки способов ввода вакансии */}
          <div
            role="tablist"
            aria-label="Способ ввода описания вакансии"
            className="mb-4 inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={vacancyTab === 'text'}
              onClick={() => setVacancyTab('text')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                vacancyTab === 'text'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Текст
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vacancyTab === 'images'}
              onClick={() => setVacancyTab('images')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                vacancyTab === 'images'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Фото / скриншот</span>
              {vacancyImages.length > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-bold text-indigo-700">
                  {vacancyImages.length}
                </span>
              )}
            </button>
          </div>

          {vacancyTab === 'text' ? (
            <div className="flex flex-1 flex-col">
              {autoRecognizedInfo && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-900">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-medium">
                      Текст распознан автоматически. Проверьте его перед анализом
                    </p>
                    {autoRecognizedInfo.jobTitle && (
                      <p className="mt-0.5 text-indigo-700">
                        Должность: <span className="font-semibold">{autoRecognizedInfo.jobTitle}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <label htmlFor="vacancy-textarea" className="sr-only">
                Текст описания вакансии
              </label>
              <textarea
                id="vacancy-textarea"
                value={vacancyText}
                onChange={(e) => onVacancyChange(e.target.value)}
                placeholder="Вставьте полное описание вакансии: название позиции, задачи, обязательные и желательные требования..."
                rows={13}
                className="w-full flex-1 resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsVacancyDragging(true);
                }}
                onDragLeave={() => setIsVacancyDragging(false)}
                onDrop={handleVacancyImageDrop}
                onClick={() => vacancyFileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    vacancyFileInputRef.current?.click();
                  }
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${
                  isVacancyDragging
                    ? 'border-indigo-500 bg-indigo-50/60'
                    : 'border-slate-300 bg-slate-50/70 hover:border-indigo-400 hover:bg-indigo-50/30'
                }`}
              >
                <ImagePlus className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-slate-800">
                  Загрузите скриншоты вакансии или вставьте через Ctrl+V
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  До {MAX_VACANCY_IMAGES} изображений: JPG, PNG, WEBP (до 10 МБ каждое)
                </p>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => vacancyCameraInputRef.current?.click()}
                  disabled={vacancyImages.length >= MAX_VACANCY_IMAGES || isRecognizingVacancy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Сделать фото</span>
                </button>
                <span className="text-xs text-slate-500">
                  Загружено: {vacancyImages.length} из {MAX_VACANCY_IMAGES}
                </span>
              </div>

              <input
                ref={vacancyFileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                multiple
                onChange={handleVacancyImageInputChange}
                className="hidden"
              />

              <input
                ref={vacancyCameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleVacancyImageInputChange}
                className="hidden"
              />

              {vacancyImages.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {vacancyImages.map((img, index) => (
                    <div
                      key={img.id}
                      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={img.previewUrl}
                        alt={`Скриншот вакансии ${index + 1}`}
                        className="h-24 w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVacancyImage(img.id)}
                        aria-label={`Удалить изображение ${index + 1}`}
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/75 text-white hover:bg-red-600 transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {vacancyImportError && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{vacancyImportError}</span>
                </div>
              )}

              <div className="mt-auto pt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleRecognizeVacancyImages}
                  disabled={vacancyImages.length === 0 || isRecognizingVacancy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer"
                >
                  {isRecognizingVacancy && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  )}
                  <span>
                    {isRecognizingVacancy
                      ? isOcrRetrying
                        ? 'Сервис занят, повторяю попытку...'
                        : 'Распознаю текст...'
                      : 'Распознать вакансию'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-center text-xs font-medium text-slate-500">
          Не вставляйте паспортные данные и адрес
        </p>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:w-auto sm:min-w-[280px] transition-colors cursor-pointer"
        >
          {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          <span>
            {isAnalyzing
              ? isAnalyzeRetrying
                ? 'Сервис занят, повторяю попытку...'
                : 'Анализирую...'
              : 'Проанализировать соответствие'}
          </span>
        </button>

        {!resumeText.trim() || !vacancyText.trim() ? (
          <p className="text-center text-xs text-slate-500">
            Заполните оба поля (резюме и описание вакансии), чтобы запустить анализ
          </p>
        ) : null}

        {analysisError && (
          <div
            role="alert"
            className="mt-2 flex w-full max-w-2xl items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <span>{analysisError}</span>
          </div>
        )}
      </div>
    </section>
  );
}
