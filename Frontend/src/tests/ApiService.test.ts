import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiService } from '../services/api';

describe('ApiService - Spring Boot Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('checks system health from Spring Boot', async () => {
    const mockHealthResponse = {
      status: 'UP',
      components: {
        backend: 'UP',
        aiService: 'UP',
        database: 'UP'
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealthResponse,
    } as Response);

    const health = await apiService.checkHealth();
    expect(health.status).toBe('UP');
    expect(health.components.backend).toBe('UP');
    expect(health.components.aiService).toBe('UP');
    expect(health.components.database).toBe('UP');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.any(Object)
    );
  });

  it('fetches active calls and transforms to CallSession domain objects', async () => {
    const mockActiveCalls = [
      {
        callId: 'CALL-1001',
        callerId: 'USER-A',
        receiverId: 'USER-B',
        startTime: '2026-09-18T20:00:00Z',
        durationSeconds: 45,
        status: 'ANALYZING',
        streamActive: true,
        callerAudioQuality: 0.92,
        receiverAudioQuality: 0.88,
        latestDecision: 'HUMAN',
        decisionConfidence: 0.94,
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockActiveCalls,
    } as Response);

    const calls = await apiService.getActiveCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].callId).toBe('CALL-1001');
    expect(calls[0].status).toBe('ANALYZING');
    expect(calls[0].caller).toBe('USER-A');
    expect(calls[0].receiver).toBe('USER-B');
    expect(calls[0].latestAnalysis).toBe('HUMAN');
  });

  it('fetches paginated call history with query parameters', async () => {
    const mockHistory = {
      content: [
        {
          callId: 'CALL-999',
          caller: 'USER-A',
          receiver: 'USER-B',
          status: 'COMPLETED',
          latestDecision: 'HUMAN',
          durationSec: 120,
        }
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHistory,
    } as Response);

    const result = await apiService.getCallHistory({
      page: 0,
      size: 10,
      status: 'COMPLETED',
      decision: 'HUMAN',
    });
    expect(result.content).toHaveLength(1);
    expect(result.totalElements).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('page=0&size=10&decision=HUMAN&status=COMPLETED')
    );
  });

  it('fetches call details by callId', async () => {
    const mockCall = {
      callId: 'CALL-1001',
      caller: 'Muthu',
      receiver: 'Friend',
      status: 'ACTIVE',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCall,
    } as Response);

    const call = await apiService.getCallDetails('CALL-1001');
    expect(call).toBeDefined();
    expect(call?.callId).toBe('CALL-1001');
  });

  it('fetches analysis status and master decision for a call', async () => {
    const mockAnalysis = {
      callId: 'CALL-1001',
      status: 'ANALYZING',
      latestDecision: 'HUMAN',
      decisionStrength: 0.95,
      conflictLevel: 'LOW',
      totalChunksAnalyzed: 12,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAnalysis,
    } as Response);

    const analysis = await apiService.getAnalysisStatus('CALL-1001');
    expect(analysis?.latestDecision).toBe('HUMAN');
    expect(analysis?.conflictLevel).toBe('LOW');
  });

  it('fetches call chunks for timeline representation', async () => {
    const mockChunks = [
      {
        chunkIndex: 0,
        callId: 'CALL-1001',
        participantRole: 'CALLER',
        startTimeSec: 0,
        endTimeSec: 5,
        decision: 'HUMAN',
        confidenceScore: 0.95,
        flagged: false,
      },
      {
        chunkIndex: 1,
        callId: 'CALL-1001',
        participantRole: 'RECEIVER',
        startTimeSec: 2.5,
        endTimeSec: 7.5,
        decision: 'HUMAN',
        confidenceScore: 0.92,
        flagged: false,
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockChunks,
    } as Response);

    const chunks = await apiService.getCallChunks('CALL-1001');
    expect(chunks).toHaveLength(2);
    expect(chunks[0].participantRole).toBe('CALLER');
    expect(chunks[1].participantRole).toBe('RECEIVER');
  });

  it('fetches comprehensive forensic audit report', async () => {
    const mockReport = {
      callId: 'CALL-1001',
      callerId: 'Muthu',
      receiverId: 'Friend',
      startTime: '2026-09-18T20:00:00Z',
      endTime: '2026-09-18T20:05:00Z',
      durationSeconds: 300,
      totalChunks: 24,
      callerChunks: 12,
      receiverChunks: 12,
      finalVerdict: 'HUMAN',
      verdictConfidence: 0.96,
      conflictLevel: 'LOW',
      modules: [
        { module: 'wav2vec2', name: 'Wav2Vec2 INT8 ONNX', weight: 0.35, contribution: 0.88, status: 'USED' },
        { module: 'df_arena', name: 'DF Arena 500M', weight: 0.25, contribution: 0.91, status: 'USED' },
        { module: 'spectrogram', name: 'Spectrogram CNN', weight: 0.15, contribution: 0.76, status: 'USED' },
        { module: 'prosody', name: 'Prosody / F0 Analyzer', weight: 0.15, contribution: 0.82, status: 'USED' },
        { module: 'whisper', name: 'Whisper Tiny Rep', weight: 0.10, contribution: 0.79, status: 'USED' },
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    const report = await apiService.getCallReport('CALL-1001');
    expect(report.callId).toBe('CALL-1001');
    expect(report.finalVerdict).toBe('HUMAN');
    expect(report.modules[0].name).toBe('Wav2Vec2 INT8 ONNX');
  });

  it('handles network failure gracefully with fallback data', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const calls = await apiService.getActiveCalls();
    expect(Array.isArray(calls)).toBe(true);
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const health = await apiService.checkHealth();
    expect(health.status).toBe('DOWN');
    expect(health.components.backend).toBe('DOWN');
  });

  it('sends endCall POST request to Spring Boot', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await apiService.endCall('CALL-1001');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/calls/CALL-1001/end'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
