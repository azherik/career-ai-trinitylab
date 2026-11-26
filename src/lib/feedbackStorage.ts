import type { FeedbackBlockId } from '../types/career';

const FEEDBACK_STORAGE_KEY = 'careerai_user_feedback';
const TEST_MODE_STORAGE_KEY = 'careerai_test_mode';

export interface FeedbackCommentEntry {
  block: FeedbackBlockId;
  comment: string;
  createdAt: string;
}

export interface FeedbackCounters {
  helpful: number;
  inaccurate: number;
}

export interface StoredFeedbackData {
  counts: Record<FeedbackBlockId, FeedbackCounters>;
  comments: FeedbackCommentEntry[];
}

function createEmptyFeedbackData(): StoredFeedbackData {
  return {
    counts: {
      skillsAnalysis: { helpful: 0, inaccurate: 0 },
      resumeImprovement: { helpful: 0, inaccurate: 0 },
      developmentPlan: { helpful: 0, inaccurate: 0 },
      interviewEvaluation: { helpful: 0, inaccurate: 0 },
    },
    comments: [],
  };
}

export function getStoredFeedbackData(): StoredFeedbackData {
  const fallback = createEmptyFeedbackData();
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredFeedbackData>;

    const merged = createEmptyFeedbackData();
    if (parsed.counts) {
      for (const key of Object.keys(merged.counts) as FeedbackBlockId[]) {
        const entry = parsed.counts[key];
        if (entry) {
          merged.counts[key] = {
            helpful: Math.max(0, Number(entry.helpful) || 0),
            inaccurate: Math.max(0, Number(entry.inaccurate) || 0),
          };
        }
      }
    }

    if (Array.isArray(parsed.comments)) {
      merged.comments = parsed.comments
        .filter(
          (item): item is FeedbackCommentEntry =>
            Boolean(item && typeof item.block === 'string' && typeof item.comment === 'string')
        )
        .slice(-100);
    }

    return merged;
  } catch {
    return fallback;
  }
}

export function updateFeedbackVote(
  block: FeedbackBlockId,
  previousVote: 'helpful' | 'inaccurate' | null,
  nextVote: 'helpful' | 'inaccurate'
): StoredFeedbackData {
  const data = getStoredFeedbackData();
  const blockCounts = data.counts[block];

  if (previousVote === nextVote) {
    return data;
  }

  if (previousVote === 'helpful') {
    blockCounts.helpful = Math.max(0, blockCounts.helpful - 1);
  } else if (previousVote === 'inaccurate') {
    blockCounts.inaccurate = Math.max(0, blockCounts.inaccurate - 1);
  }

  if (nextVote === 'helpful') {
    blockCounts.helpful += 1;
  } else {
    blockCounts.inaccurate += 1;
  }

  try {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }

  return data;
}

export function saveFeedbackComment(block: FeedbackBlockId, comment: string): StoredFeedbackData {
  const trimmed = comment.trim();
  const data = getStoredFeedbackData();
  if (!trimmed) return data;

  data.comments.push({
    block,
    comment: trimmed.slice(0, 1000),
    createdAt: new Date().toISOString(),
  });

  if (data.comments.length > 100) {
    data.comments = data.comments.slice(-100);
  }

  try {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }

  return data;
}

export function getTestMode(): boolean {
  try {
    return localStorage.getItem(TEST_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTestMode(enabled: boolean): void {
  try {
    localStorage.setItem(TEST_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}
