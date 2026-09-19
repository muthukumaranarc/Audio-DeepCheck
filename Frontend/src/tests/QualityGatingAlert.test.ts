import { describe, it, expect, beforeEach } from 'vitest';
import { LiveMonitoringService } from '../services/LiveMonitoringService';
import { MonitoringAlert } from '../types';

describe('Poor-Quality Audio Gating & Directional Score Discipline', () => {
  let service: LiveMonitoringService;

  beforeEach(() => {
    service = new LiveMonitoringService('ws://localhost:8080/ws/call');
    service.resetState();
  });

  it('triggers LOW_QUALITY alert when acoustic score drops below 0.60 threshold', () => {
    const alerts: MonitoringAlert[] = [];
    service.onAlert((a) => alerts.push(a));

    // Chunk with poor SNR (< 12 dB) and clipping resulting in qualityScore 0.45
    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 4,
      startSec: 10.0,
      endSec: 15.0,
      decision: 'UNCERTAIN',
      decisionStrength: 0.15,
      conflictLevel: 'LOW',
      qualityScore: 0.45,
    });

    const qualityAlert = alerts.find((a) => a.type === 'LOW_QUALITY');
    expect(qualityAlert).toBeDefined();
    expect(qualityAlert?.severity).toBe('warning');
    expect(qualityAlert?.message).toContain('quality: 45%');
  });

  it('preserves signed directional score scale without claiming calibrated probability', () => {
    const receivedItems: any[] = [];
    service.onAnalysisUpdate((item) => receivedItems.push(item));

    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 5,
      decision: 'HUMAN',
      decisionStrength: -0.85, // Negative = Human direction
      conflictLevel: 'LOW',
      qualityScore: 0.92,
    });

    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'RECEIVER',
      chunkIndex: 5,
      decision: 'AI_GENERATED',
      decisionStrength: +0.78, // Positive = Synthetic direction
      conflictLevel: 'LOW',
      qualityScore: 0.88,
    });

    expect(receivedItems).toHaveLength(2);
    // Negative directional contribution toward genuine human voice
    expect(receivedItems[0].decisionStrength).toBe(-0.85);
    expect(receivedItems[0].decision).toBe('HUMAN');

    // Positive directional contribution toward synthetic clone
    expect(receivedItems[1].decisionStrength).toBe(0.78);
    expect(receivedItems[1].decision).toBe('AI_GENERATED');
  });
});
