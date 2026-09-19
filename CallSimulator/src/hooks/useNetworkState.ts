import { useState, useEffect, useCallback } from 'react';
import { ConnectionState } from '../types';
import { callApiService } from '../services/CallApiService';

export function useNetworkState() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    navigator.onLine ? 'ONLINE' : 'OFFLINE'
  );
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  const checkBackendHealth = useCallback(async () => {
    if (!navigator.onLine) {
      setConnectionState('OFFLINE');
      setIsBackendHealthy(false);
      return;
    }

    try {
      const health = await callApiService.checkHealth();
      setLastCheckTime(new Date());
      if (health && (health.status === 'UP' || health.status === 'DEGRADED')) {
        setIsBackendHealthy(true);
        setConnectionState((prev) => (prev === 'OFFLINE' || prev === 'RECONNECTING' ? 'CONNECTED' : 'ONLINE'));
      } else {
        setIsBackendHealthy(false);
        setConnectionState('RECONNECTING');
      }
    } catch {
      setIsBackendHealthy(false);
      setConnectionState((prev) => (prev === 'OFFLINE' ? 'OFFLINE' : 'RECONNECTING'));
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setConnectionState('RECONNECTING');
      checkBackendHealth();
    };

    const handleOffline = () => {
      setConnectionState('OFFLINE');
      setIsBackendHealthy(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkBackendHealth();

    // Periodic heartbeat every 15s
    const interval = setInterval(checkBackendHealth, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkBackendHealth]);

  return {
    connectionState,
    isBackendHealthy,
    lastCheckTime,
    setConnectionState,
    checkBackendHealth
  };
}
