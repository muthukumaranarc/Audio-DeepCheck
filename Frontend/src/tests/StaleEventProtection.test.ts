import { describe, it, expect, beforeEach } from 'vitest';
import { LiveMonitoringService } from '../services/LiveMonitoringService';

describe('Stale-Event Protection Mechanism', () => {
  let service: LiveMonitoringService;

  beforeEach(() => {
    service = new LiveMonitoringService('ws://localhost:8080/ws/call');
    service.resetState();
  });

  it('accepts monotonically increasing chunk indices', () => {
    const processed: any[] = [];
    service.onAnalysisUpdate((item) => processed.push(item));

    const chunk0 = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 0,
      decision: 'HUMAN',
    });
    expect(chunk0).toBe(true);

    const chunk1 = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 1,
      decision: 'HUMAN',
    });
    expect(chunk1).toBe(true);

    const chunk2 = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 2,
      decision: 'AI_GENERATED',
    });
    expect(chunk2).toBe(true);

    expect(processed).toHaveLength(3);
    expect(processed[2].decision).toBe('AI_GENERATED');
  });

  it('rejects stale or out-of-order chunks with a lower chunk index', () => {
    const processed: any[] = [];
    service.onAnalysisUpdate((item) => processed.push(item));

    // Chunk 3 arrives
    const c3 = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 3,
      decision: 'AI_GENERATED',
    });
    expect(c3).toBe(true);

    // Delayed Chunk 1 arrives late over the network
    const c1Stale = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 1,
      decision: 'HUMAN',
    });
    expect(c1Stale).toBe(false); // Rejected!

    // Delayed Chunk 2 arrives late over the network
    const c2Stale = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 2,
      decision: 'HUMAN',
    });
    expect(c2Stale).toBe(false); // Rejected!

    // Ensure stale chunks were NOT emitted to subscribers
    expect(processed).toHaveLength(1);
    expect(processed[0].chunkIndex).toBe(3);
    expect(processed[0].decision).toBe('AI_GENERATED');
  });

  it('tracks monotonic sequence per participant independently', () => {
    // Caller at chunk 5
    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 5,
      decision: 'HUMAN',
    });

    // Receiver at chunk 1 is valid (Receiver has not reached chunk 5 yet)
    const receiverChunk1 = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'RECEIVER',
      chunkIndex: 1,
      decision: 'UNCERTAIN',
    });
    expect(receiverChunk1).toBe(true);

    // Stale receiver chunk 0 should be rejected
    const receiverChunk0 = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'RECEIVER',
      chunkIndex: 0,
      decision: 'HUMAN',
    });
    expect(receiverChunk0).toBe(false);

    // Caller chunk 6 is valid
    const callerChunk6 = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 6,
      decision: 'HUMAN',
    });
    expect(callerChunk6).toBe(true);
  });

  it('allows same chunk index for idempotent retry or update', () => {
    const first = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 2,
      decision: 'UNCERTAIN',
    });
    expect(first).toBe(true);

    // Same index is not < lastSeenIndex, so it is accepted
    const retry = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 2,
      decision: 'HUMAN',
    });
    expect(retry).toBe(true);
  });
});
