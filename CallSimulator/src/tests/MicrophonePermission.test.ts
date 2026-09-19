import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMicrophonePermission } from '../hooks/useMicrophonePermission';

describe('useMicrophonePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes in UNKNOWN state', () => {
    const { result } = renderHook(() => useMicrophonePermission());
    expect(result.current.permissionState).toBe('UNKNOWN');
    expect(result.current.hasPermission).toBe(false);
  });

  it('transitions to GRANTED when user allows microphone access', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(mockStream as unknown as MediaStream);

    const { result } = renderHook(() => useMicrophonePermission());

    let granted = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(true);
    expect(result.current.permissionState).toBe('GRANTED');
    expect(result.current.hasPermission).toBe(true);
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('transitions to DENIED when user rejects microphone access', async () => {
    const deniedErr = new Error('Permission denied');
    deniedErr.name = 'NotAllowedError';
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(deniedErr);

    const { result } = renderHook(() => useMicrophonePermission());

    let granted = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(false);
    expect(result.current.permissionState).toBe('DENIED');
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.errorMessage).toContain('Microphone access was denied');
  });

  it('transitions to BLOCKED when no microphone hardware is found', async () => {
    const notFoundErr = new Error('No mic device');
    notFoundErr.name = 'NotFoundError';
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(notFoundErr);

    const { result } = renderHook(() => useMicrophonePermission());

    let granted = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(false);
    expect(result.current.permissionState).toBe('BLOCKED');
    expect(result.current.errorMessage).toContain('No microphone input device found');
  });
});
