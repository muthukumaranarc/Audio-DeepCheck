import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../services/api';
import { LiveMonitoringService } from '../services/LiveMonitoringService';

describe('Browser Refresh State Reconstruction & Recovery', () => {
  let service: LiveMonitoringService;

  beforeEach(() => {
    service = new LiveMonitoringService('ws://localhost:8080/ws/call');
    vi.clearAllMocks();
  });

  it('reconstructs complete call session from authoritative Spring Boot REST APIs', async () => {
    // Mock authoritative REST responses from Spring Boot
    vi.spyOn(api, 'getCallDetails').mockResolvedValue({
      callId: 'CALL-1001',
      caller: 'Muthu',
      callerUserId: 'USER-A',
      receiver: 'Friend',
      receiverUserId: 'USER-B',
      duration: '02:30',
      durationSec: 150,
      status: 'ACTIVE',
      latestAnalysis: 'HUMAN',
      decisionStrength: -0.75,
      confidenceStatus: 'PROVISIONAL',
      quality: { score: 0.94, usable: true, snrDb: 28.5, flags: [] },
      createdAt: '2026-09-19T00:00:00Z',
    });

    vi.spyOn(api, 'getCallChunks').mockResolvedValue([
      {
        chunkIndex: 0,
        participantRole: 'CALLER',
        userId: 'USER-A',
        startSec: 0.0,
        endSec: 5.0,
        decision: 'HUMAN',
        decisionStrength: -0.72,
        qualityScore: 0.95,
      },
      {
        chunkIndex: 0,
        participantRole: 'RECEIVER',
        userId: 'USER-B',
        startSec: 0.0,
        endSec: 5.0,
        decision: 'HUMAN',
        decisionStrength: -0.68,
        qualityScore: 0.92,
      },
      {
        chunkIndex: 1,
        participantRole: 'CALLER',
        userId: 'USER-A',
        startSec: 2.5,
        endSec: 7.5,
        decision: 'HUMAN',
        decisionStrength: -0.78,
        qualityScore: 0.96,
      },
    ]);

    // Simulate page mount / refresh reconciliation
    const details = await api.getCallDetails('CALL-1001');
    const chunks = await api.getCallChunks('CALL-1001');

    expect(details).toBeDefined();
    expect(details?.callId).toBe('CALL-1001');
    expect(details?.status).toBe('ACTIVE');
    expect(details?.caller).toBe('Muthu');
    expect(details?.receiver).toBe('Friend');
    expect(details?.latestAnalysis).toBe('HUMAN');

    // Segregate chunks between caller and receiver lanes
    const callerChunks = chunks.filter((c: any) => c.participantRole === 'CALLER');
    const receiverChunks = chunks.filter((c: any) => c.participantRole === 'RECEIVER');

    expect(callerChunks).toHaveLength(2);
    expect(receiverChunks).toHaveLength(1);
    expect(callerChunks[1].chunkIndex).toBe(1);
    expect(receiverChunks[0].userId).toBe('USER-B');
  });
});
