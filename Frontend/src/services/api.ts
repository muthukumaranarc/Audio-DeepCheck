import {
  CallRecord,
  EvidenceModule,
  ChunkTimelineItem,
  DecisionType
} from '../types';
import {
  mockLiveCalls,
  mockCallHistory,
  mockEvidenceModules,
  mockChunkTimeline
} from './mockData';

const BASE_URL = localStorage.getItem('audio_deepcheck_api_url') || 'http://localhost:8080/api/v1';

class ApiService {
  private baseUrl: string = BASE_URL;

  public setBaseUrl(url: string) {
    this.baseUrl = url;
    localStorage.setItem('audio_deepcheck_api_url', url);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  // GET /health
  async checkHealth(): Promise<{ status: string; service: string; timestamp: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      status: 'UP',
      service: 'audio-deepcheck-backend (simulated)',
      timestamp: new Date().toISOString(),
    };
  }

  // GET /calls/active
  async getActiveCalls(): Promise<CallRecord[]> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/active`);
      if (res.ok) {
        const data = await res.json();
        return data.calls || data;
      }
    } catch {
      // Fallback to mock
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
      if (params?.decision) query.append('decision', params.decision);
      if (params?.status) query.append('status', params.status);

      const res = await fetch(`${this.baseUrl}/calls?${query.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    let filtered = [...mockCallHistory];
    if (params?.decision && params.decision !== 'ALL') {
      filtered = filtered.filter(c => c.latestAnalysis === params.decision);
    }
    if (params?.status && params.status !== 'ALL') {
      filtered = filtered.filter(c => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.callId.toLowerCase().includes(q) ||
          c.caller.toLowerCase().includes(q) ||
          c.receiver.toLowerCase().includes(q)
      );
    }

    return {
      content: filtered,
      totalElements: filtered.length,
      totalPages: 1,
    };
  }

  // GET /calls/{callId}
  async getCallDetails(callId: string): Promise<CallRecord | null> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const found = mockCallHistory.find(c => c.callId === callId);
    return found || null;
  }

  // POST /calls
  async createCall(caller: string, receiver: string): Promise<CallRecord> {
    try {
      const res = await fetch(`${this.baseUrl}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller, receiver }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const newId = `CALL-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      callId: newId,
      caller: caller || 'Unknown Caller',
      receiver: receiver || 'Demo Receiver',
      duration: '00:00',
      durationSec: 0,
      status: 'CONNECTING',
      latestAnalysis: '--',
      createdAt: new Date().toISOString(),
    };
  }

  // POST /calls/{callId}/start
  async startCall(callId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/start`, { method: 'POST' });
      return res.ok;
    } catch {
      return true;
    }
  }

  // POST /calls/{callId}/audio
  async sendAudioChunk(
    callId: string,
    chunkBlob: Blob,
    sequenceNumber: number,
    durationMs: number = 500
  ): Promise<{ callId: string; sequenceNumber: number; received: boolean; analysisStatus: string }> {
    try {
      const formData = new FormData();
      formData.append('audio', chunkBlob);
      formData.append('sequenceNumber', sequenceNumber.toString());
      formData.append('timestampMs', Date.now().toString());
      formData.append('durationMs', durationMs.toString());

      const res = await fetch(`${this.baseUrl}/calls/${callId}/audio`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      callId,
      sequenceNumber,
      received: true,
      analysisStatus: 'QUEUED',
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

  // GET /calls/{callId}/evidence
  async getCallEvidence(callId: string): Promise<{ modules: EvidenceModule[]; conflictLevel: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/evidence`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      modules: mockEvidenceModules,
      conflictLevel: 'LOW',
    };
  }

  // GET /calls/{callId}/chunks
  async getCallChunks(callId: string): Promise<ChunkTimelineItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/calls/${callId}/chunks`);
      if (res.ok) {
        const data = await res.json();
        return data.chunks || data;
      }
    } catch {
      // Fallback
    }
    return mockChunkTimeline;
  }
}

export const api = new ApiService();
