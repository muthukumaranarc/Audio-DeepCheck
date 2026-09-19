import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveMonitoringService } from '../services/LiveMonitoringService';

describe('LiveMonitoringService', () => {
  let service: LiveMonitoringService;

  beforeEach(() => {
    service = new LiveMonitoringService('ws://localhost:8080/ws/call');
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('starts in disconnected state and updates state when connected', () => {
    const states: string[] = [];
    service.onConnectionState((s) => states.push(s));

    expect(states).toContain('disconnected');
    service.connect();

    // Fast-forward open event
    vi.advanceTimersByTime(10);
    expect(states).toContain('connected');
    expect(service.getConnectionState()).toBe('connected');
  });

  it('sends REGISTER_PRESENCE payload on connection open', () => {
    service.connect();
    vi.advanceTimersByTime(10);

    const wsInstance = (service as any).ws;
    expect(wsInstance).toBeDefined();
    expect(wsInstance.send).toHaveBeenCalledWith(
      expect.stringContaining('REGISTER_PRESENCE')
    );
  });

  it('dispatches ANALYSIS_UPDATE events to subscribers', () => {
    const received: any[] = [];
    service.onAnalysisUpdate((item) => received.push(item));

    const payload = JSON.stringify({
      type: 'ANALYSIS_UPDATE',
      callId: 'CALL-1001',
      participant: 'CALLER',
      userId: 'USER-A',
      chunkIndex: 0,
      startSec: 0.0,
      endSec: 5.0,
      decision: 'HUMAN',
      decisionStrength: 0.85,
      conflictLevel: 'LOW',
      qualityScore: 0.94,
    });

    service.handleTextMessage(payload);

    expect(received).toHaveLength(1);
    expect(received[0].callId).toBe('CALL-1001');
    expect(received[0].participant).toBe('CALLER');
    expect(received[0].decision).toBe('HUMAN');
    expect(received[0].qualityScore).toBe(0.94);
  });

  it('dispatches CALL_ACTIVE events to subscribers', () => {
    const activeCalls: any[] = [];
    service.onCallActive((data) => activeCalls.push(data));

    service.handleTextMessage(JSON.stringify({
      type: 'CALL_ACTIVE',
      callId: 'CALL-1001',
      startedAt: '2026-09-18T21:00:00Z',
    }));

    expect(activeCalls).toHaveLength(1);
    expect(activeCalls[0].callId).toBe('CALL-1001');
  });

  it('dispatches CALL_ENDED and generates an alert', () => {
    const endedEvents: any[] = [];
    const alerts: any[] = [];
    service.onCallEnded((data) => endedEvents.push(data));
    service.onAlert((alert) => alerts.push(alert));

    service.handleTextMessage(JSON.stringify({
      type: 'CALL_ENDED',
      callId: 'CALL-1001',
      reason: 'NORMAL_CLEARING',
      durationSec: 42,
    }));

    expect(endedEvents).toHaveLength(1);
    expect(endedEvents[0].callId).toBe('CALL-1001');
    expect(endedEvents[0].durationSec).toBe(42);

    const callEndedAlert = alerts.find((a) => a.type === 'CALL_ENDED');
    expect(callEndedAlert).toBeDefined();
    expect(callEndedAlert.callId).toBe('CALL-1001');
  });

  it('emits HIGH_CONFLICT alert when conflict level is HIGH', () => {
    const alerts: any[] = [];
    service.onAlert((a) => alerts.push(a));

    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'CALLER',
      chunkIndex: 2,
      decision: 'UNCERTAIN',
      decisionStrength: 0.2,
      conflictLevel: 'HIGH',
      qualityScore: 0.9,
    });

    const conflictAlert = alerts.find((a) => a.type === 'HIGH_CONFLICT');
    expect(conflictAlert).toBeDefined();
    expect(conflictAlert?.callId).toBe('CALL-1001');
  });

  it('emits LOW_QUALITY alert when acoustic quality drops below threshold', () => {
    const alerts: any[] = [];
    service.onAlert((a) => alerts.push(a));

    service.processAnalysisUpdate({
      callId: 'CALL-1001',
      participant: 'RECEIVER',
      chunkIndex: 1,
      decision: 'HUMAN',
      decisionStrength: 0.5,
      conflictLevel: 'LOW',
      qualityScore: 0.45,
    });

    const qualityAlert = alerts.find((a) => a.type === 'LOW_QUALITY');
    expect(qualityAlert).toBeDefined();
    expect(qualityAlert?.title).toContain('Degraded Acoustic Quality');
  });

  it('emits BACKPRESSURE alert when queue congestion is flagged', () => {
    const alerts: any[] = [];
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
  });
});
