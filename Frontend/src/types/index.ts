export type CallStatus = 'CONNECTING' | 'ACTIVE' | 'ANALYZING' | 'ENDED' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED';

export type DecisionType = 'HUMAN' | 'AI_GENERATED' | 'UNCERTAIN' | 'NO_DECISION' | '--';

export type ConfidenceStatus = 'PROVISIONAL' | 'CALIBRATED';

export type ConflictLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CallRecord {
  callId: string;
  caller: string;
  receiver: string;
  duration: string;
  durationSec?: number;
  status: CallStatus;
  latestAnalysis: DecisionType;
  decisionStrength?: number;
  confidenceStatus?: ConfidenceStatus;
  qualityScore?: number;
  conflictLevel?: ConflictLevel;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface EvidenceModule {
  module: 'wav2vec2' | 'df_arena' | 'prosody' | 'spectrogram' | 'whisper' | string;
  name: string;
  status: 'USED' | 'FAILED' | 'SKIPPED';
  direction: 'SYNTHETIC' | 'HUMAN' | 'MIXED' | 'SUPPORTING';
  contribution: number;
  description: string;
}

export interface ChunkTimelineItem {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  decision: DecisionType;
  decisionStrength: number;
  qualityScore: number;
}

export interface RecentActivityItem {
  id: string;
  callId: string;
  title: string;
  timeAgo: string;
  type: 'analyzing' | 'completed' | 'warning' | 'in_progress' | 'human';
}

export interface CallVolumeData {
  day: string;
  human: number;
  aiGenerated: number;
  total: number;
}

export interface DetectionDistribution {
  totalCalls: number;
  human: { count: number; percentage: number };
  aiGenerated: { count: number; percentage: number };
  uncertain: { count: number; percentage: number };
  noDecision: { count: number; percentage: number };
}

export interface DashboardMetrics {
  activeCalls: { count: number; change: string; positive: boolean };
  analyzing: { count: number; change: string; positive: boolean };
  completed: { count: number; change: string; positive: boolean };
  needsAttention: { count: number; change: string; positive: boolean };
}
