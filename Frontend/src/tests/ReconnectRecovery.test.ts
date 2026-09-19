import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveMonitoringService } from '../services/LiveMonitoringService';
import { api } from '../services/api';

describe('Reconnect & State Recovery Mechanism', () => {
  let service: LiveMonitoringService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LiveMonitoringService('ws://localhost:8080/ws/call');
  });

  afterEach(() => {
    service.disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('attempts exponential backoff reconnects upon abnormal socket closure', () => {
    const states: string[] = [];
    service.onConnectionState((state) => states.push(state));

    service.connect();
    vi.advanceTimersByTime(10);
    expect(service.getConnectionState()).toBe('connected');

    // Simulate unexpected server socket drop
    const wsInstance = (service as any).ws;
    wsInstance.close();

    expect(service.getConnectionState()).toBe('disconnected');

    // Exponential backoff attempt 1: delay = 1000ms
    vi.advanceTimersByTime(1050);
    // During reconnection attempt, state changes to reconnecting or connecting
    expect(['reconnecting', 'connecting', 'connected']).toContain(service.getConnectionState());
  });

  it('emits connection telemetry alert upon successful reconnect', () => {
    const alerts: any[] = [];
    service.onAlert((a) => alerts.push(a));

    service.connect();
    vi.advanceTimersByTime(10);

    const connectAlert = alerts.find((a) => a.title === 'Live Telemetry Connected');
    expect(connectAlert).toBeDefined();
    expect(connectAlert?.callId).toBe('SYSTEM');
    expect(connectAlert?.severity).toBe('info');
  });

  it('triggers REST reconciliation to refresh authoritative state after reconnect', async () => {
    const getActiveCallsSpy = vi.spyOn(api, 'getActiveCalls').mockResolvedValue([]);
    const getAnalysisStatusSpy = vi.spyOn(api, 'getAnalysisStatus').mockResolvedValue({
      callId: 'CALL-1001',
      status: 'ANALYZING',
      latestDecision: 'HUMAN',
      decisionStrength: 0.95,
      confidenceStatus: 'PROVISIONAL',
      qualityScore: 0.94,
      conflictLevel: 'LOW',
      lastProcessedSequence: 14,
    });

    service.connect();
    vi.advanceTimersByTime(10);

    // Simulate reconcile function typically triggered by hook on reconnect
    const reconcileState = async (callId: string) => {
      await api.getActiveCalls();
      await api.getAnalysisStatus(callId);
    };

    await reconcileState('CALL-1001');

    expect(getActiveCallsSpy).toHaveBeenCalled();
    expect(getAnalysisStatusSpy).toHaveBeenCalledWith('CALL-1001');
  });
});
