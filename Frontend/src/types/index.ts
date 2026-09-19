export type CallStatus =
  | 'CREATED'
  | 'RINGING'
  | 'ACCEPTED'
  | 'CONNECTING_MEDIA'
  | 'CONNECTING'
  | 'ACTIVE'
  | 'ANALYZING'
  | 'ENDING'
  | 'ENDED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'MISSED'
  | 'BUSY'
  | 'DISCONNECTED'
  | 'FAILED'
  | 'INTERRUPTED';

export type DecisionType = 'HUMAN' | 'AI_GENERATED' | 'UNCERTAIN' | 'NO_DECISION' | '--';

export type ConfidenceStatus = 'PROVISIONAL' | 'CALIBRATED';

export type ConflictLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ParticipantRole = 'CALLER' | 'RECEIVER' | 'SYSTEM';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface AudioQualityInfo {
  score: number;
  usable: boolean;
  snrDb: number;
  flags: string[];
}

export interface CallRecord {
  callId: string;
  caller: string;
  receiver: string;
  callerUserId?: string;
  receiverUserId?: string;
  duration: string;
  durationSec?: number;
  status: CallStatus;
  latestAnalysis: DecisionType;
  decisionStrength?: number;
  confidenceStatus?: ConfidenceStatus;
  syntheticEvidenceScore?: number;
  qualityScore?: number;
  quality?: AudioQualityInfo;
  conflictLevel?: ConflictLevel;
  lastProcessedSequence?: number;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  endReason?: string;
}

export interface EvidenceModule {
  module: 'wav2vec2' | 'df_arena' | 'prosody' | 'spectrogram' | 'whisper' | string;
  name: string;
  status: 'USED' | 'FAILED' | 'SKIPPED';
  direction: 'SYNTHETIC' | 'HUMAN' | 'MIXED' | 'SUPPORTING';
  contribution: number;
  description?: string;
}

export interface ChunkTimelineItem {
  chunkIndex: number;
  startSec: number;
  endSec: number;
  decision: DecisionType;
  decisionStrength: number;
  qualityScore: number;
}

export interface ParticipantChunkTimelineItem extends ChunkTimelineItem {
  callId: string;
  participant: ParticipantRole;
  userId: string;
  conflictLevel?: ConflictLevel;
  timestamp?: number;
}

export interface ParticipantState {
  role: ParticipantRole;
  userId: string;
  displayName: string;
  phoneNumber: string;
  voiceActivity: boolean; // physical RMS activity active
  quality: AudioQualityInfo;
  latestDecision: DecisionType;
  decisionStrength: number;
  confidenceStatus: ConfidenceStatus;
  lastUpdate: number;
}

export interface MonitoringAlert {
  id: string;
  callId: string;
  type:
    | 'HIGH_CONFLICT'
    | 'LOW_QUALITY'
    | 'BACKPRESSURE'
    | 'AI_UNAVAILABLE'
    | 'PARTICIPANT_DISCONNECTED'
    | 'CALL_ENDED'
    | 'INFO';
  title: string;
  message: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'danger';
  dismissed?: boolean;
}

export interface SystemHealth {
  status: 'UP' | 'DOWN';
  service: string;
  timestamp: string;
  components: {
    backend: string;
    aiService: string;
    database: string;
  };
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
  humanCount: number;
  aiCount: number;
  uncertainCount: number;
}

export interface AnalysisStatusData {
  callId: string;
  status: string;
  latestDecision: DecisionType;
  decisionStrength: number;
  confidenceStatus: ConfidenceStatus;
  qualityScore: number;
  conflictLevel: ConflictLevel;
  lastProcessedSequence: number;
}

export interface CallReportData {
  callId: string;
  caller: string;
  receiver: string;
  status: CallStatus;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  finalDecision: DecisionType;
  decisionStrength: number;
  confidenceStatus: string;
  syntheticEvidenceScore?: number;
  conflictLevel: ConflictLevel;
  quality: AudioQualityInfo;
  chunksSummary: {
    totalChunks: number;
    usableChunks: number;
    aiChunks: number;
    humanChunks: number;
    uncertainChunks: number;
    aiChunkRatio: number;
    trimmedMeanScore: number;
  };
  modules: EvidenceModule[];
  chunks: ChunkTimelineItem[];
  processingMetadata?: Record<string, unknown>;
  requestId?: string;
}

export interface AudioVerificationResult {
  original_filename: string;
  processed_filename: string;
  original_format: string;
  was_converted: boolean;
  decision: 'AI_GENERATED' | 'HUMAN' | 'UNCERTAIN';
  decision_strength: number;
  confidence_status: string;
  synthetic_evidence_score: number;
  human_evidence_score: number;
  conflict_level: string;
  duration_sec: number;
  quality?: {
    score: number;
    usable: boolean;
    snr_db: number;
    flags: string[];
  };
  modules?: Array<{
    module: string;
    evidence_type: string;
    raw_score: number | null;
    normalized_score: number;
    effective_weight: number;
    contribution: number;
    status: string;
    reason: string;
  }>;
  chunks?: Array<{
    chunk_index: number;
    start_sec: number;
    end_sec: number;
    fusion_score: number;
    quality_score: number;
    conflict_level: string;
  }>;
}

