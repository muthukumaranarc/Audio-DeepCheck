import {
  CallRecord,
  EvidenceModule,
  ChunkTimelineItem,
  DecisionType,
  SystemHealth,
  AnalysisStatusData,
  CallReportData,
  ConflictLevel,
  ConfidenceStatus,
  AudioVerificationResult
} from '../types';
import {
  mockLiveCalls,
  mockCallHistory,
  mockEvidenceModules,
  mockChunkTimeline
} from './mockData';

const getDynamicBaseUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:8080/api/v1';
  const saved = localStorage.getItem('audio_deepcheck_api_url');
  if (saved) return saved;
  const host = window.location.hostname || 'localhost';
  const protocol = window.location.protocol || 'http:';
  return `${protocol}//${host}:8080/api/v1`;
};

const BASE_URL = getDynamicBaseUrl();

export class ApiService {
  private baseUrl: string = BASE_URL;
  private lastLiveCheck: boolean = false;

  public setBaseUrl(url: string) {
    this.baseUrl = url;
    localStorage.setItem('audio_deepcheck_api_url', url);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public isLive(): boolean {
    return this.lastLiveCheck;
  }

  private formatDuration(durationSec?: number): string {
    if (durationSec === undefined || durationSec === null || isNaN(durationSec)) return '00:00';
    const m = Math.floor(durationSec / 60);
    const s = Math.floor(durationSec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // GET /health
  async checkHealth(): Promise<SystemHealth> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        this.lastLiveCheck = true;
        return {
          status: data.status === 'UP' ? 'UP' : 'DOWN',
          service: data.service || 'audio-deepcheck-backend',
          timestamp: data.timestamp || new Date().toISOString(),
          components: {
            backend: data.components?.backend || 'UP',
            aiService: data.components?.aiService || 'UP',
            database: data.components?.database || 'UP',
          },
        };
      }
    } catch {
      this.lastLiveCheck = false;
    }
    return {
      status: 'DOWN',
      service: 'audio-deepcheck-backend (offline fallback)',
      timestamp: new Date().toISOString(),
      components: {
        backend: 'DOWN',
        aiService: 'DOWN',
        database: 'DOWN',
      },
    };
  }

  // GET /calls/active
  async getActiveCalls(): Promise<CallRecord[]> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/active`);
      if (res.ok) {
        const data = await res.json();
        this.lastLiveCheck = true;
        const list = Array.isArray(data) ? data : (data.calls || []);
        return list.map((c: any) => ({
          callId: c.callId,
          caller: c.caller || c.callerId,
          callerUserId: c.callerUserId || c.callerId,
          receiver: c.receiver || c.receiverId,
          receiverUserId: c.receiverUserId || c.receiverId,
          durationSec: c.durationSec || c.durationSeconds || 0,
          duration: this.formatDuration(c.durationSec || c.durationSeconds),
          status: c.status || 'ACTIVE',
          latestAnalysis: (c.latestDecision || c.decision || '--') as DecisionType,
          decisionStrength: c.decisionStrength !== undefined ? c.decisionStrength : c.decisionConfidence,
          confidenceStatus: (c.confidenceStatus as ConfidenceStatus) || 'PROVISIONAL',
          qualityScore: c.qualityScore || c.callerAudioQuality || c.quality?.score,
          quality: c.quality,
          conflictLevel: (c.conflictLevel as ConflictLevel) || 'LOW',
          createdAt: c.createdAt || c.startTime,
        }));
      }
    } catch {
      this.lastLiveCheck = false;
    }
    return mockLiveCalls;
  }

  // GET /calls
  async getCallHistory(params?: {
    page?: number;
    size?: number;
    decision?: string;
    status?: string;
    search?: string;
  }): Promise<{ content: CallRecord[]; totalElements: number; totalPages: number }> {
    try {
      const query = new URLSearchParams();
      if (params?.page !== undefined) query.append('page', params.page.toString());
      if (params?.size !== undefined) query.append('size', params.size.toString());
      if (params?.decision && params.decision !== 'ALL') query.append('decision', params.decision);
      if (params?.status && params.status !== 'ALL') query.append('status', params.status);

      const res = await fetch(`${this.baseUrl}/calls?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        this.lastLiveCheck = true;
        const content = (data.content || []).map((c: any) => ({
          callId: c.callId,
          caller: c.caller,
          receiver: c.receiver,
          durationSec: c.durationSec || 0,
          duration: this.formatDuration(c.durationSec),
          status: c.status,
          latestAnalysis: (c.latestDecision || c.decision || '--') as DecisionType,
          decisionStrength: c.decisionStrength,
          confidenceStatus: c.confidenceStatus as ConfidenceStatus,
          qualityScore: c.qualityScore || c.quality?.score,
          quality: c.quality,
          createdAt: c.createdAt,
          startedAt: c.startedAt,
          endedAt: c.endedAt,
        }));
        return {
          content,
          totalElements: data.totalElements || content.length,
          totalPages: data.totalPages || 1,
        };
      }
    } catch {
      this.lastLiveCheck = false;
    }

    // Filter mock data as fallback
    let filtered = [...mockCallHistory];
    if (params?.decision && params.decision !== 'ALL') {
      filtered = filtered.filter((c) => c.latestAnalysis === params.decision);
    }
    if (params?.status && params.status !== 'ALL') {
      filtered = filtered.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.callId.toLowerCase().includes(q) ||
          c.caller.toLowerCase().includes(q) ||
          c.receiver.toLowerCase().includes(q)
      );
    }

    const pageSize = params?.size || 10;
    const pageIndex = params?.page || 0;
    const paginated = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

    return {
      content: paginated,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize) || 1,
    };
  }

  // GET /calls/{callId}
  async getCallDetails(callId: string): Promise<CallRecord | null> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}`);
      if (res.ok) {
        const c = await res.json();
        this.lastLiveCheck = true;
        return {
          callId: c.callId,
          caller: c.caller,
          receiver: c.receiver,
          durationSec: c.durationSec || 0,
          duration: this.formatDuration(c.durationSec),
          status: c.status,
          latestAnalysis: (c.decision || c.latestDecision || '--') as DecisionType,
          decisionStrength: c.decisionStrength,
          confidenceStatus: c.confidenceStatus as ConfidenceStatus,
          qualityScore: c.quality?.score,
          quality: c.quality,
          createdAt: c.createdAt,
          startedAt: c.startedAt,
          endedAt: c.endedAt,
          endReason: c.endReason,
        };
      }
    } catch {
      this.lastLiveCheck = false;
    }
    const found = mockCallHistory.find((c) => c.callId === callId) || mockLiveCalls.find((c) => c.callId === callId);
    return found || null;
  }

  // GET /calls/{callId}/analysis
  async getAnalysisStatus(callId: string): Promise<AnalysisStatusData | null> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/analysis`);
      if (res.ok) {
        this.lastLiveCheck = true;
        return await res.json();
      }
    } catch {
      this.lastLiveCheck = false;
    }
    return {
      callId,
      status: 'ANALYZING',
      latestDecision: 'UNCERTAIN',
      decisionStrength: 0.25,
      confidenceStatus: 'PROVISIONAL',
      qualityScore: 0.85,
      conflictLevel: 'LOW',
      lastProcessedSequence: 0,
    };
  }

  // GET /calls/{callId}/evidence
  async getCallEvidence(callId: string): Promise<{ modules: EvidenceModule[]; conflictLevel: ConflictLevel }> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/evidence`);
      if (res.ok) {
        this.lastLiveCheck = true;
        const data = await res.json();
        return {
          modules: data.modules || [],
          conflictLevel: (data.conflictLevel as ConflictLevel) || 'LOW',
        };
      }
    } catch {
      this.lastLiveCheck = false;
    }
    return {
      modules: mockEvidenceModules,
      conflictLevel: 'LOW',
    };
  }

  // GET /calls/{callId}/chunks
  async getCallChunks(callId: string): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/chunks`);
      if (res.ok) {
        this.lastLiveCheck = true;
        const data = await res.json();
        const rawChunks = data.chunks || data || [];
        return rawChunks.map((ch: any) => ({
          chunkIndex: ch.chunkIndex,
          participantRole: ch.participantRole || ch.participant || 'CALLER',
          participant: ch.participant || ch.participantRole || 'CALLER',
          userId: ch.userId || (ch.participantRole === 'RECEIVER' ? 'USER-B' : 'USER-A'),
          startSec: ch.startSec !== undefined ? ch.startSec : ch.startTimeSec || 0.0,
          endSec: ch.endSec !== undefined ? ch.endSec : ch.endTimeSec || 5.0,
          decision: (ch.decision as DecisionType) || 'UNCERTAIN',
          decisionStrength: ch.decisionStrength !== undefined ? ch.decisionStrength : ch.confidenceScore || 0.0,
          qualityScore: ch.qualityScore !== undefined ? ch.qualityScore : 0.9,
          flagged: ch.flagged || false,
        }));
      }
    } catch {
      this.lastLiveCheck = false;
    }
    return mockChunkTimeline;
  }

  // GET /calls/{callId}/report
  async getCallReport(callId: string): Promise<any | null> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/report`);
      if (res.ok) {
        this.lastLiveCheck = true;
        const data = await res.json();
        return {
          callId: data.callId,
          caller: data.caller || data.callerId,
          callerId: data.callerId || data.caller,
          receiver: data.receiver || data.receiverId,
          receiverId: data.receiverId || data.receiver,
          status: data.status,
          startedAt: data.startedAt || data.startTime,
          startTime: data.startTime || data.startedAt,
          endedAt: data.endedAt || data.endTime,
          endTime: data.endTime || data.endedAt,
          durationSec: data.durationSec || data.durationSeconds || 0,
          finalDecision: (data.finalDecision || data.finalVerdict || 'UNCERTAIN') as DecisionType,
          finalVerdict: (data.finalVerdict || data.finalDecision || 'UNCERTAIN') as DecisionType,
          decisionStrength: data.decisionStrength || data.verdictConfidence || 0.0,
          verdictConfidence: data.verdictConfidence || data.decisionStrength || 0.0,
          confidenceStatus: data.confidenceStatus || 'PROVISIONAL',
          syntheticEvidenceScore: data.syntheticEvidenceScore,
          conflictLevel: (data.conflictLevel as ConflictLevel) || 'LOW',
          quality: data.quality || { score: 1.0, usable: true, snrDb: 30.0, flags: [] },
          chunksSummary: data.chunksSummary || {
            totalChunks: data.totalChunks || 0,
            callerChunks: data.callerChunks || 0,
            receiverChunks: data.receiverChunks || 0,
            usableChunks: data.totalChunks || 0,
            aiChunks: 0,
            humanChunks: 0,
            uncertainChunks: 0,
            aiChunkRatio: 0.0,
            trimmedMeanScore: 0.0,
          },
          modules: data.modules || [],
          chunks: (data.chunks || []).map((ch: any) => ({
            chunkIndex: ch.chunkIndex,
            startSec: ch.startSec,
            endSec: ch.endSec,
            decision: (ch.decision as DecisionType) || 'UNCERTAIN',
            decisionStrength: ch.decisionStrength || 0.0,
            qualityScore: ch.qualityScore || 0.9,
          })),
          processingMetadata: data.processingMetadata,
          requestId: data.requestId,
        };
      }
    } catch {
      this.lastLiveCheck = false;
    }

    const found = mockCallHistory.find((c) => c.callId === callId);
    if (!found) return null;

    return {
      callId: found.callId,
      caller: found.caller,
      receiver: found.receiver,
      status: found.status,
      startedAt: found.startedAt || '2026-09-18T10:19:00Z',
      endedAt: found.endedAt || '2026-09-18T10:24:32Z',
      durationSec: found.durationSec || 332,
      finalDecision: found.latestAnalysis,
      decisionStrength: found.decisionStrength || 0.85,
      confidenceStatus: found.confidenceStatus || 'PROVISIONAL',
      conflictLevel: found.conflictLevel || 'LOW',
      quality: { score: found.qualityScore || 0.94, usable: true, snrDb: 28.5, flags: [] },
      chunksSummary: {
        totalChunks: 6,
        usableChunks: 6,
        aiChunks: found.latestAnalysis === 'AI_GENERATED' ? 5 : 0,
        humanChunks: found.latestAnalysis === 'HUMAN' ? 5 : 0,
        uncertainChunks: found.latestAnalysis === 'UNCERTAIN' ? 4 : 1,
        aiChunkRatio: found.latestAnalysis === 'AI_GENERATED' ? 0.83 : 0.0,
        trimmedMeanScore: found.decisionStrength || 0.85,
      },
      modules: mockEvidenceModules,
      chunks: mockChunkTimeline,
      requestId: 'REQ-AUDIT-MOCK',
    };
  }

  // POST /calls/{callId}/end
  async endCall(callId: string, reason: string = 'USER_ENDED'): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endedAt: new Date().toISOString(), reason }),
      });
      return res.ok;
    } catch {
      return true;
    }
  }

  // ── Developer API ────────────────────────────────────────────────────────────

  /** GET /developer/stats — live session counts from backend */
  async developerGetStats(): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`${this.baseUrl}/developer/stats`);
      if (res.ok) return await res.json();
    } catch { /* offline */ }
    return { totalSessions: 'N/A', callIdSequence: 'N/A', timestamp: new Date().toISOString(), offline: true };
  }

  /** DELETE /developer/reset — purge all sessions & analysis data */
  async developerResetAll(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/developer/reset`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        return { success: true, message: data.message || 'All data purged.' };
      }
      return { success: false, message: `Server error ${res.status}` };
    } catch (err) {
      return { success: false, message: `Backend offline: ${String(err)}` };
    }
  }

  /** POST /developer/seed — create a demo call */
  async developerSeedDemo(): Promise<{ success: boolean; callId?: string; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/developer/seed`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        return { success: true, callId: data.callId, message: data.message || 'Demo call seeded.' };
      }
      return { success: false, message: `Server error ${res.status}` };
    } catch (err) {
      return { success: false, message: `Backend offline: ${String(err)}` };
    }
  }

  /** DELETE /developer/calls/{callId} — delete a specific call */
  async developerDeleteCall(callId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/developer/calls/${callId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, message: (data as any).message || (res.ok ? 'Deleted.' : `Error ${res.status}`) };
    } catch (err) {
      return { success: false, message: `Backend offline: ${String(err)}` };
    }
  }

  /**
   * Upload an audio file (.mp3, .wav, .war) to verify whether it is AI-generated or Human.
   * If the file is .mp3, the backend converts it to 16kHz WAV before model inference.
   */
  async verifyAudioFile(file: File): Promise<AudioVerificationResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/audio/verify`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Audio verification failed (${response.status}): ${errText || response.statusText}`);
    }

    return await response.json();
  }
}

export const api = new ApiService();
export const apiService = api;
