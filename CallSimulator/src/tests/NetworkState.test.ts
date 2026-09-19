import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkState } from '../hooks/useNetworkState';
import { callApiService } from '../services/CallApiService';

vi.mock('../services/CallApiService');

describe('useNetworkState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects online state and healthy backend', async () => {
    vi.mocked(callApiService.checkHealth).mockResolvedValue({
      status: 'UP',
      service: 'audio-deepcheck-backend',
      timestamp: '2026-09-19T03:00:00Z',
      components: { backend: 'UP', aiService: 'UP', database: 'UP' }
    });

    const { result } = renderHook(() => useNetworkState());

    await act(async () => {
      await result.current.checkBackendHealth();
    });

    expect(result.current.isBackendHealthy).toBe(true);
    expect(result.current.connectionState).toBe('ONLINE');
  });

  it('detects backend health failure and transitions to RECONNECTING', async () => {
    vi.mocked(callApiService.checkHealth).mockRejectedValue(
      new Error('Backend offline')
    );

    const { result } = renderHook(() => useNetworkState());

    await act(async () => {
      await result.current.checkBackendHealth();
    });

    expect(result.current.isBackendHealthy).toBe(false);
    expect(result.current.connectionState).toBe('RECONNECTING');
  });

  it('updates state to OFFLINE when browser triggers offline event', async () => {
    const { result } = renderHook(() => useNetworkState());

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.connectionState).toBe('OFFLINE');
    expect(result.current.isBackendHealthy).toBe(false);
  });
});
