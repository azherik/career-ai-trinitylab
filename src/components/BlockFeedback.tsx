import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { saveFeedbackComment, updateFeedbackVote } from '../lib/feedbackStorage';
import type { FeedbackBlockId } from '../types/career';

interface BlockFeedbackProps {
  blockId: FeedbackBlockId;
  blockLabel: string;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function BlockFeedback({ blockId, blockLabel }: BlockFeedbackProps) {
  const [vote, setVote] = useState<'helpful' | 'inaccurate' | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const sendFeedback = async (rating: 'Полезно' | 'Не точно', comment?: string): Promise<boolean> => {
    setSubmitState('submitting');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          block: blockLabel,
          rating,
          ...(comment ? { comment } : {}),
        }),
      });

      if (!response.ok) {
        setSubmitState('error');
        return false;
      }

      setSubmitState('success');
      return true;
    } catch {
      setSubmitState('error');
      return false;
    }
  };

  const handleVote = (nextVote: 'helpful' | 'inaccurate') => {
    if (submitState === 'submitting') return;

    const voteChanged = vote !== nextVote;
    if (voteChanged) {
      updateFeedbackVote(blockId, vote, nextVote);
      setVote(nextVote);
    }

    if (nextVote === 'helpful') {
      setShowCommentBox(false);
      if (voteChanged || submitState === 'error' || submitState === 'idle') {
        void sendFeedback('Полезно');
      }
    } else {
      setShowCommentBox(true);
      if (voteChanged || submitState === 'success') {
        setSubmitState('idle');
      }
    }
  };

  const handleSubmitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (submitState === 'submitting') return;

    const trimmed = commentText.trim().slice(0, 1000);
    if (trimmed) {
      saveFeedbackComment(blockId, trimmed);
    }

    const ok = await sendFeedback('Не точно', trimmed || undefined);
    if (ok) {
      setShowCommentBox(false);
      setCommentText('');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-600">
          Оцените блок «{blockLabel}»:
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitState === 'submitting'}
            onClick={() => handleVote('helpful')}
            aria-pressed={vote === 'helpful'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
              vote === 'helpful'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>👍 Полезно</span>
          </button>

          <button
            type="button"
            disabled={submitState === 'submitting'}
            onClick={() => handleVote('inaccurate')}
            aria-pressed={vote === 'inaccurate'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
              vote === 'inaccurate'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>👎 Не точно</span>
          </button>
        </div>
      </div>

      {submitState === 'submitting' && !showCommentBox && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>Отправляю отзыв...</span>
        </p>
      )}

      {submitState === 'success' && !showCommentBox && (
        <p className="mt-2 text-xs font-medium text-emerald-700">Спасибо за отзыв!</p>
      )}

      {submitState === 'error' && !showCommentBox && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          Не удалось отправить, попробуйте ещё раз
        </p>
      )}

      {showCommentBox && (
        <form onSubmit={handleSubmitComment} className="mt-3 space-y-2.5 border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`feedback-comment-${blockId}`}
              className="block text-xs font-semibold text-slate-700"
            >
              Что не так? (необязательно)
            </label>
            <span className="text-[11px] text-slate-400">{commentText.length}/1000</span>
          </div>
          <textarea
            id={`feedback-comment-${blockId}`}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Например: не учтён мой учебный проект или слишком общий совет..."
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
          />

          {submitState === 'error' && (
            <p role="alert" className="text-xs font-medium text-red-700">
              Не удалось отправить, попробуйте ещё раз
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submitState === 'submitting'}
              onClick={() => setShowCommentBox(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer disabled:opacity-50"
            >
              Закрыть
            </button>
            <button
              type="submit"
              disabled={submitState === 'submitting'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitState === 'submitting' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              <span>{submitState === 'submitting' ? 'Отправляю...' : 'Отправить'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
