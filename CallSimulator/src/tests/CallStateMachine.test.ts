import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallSession } from '../hooks/useCallSession';
import { callApiService } from '../services/CallApiService';
import { audioCaptureService } from '../services/AudioCaptureService';

vi.mock('../services/CallApiService');
vi.mock('../services/AudioCaptureService');

describe('useCallSession State Machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes in IDLE state', () => {
    const { result } = renderHook(() => useCallSession());
    expect(result.current.callState).toBe('IDLE');
    expect(result.current.callId).toBeNull();
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.failureState).toBeNull();
  });

  it('transitions IDLE -> CREATING_CALL -> CONNECTING -> ACTIVE on successful call', async () => {
    vi.mocked(callApiService.createCall).mockResolvedValueOnce({
      callId: 'CALL-5001',
      status: 'CREATED',
      caller: 'Tester',
      receiver: '+123456789',
      createdAt: '2026-09-19T03:00:00Z'
    });

    vi.mocked(callApiService.startCall).mockResolvedValueOnce({
      callId: 'CALL-5001',
      status: 'ACTIVE',
      startedAt: '2026-09-19T03:00:01Z'
    });

    vi.mocked(audioCaptureService.startCapture).mockResolvedValueOnce({
      sampleRate: 16000,
      channelCount: 1,
      sampleFormat: 'float32',
      frameSize: 2048,
      startTime: Date.now()
    });

    const { result } = renderHook(() => useCallSession());

    await act(async () => {
      await result.current.startCallSession('+123456789', 'Tester');
    });

    expect(result.current.callState).toBe('ACTIVE');
    expect(result.current.callId).toBe('CALL-5001');
    expect(result.current.receiver).toBe('+123456789');
    expect(audioCaptureService.startCapture).toHaveBeenCalled();
  });

  it('sets failureState to CREATE_FAILED when backend createCall fails', async () => {
    vi.mocked(callApiService.createCall).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const { result } = renderHook(() => useCallSession());

    await act(async () => {
      await result.current.startCallSession('+123456789', 'Tester');
    });

    expect(result.current.callState).toBe('IDLE');
    expect(result.current.failureState).toBe('CREATE_FAILED');
    expect(result.current.errorMessage).toContain('Connection refused');
  });

  it('sets failureState to MIC_PERMISSION_DENIED when mic capture is rejected', async () => {
    vi.mocked(callApiService.createCall).mockResolvedValueOnce({
      callId: 'CALL-5002',
      status: 'CREATED',
      caller: 'Tester',
      receiver: '+123456789',
      createdAt: '2026-09-19T03:00:00Z'
    });

    vi.mocked(callApiService.startCall).mockResolvedValueOnce({
      callId: 'CALL-5002',
      status: 'ACTIVE',
      startedAt: '2026-09-19T03:00:01Z'
    });

    const micError = new Error('Permission denied');
    micError.name = 'NotAllowedError';
    vi.mocked(audioCaptureService.startCapture).mockRejectedValueOnce(micError);
    vi.mocked(callApiService.endCall).mockResolvedValueOnce({
      callId: 'CALL-5002',
      status: 'ENDED',
      endedAt: '2026-09-19T03:00:02Z'
    });

    const { result } = renderHook(() => useCallSession());

    await act(async () => {
      await result.current.startCallSession('+123456789', 'Tester');
    });

    expect(result.current.callState).toBe('IDLE');
    expect(result.current.failureState).toBe('MIC_PERMISSION_DENIED');
  });

  it('transitions ACTIVE -> ENDING -> COMPLETED on endCallSession', async () => {
    vi.mocked(callApiService.createCall).mockResolvedValueOnce({
      callId: 'CALL-5003',
      status: 'CREATED',
      caller: 'Tester',
      receiver: '+123456789',
      createdAt: '2026-09-19T03:00:00Z'
    });

    vi.mocked(callApiService.startCall).mockResolvedValueOnce({
      callId: 'CALL-5003',
      status: 'ACTIVE',
      startedAt: '2026-09-19T03:00:01Z'
    });

    vi.mocked(audioCaptureService.startCapture).mockResolvedValueOnce({
      sampleRate: 16000,
      channelCount: 1,
      sampleFormat: 'float32',
      frameSize: 2048,
      startTime: Date.now()
    });

    vi.mocked(callApiService.endCall).mockResolvedValueOnce({
      callId: 'CALL-5003',
      status: 'ENDED',
      endedAt: '2026-09-19T03:00:10Z'
    });

    const { result } = renderHook(() => useCallSession());

    await act(async () => {
      await result.current.startCallSession('+123456789', 'Tester');
    });
    expect(result.current.callState).toBe('ACTIVE');

    await act(async () => {
      await result.current.endCallSession('USER_ENDED');
    });

    expect(result.current.callState).toBe('COMPLETED');
    expect(audioCaptureService.stopCapture).toHaveBeenCalled();
  });
});
