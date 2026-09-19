import { describe, it, expect, beforeEach } from 'vitest';
import { LiveMonitoringService } from '../services/LiveMonitoringService';
import { ParticipantRole, ParticipantChunkTimelineItem } from '../types';

describe('Participant Separation & Segregated Dual-Lane Timeline', () => {
  let service: LiveMonitoringService;

  beforeEach(() => {
    service = new LiveMonitoringService('ws://localhost:8080/ws/call');
    service.resetState();
  });

  it('preserves caller and receiver participant separation in dispatched events', () => {
    const callerEvents: ParticipantChunkTimelineItem[] = [];
    const receiverEvents: ParticipantChunkTimelineItem[] = [];

    service.onAnalysisUpdate((item) => {
      if (item.participant === 'CALLER') {
        callerEvents.push(item);
      } else if (item.participant === 'RECEIVER') {
        receiverEvents.push(item);
      }
    });

    // Emulate interleaved chunks from both participants during full duplex call
    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      userId: 'Muthu',
      chunkIndex: 0,
      startSec: 0.0,
      endSec: 5.0,
      decision: 'HUMAN',
      decisionStrength: 0.9,
      qualityScore: 0.95,
    });

    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'RECEIVER',
      userId: 'Friend',
      chunkIndex: 0,
      startSec: 0.0,
      endSec: 5.0,
      decision: 'AI_GENERATED',
      decisionStrength: 0.78,
      qualityScore: 0.88,
    });

    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      userId: 'Muthu',
      chunkIndex: 1,
      startSec: 2.5,
      endSec: 7.5,
      decision: 'HUMAN',
      decisionStrength: 0.92,
      qualityScore: 0.96,
    });

    // Verify caller lane
    expect(callerEvents).toHaveLength(2);
    expect(callerEvents[0].userId).toBe('Muthu');
    expect(callerEvents[0].participant).toBe('CALLER');
    expect(callerEvents[0].decision).toBe('HUMAN');
    expect(callerEvents[1].chunkIndex).toBe(1);

    // Verify receiver lane
    expect(receiverEvents).toHaveLength(1);
    expect(receiverEvents[0].userId).toBe('Friend');
    expect(receiverEvents[0].participant).toBe('RECEIVER');
    expect(receiverEvents[0].decision).toBe('AI_GENERATED');
    expect(receiverEvents[0].decisionStrength).toBe(0.78);
  });

  it('segregates timeline lanes independently without cross-over overwrite', () => {
    const callerTimeline: ParticipantChunkTimelineItem[] = [];
    const receiverTimeline: ParticipantChunkTimelineItem[] = [];

    const handleUpdate = (item: ParticipantChunkTimelineItem) => {
      if (item.participant === 'CALLER') {
        callerTimeline.push(item);
      } else {
        receiverTimeline.push(item);
      }
    };

    service.onAnalysisUpdate(handleUpdate);

    // Process alternating sequence
    for (let i = 0; i < 4; i++) {
      service.processAnalysisUpdate({
        callId: 'CALL-1001',
        participant: 'CALLER',
        userId: 'USER-A',
        chunkIndex: i,
        startSec: i * 2.5,
        endSec: i * 2.5 + 5.0,
        decision: 'HUMAN',
        qualityScore: 0.9,
      });

      service.processAnalysisUpdate({
        callId: 'CALL-1001',
        participant: 'RECEIVER',
        userId: 'USER-B',
        chunkIndex: i,
        startSec: i * 2.5,
        endSec: i * 2.5 + 5.0,
        decision: 'UNCERTAIN',
        qualityScore: 0.85,
      });
    }

    expect(callerTimeline).toHaveLength(4);
    expect(receiverTimeline).toHaveLength(4);

    // Caller lane all HUMAN
    expect(callerTimeline.every((c) => c.participant === 'CALLER' && c.decision === 'HUMAN')).toBe(true);

    // Receiver lane all UNCERTAIN
    expect(receiverTimeline.every((r) => r.participant === 'RECEIVER' && r.decision === 'UNCERTAIN')).toBe(true);
  });
});
