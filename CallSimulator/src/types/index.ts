/**
 * Core type definitions for Audio DeepCheck - Mobile Call Simulator
 */

export type CallState = 
  | 'IDLE'
  | 'CREATING_CALL'
  | 'RINGING'
  | 'INCOMING_CALL'
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'ACTIVE'
  | 'ENDING'
  | 'COMPLETED';

export type CallFailureState = 
  | 'CREATE_FAILED'
  | 'CONNECT_FAILED'
  | 'CALL_REJECTED'
  | 'CALL_BUSY'
  | 'CALL_CANCELLED'
  | 'MIC_PERMISSION_DENIED'
  | 'MIC_PERMISSION_BLOCKED'
  | 'NETWORK_INTERRUPTED'
  | 'END_FAILED';

export type ParticipantRole = 'CALLER' | 'RECEIVER';

export interface UserProfile {
  userId: string;
  phoneNumber: string;
  displayName: string;
}

export interface UserPresence {
  userId: string;
  phoneNumber: string;
  displayName: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'IN_CALL';
  currentCallId?: string;
}

export interface IncomingCallEvent {
  callId: string;
  caller: UserProfile;
  timestamp: number;
}

export interface AnalysisUpdateEvent {
  callId: string;
  participant: ParticipantRole;
  userId: string;
  chunkIndex: number;
  startSec: number;
  endSec: number;
  decision: string;
  decisionStrength: number;
  conflictLevel: string;
}

export type MicPermissionState = 
  | 'UNKNOWN'
  | 'REQUESTING'
  | 'GRANTED'
  | 'DENIED'
  | 'BLOCKED';

export type ConnectionState = 
  | 'ONLINE'
  | 'OFFLINE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED';

export interface AudioCaptureMetadata {
  sampleRate: number;
  channelCount: number;
  sampleFormat: 'float32' | 'pcm16';
  frameSize: number;
  startTime: number;
}

export interface AudioDataChunk {
  sequenceNumber: number;
  timestampMs: number;
  durationMs: number;
  data: Float32Array;
  rmsLevel: number;
}

// Spring Boot API DTOs
export interface CreateCallRequest {
  caller: string;
  receiver: string;
}

export interface CreateCallResponse {
  callId: string;
  status: string;
  caller: string;
  receiver: string;
  createdAt: string;
}

export interface StartCallResponse {
  callId: string;
  status: string;
  startedAt: string;
}

export interface EndCallRequest {
  endedAt?: string;
  reason?: string;
}

export interface EndCallResponse {
  callId: string;
  status: string;
  endedAt: string;
}

export interface CallDetailsResponse {
  callId: string;
  caller: string;
  receiver: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  durationSec?: number;
  decision?: string;
  decisionStrength?: number;
  confidenceStatus?: string;
  quality?: {
    score?: number;
    flags?: string[];
  };
}

export interface CallSummary {
  callId: string;
  caller: string;
  receiver: string;
  status: string;
  durationSec?: number;
  createdAt: string;
  latestDecision?: string;
}

export interface PagedCallsResponse {
  content?: CallSummary[];
  calls?: CallSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  components: {
    backend?: string;
    aiService?: string;
    database?: string;
    [key: string]: string | undefined;
  };
}

export interface CallApiError {
  status: number;
  code: string;
  message: string;
  timestamp?: string;
}
