export interface AiTokenUsage {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
}

export interface AiRequestMeta {
  label: string;
  durationSeconds: number;
  usage: AiTokenUsage | null;
}

export type FeedbackBlockId =
  | 'skillsAnalysis'
  | 'resumeImprovement'
  | 'developmentPlan'
  | 'interviewEvaluation';

export interface SkillComparisonItem {
  skill: string;
  explanation: string;
}

export interface ResumeSectionRecommendation {
  section: string;
  issue: string;
  fix: string;
}

export interface ParsedResumeData {
  education: string[];
  skills: string[];
  experience: string[];
}

export interface ResumeAnalysis {
  matchScore: number;
  summary: string;
  extractedData: ParsedResumeData;
  matchingSkills: SkillComparisonItem[];
  missingSkills: SkillComparisonItem[];
  recommendations: ResumeSectionRecommendation[];
  improvedResumeText: string;
  _meta?: AiRequestMeta;
}

export interface InterviewQuestion {
  id: number;
  question: string;
  focus: string;
}

export interface StarCriterion {
  present: boolean;
  comment: string;
}

export interface StarBreakdown {
  situation: StarCriterion;
  task: StarCriterion;
  action: StarCriterion;
  result: StarCriterion;
}

export interface AnswerEvaluation {
  score: number;
  star: StarBreakdown;
  improvements: string[];
  strongExample: string;
  _meta?: AiRequestMeta;
}

export interface InterviewAnswerRecord {
  question: InterviewQuestion;
  answer: string;
  evaluation: AnswerEvaluation;
}

export interface InterviewSummary {
  averageScore: number;
  overallVerdict: string;
  mainRecommendations: string[];
  _meta?: AiRequestMeta;
}

export interface DevelopmentSkillPlan {
  priority: number;
  skill: string;
  whyImportant: string;
  whatToLearn: string;
  practiceFormat: string;
  resourceTypes: string[];
  resumeProof: string;
}

export interface DevelopmentWeekTask {
  id: string;
  title: string;
  resourceType: string;
  relatedSkill: string;
}

export interface DevelopmentWeek {
  week: number;
  title: string;
  goal: string;
  tasks: DevelopmentWeekTask[];
}

export interface ResumeUpdatePreview {
  summary: string;
  updatedBullets: string[];
  addedKeywords: string[];
}

export interface DevelopmentPlan {
  skills: DevelopmentSkillPlan[];
  weeks: DevelopmentWeek[];
  resumeUpdatePreview: ResumeUpdatePreview;
  _meta?: AiRequestMeta;
}
