import { describe, it, expect, beforeEach } from 'vitest';
import { LiveMonitoringService } from '../services/LiveMonitoringService';
import { MonitoringAlert } from '../types';

describe('Inference Backpressure Alerting & Recovery', () => {
  let service: LiveMonitoringService;

  beforeEach(() => {
    service = new LiveMonitoringService('ws://localhost:8080/ws/call');
    service.resetState();
  });

  it('emits high-severity BACKPRESSURE alert when queue congestion is signaled', () => {
    const alerts: MonitoringAlert[] = [];
    service.onAlert((a) => alerts.push(a));

    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 3,
      decision: 'HUMAN',
      conflictLevel: 'LOW',
      backpressureDetected: true,
    });

    const backpressureAlert = alerts.find((a) => a.type === 'BACKPRESSURE');
    expect(backpressureAlert).toBeDefined();
    expect(backpressureAlert?.severity).toBe('danger');
    expect(backpressureAlert?.title).toContain('Inference Queue Backpressure');
    expect(backpressureAlert?.message).toContain('Oldest window dropped');
  });

  it('continues accepting subsequent chunk evaluations once congestion clears', () => {
    const updates: any[] = [];
    service.onAnalysisUpdate((item) => updates.push(item));

    // Chunk 3 with backpressure
    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 3,
      decision: 'HUMAN',
      backpressureDetected: true,
    });

    // Chunk 4 normal
    const accepted = service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 4,
      decision: 'HUMAN',
      backpressureDetected: false,
    });

    expect(accepted).toBe(true);
    expect(updates).toHaveLength(2);
    expect(updates[1].chunkIndex).toBe(4);
  });
});
