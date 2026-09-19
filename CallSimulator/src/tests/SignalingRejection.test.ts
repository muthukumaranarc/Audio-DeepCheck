import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioStreamingService } from '../services/AudioStreamingService';
import { AudioPlaybackService } from '../services/AudioPlaybackService';
import { UserProfile } from '../types';

describe('Signaling Rejection, Cancellation, and Busy Handling', () => {
  let streamingService: AudioStreamingService;
  let mockPlayback: AudioPlaybackService;
  let mockWs: any;

  const testUser: UserProfile = {
    userId: 'USER-B',
    phoneNumber: '+919000000002',
    displayName: 'Friend',
  };

  beforeEach(() => {
    mockPlayback = {
      queueRemoteAudio: vi.fn(),
      clearQueue: vi.fn(),
      getRemoteRms: vi.fn().mockReturnValue(0.0),
      getStats: vi.fn().mockReturnValue({ queuedFrames: 0, droppedFrames: 0 }),
      destroy: vi.fn(),
    } as unknown as AudioPlaybackService;

    streamingService = new AudioStreamingService(testUser, mockPlayback, 'ws://localhost:8080/ws/call');

    mockWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
    };
    (streamingService as any).ws = mockWs;
    (streamingService as any).isConnected = true;
  });

  it('sends CALL_REJECT when user declines an incoming call', () => {
    streamingService.rejectCall('CALL-1001', 'DECLINED_BY_USER');

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'CALL_REJECT',
        callId: 'CALL-1001',
        userId: 'USER-B',
        reason: 'DECLINED_BY_USER',
      })
    );
  });

  it('sends CALL_CANCEL when caller cancels before receiver answers', () => {
    streamingService.cancelCall('CALL-1001', 'CALLER_GAVE_UP');

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'CALL_CANCEL',
        callId: 'CALL-1001',
        userId: 'USER-B',
        reason: 'CALLER_GAVE_UP',
      })
    );
  });

  it('triggers onCallRejected callback when CALL_REJECTED message is received', () => {
    const onCallRejectedSpy = vi.fn();
    streamingService.setCallbacks({ onCallRejected: onCallRejectedSpy });

    const payload = JSON.stringify({
      type: 'CALL_REJECTED',
      callId: 'CALL-1001',
      reason: 'USER_REJECTED',
    });

    (streamingService as any).handleTextMessage(payload);

    expect(onCallRejectedSpy).toHaveBeenCalledWith('CALL-1001', 'USER_REJECTED');
  });

  it('triggers onCallCancelled callback when CALL_CANCELLED message is received', () => {
    const onCallCancelledSpy = vi.fn();
    streamingService.setCallbacks({ onCallCancelled: onCallCancelledSpy });

    const payload = JSON.stringify({
      type: 'CALL_CANCELLED',
      callId: 'CALL-1001',
      reason: 'CALLER_CANCELLED',
    });

    (streamingService as any).handleTextMessage(payload);

    expect(onCallCancelledSpy).toHaveBeenCalledWith('CALL-1001', 'CALLER_CANCELLED');
  });

  it('triggers onCallBusy callback when receiver is already engaged', () => {
    const onCallBusySpy = vi.fn();
    streamingService.setCallbacks({ onCallBusy: onCallBusySpy });

    const payload = JSON.stringify({
      type: 'CALL_BUSY',
      callId: 'CALL-BUSY-1',
      receiver: 'Friend',
    });

    (streamingService as any).handleTextMessage(payload);

    expect(onCallBusySpy).toHaveBeenCalledWith('CALL-BUSY-1', 'Friend');
  });
});
