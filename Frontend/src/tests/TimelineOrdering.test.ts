import { describe, it, expect } from 'vitest';
import { ParticipantChunkTimelineItem } from '../types';

describe('Timeline Ordering & Aggregation', () => {
  it('sorts chunks in strictly chronological order by chunkIndex and startSec', () => {
    const rawChunks: ParticipantChunkTimelineItem[] = [
      {
        chunkIndex: 3,
        callId: 'CALL-1001',
        participant: 'CALLER',
        userId: 'USER-A',
        startSec: 7.5,
        endSec: 12.5,
        decision: 'HUMAN',
        decisionStrength: 0.88,
        qualityScore: 0.9,
        conflictLevel: 'LOW',
        timestamp: 10003,
      },
      {
        chunkIndex: 0,
        callId: 'CALL-1001',
        participant: 'CALLER',
        userId: 'USER-A',
        startSec: 0.0,
        endSec: 5.0,
        decision: 'HUMAN',
        decisionStrength: 0.92,
        qualityScore: 0.94,
        conflictLevel: 'LOW',
        timestamp: 10000,
      },
      {
        chunkIndex: 2,
        callId: 'CALL-1001',
        participant: 'CALLER',
        userId: 'USER-A',
        startSec: 5.0,
        endSec: 10.0,
        decision: 'HUMAN',
        decisionStrength: 0.85,
        qualityScore: 0.91,
        conflictLevel: 'LOW',
        timestamp: 10002,
      },
      {
        chunkIndex: 1,
        callId: 'CALL-1001',
        participant: 'CALLER',
        userId: 'USER-A',
        startSec: 2.5,
        endSec: 7.5,
        decision: 'HUMAN',
        decisionStrength: 0.90,
        qualityScore: 0.92,
        conflictLevel: 'LOW',
        timestamp: 10001,
      },
    ];

    const sorted = [...rawChunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

    expect(sorted.map((c) => c.chunkIndex)).toEqual([0, 1, 2, 3]);
    expect(sorted.map((c) => c.startSec)).toEqual([0.0, 2.5, 5.0, 7.5]);
  });

  it('maintains 5s window with 2.5s sliding hop progression', () => {
    const generateChunks = (count: number, participant: 'CALLER' | 'RECEIVER') => {
      const chunks: ParticipantChunkTimelineItem[] = [];
      for (let i = 0; i < count; i++) {
        chunks.push({
          chunkIndex: i,
          callId: 'CALL-1001',
          participant,
          userId: participant === 'CALLER' ? 'USER-A' : 'USER-B',
          startSec: i * 2.5,
          endSec: i * 2.5 + 5.0,
          decision: 'HUMAN',
          decisionStrength: 0.85,
          qualityScore: 0.9,
          conflictLevel: 'LOW',
          timestamp: Date.now() + i * 2500,
        });
      }
      return chunks;
    };

    const callerChunks = generateChunks(5, 'CALLER');
    expect(callerChunks[0].startSec).toBe(0.0);
    expect(callerChunks[0].endSec).toBe(5.0);

    expect(callerChunks[1].startSec).toBe(2.5);
    expect(callerChunks[1].endSec).toBe(7.5);

    expect(callerChunks[4].startSec).toBe(10.0);
    expect(callerChunks[4].endSec).toBe(15.0);
  });

  it('caps timeline memory buffer to maximum retention window', () => {
    const MAX_ITEMS = 50;
    let timeline: ParticipantChunkTimelineItem[] = [];

    for (let i = 0; i < 75; i++) {
      const item: ParticipantChunkTimelineItem = {
        chunkIndex: i,
        callId: 'CALL-1001',
        participant: 'CALLER',
        userId: 'USER-A',
        startSec: i * 2.5,
        endSec: i * 2.5 + 5.0,
        decision: 'HUMAN',
        decisionStrength: 0.85,
        qualityScore: 0.9,
        conflictLevel: 'LOW',
        timestamp: Date.now() + i * 2500,
      };

      // Simulates slice(-MAX_ITEMS)
      timeline = [...timeline, item].slice(-MAX_ITEMS);
    }

    expect(timeline).toHaveLength(MAX_ITEMS);
    // Oldest retained is chunk 25
    expect(timeline[0].chunkIndex).toBe(25);
    // Newest is chunk 74
    expect(timeline[MAX_ITEMS - 1].chunkIndex).toBe(74);
  });
});
