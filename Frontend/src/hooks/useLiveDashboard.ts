import { useState, useEffect, useCallback } from 'react';
import {
  DashboardMetrics,
  SystemHealth,
  MonitoringAlert,
  CallRecord,
  ConnectionState
} from '../types';
import { api } from '../services/api';
import { liveMonitor } from '../services/LiveMonitoringService';
import { mockMetrics, mockRecentActivity } from '../services/mockData';

export function useLiveDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(mockMetrics);
  const [health, setHealth] = useState<SystemHealth>({
    status: 'UP',
    service: 'audio-deepcheck-backend',
    timestamp: new Date().toISOString(),
    components: { backend: 'UP', aiService: 'UP', database: 'UP' },
  });
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([
    {
      id: 'init-1',
      callId: 'CALL-1001',
      type: 'INFO',
      title: 'Real-Time Neural Gate Active',
      message: 'Telephony monitoring ready for 16kHz mono audio streams.',
      timestamp: Date.now() - 1000 * 60 * 5,
      severity: 'info',
    },
    {
      id: 'init-2',
      callId: 'CALL-0997',
      type: 'HIGH_CONFLICT',
      title: 'High Conflict On Historical Chunk',
      message: 'Provisional conflict triggered UNCERTAIN gating fallback.',
      timestamp: Date.now() - 1000 * 60 * 15,
      severity: 'warning',
    },
  ]);
  const [activeCalls, setActiveCalls] = useState<CallRecord[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Health check
      const h = await api.checkHealth();
      setHealth(h);

      // 2. Active calls
      const active = await api.getActiveCalls();
      setActiveCalls(active);

      // 3. Compute dynamic metrics from active calls and recent data
      const analyzingCount = active.filter((c) => c.status === 'ANALYZING').length;
      const activeCount = active.length;

      setMetrics((prev) => ({
        ...prev,
        activeCalls: { count: activeCount, change: '+1', positive: true },
        analyzing: { count: analyzingCount, change: '0', positive: true },
      }));
    } catch {
      // Keep state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();

    // Connect to live WebSocket stream
    liveMonitor.connect();

    // Subscribe to live events
    const unsubConn = liveMonitor.onConnectionState((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        fetchDashboardData();
      }
    });

    const unsubAlert = liveMonitor.onAlert((newAlert) => {
      setAlerts((prev) => [newAlert, ...prev.slice(0, 19)]);
    });

    const unsubCallActive = liveMonitor.onCallActive(() => {
      fetchDashboardData();
    });

    const unsubCallEnded = liveMonitor.onCallEnded(() => {
      fetchDashboardData();
    });

    const unsubAnalysis = liveMonitor.onAnalysisUpdate(() => {
      // Incrementally refresh active calls
      api.getActiveCalls().then((calls) => setActiveCalls(calls));
    });

    // Heartbeat polling every 8s for dashboard health stats
    const interval = setInterval(fetchDashboardData, 8000);

    return () => {
      unsubConn();
      unsubAlert();
      unsubCallActive();
      unsubCallEnded();
      unsubAnalysis();
      clearInterval(interval);
    };
  }, [fetchDashboardData]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    metrics,
    health,
    alerts,
    activeCalls,
    connectionState,
    isLoading,
    refresh: fetchDashboardData,
    dismissAlert,
  };
}
