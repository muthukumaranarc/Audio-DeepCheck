import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioStreamingService } from '../services/AudioStreamingService';
import { AudioPlaybackService } from '../services/AudioPlaybackService';
import { PRESET_USERS } from '../services/IdentityService';

describe('AudioStreamingService', () => {
  let streamingService: AudioStreamingService;
  let playbackService: AudioPlaybackService;

  beforeEach(() => {
    playbackService = new AudioPlaybackService();
    streamingService = new AudioStreamingService(PRESET_USERS.A, playbackService);
  });

  afterEach(() => {
    streamingService.disconnect();
    playbackService.stop();
  });

  it('should encode binary audio frames matching 35-byte header protocol', () => {
    const pcm16 = new Int16Array(2048);
    for (let i = 0; i < pcm16.length; i++) {
      pcm16[i] = 1000;
    }

    const buffer = streamingService.encodeAudioFrame(
      'CALL-1001',
      'USER-A',
      'CALLER',
      42,
      1700000000000,
      128,
      16000,
      1,
      pcm16
    );

    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBe(24 + 'USER-A'.length + 'CALL-1001'.length + 2048 * 2);

    const view = new DataView(buffer);
    // Magic 0xAD01
    expect(view.getUint16(0, false)).toBe(0xad01);
    // Frame type: 1 (Audio)
    expect(view.getUint8(2)).toBe(1);
    // Role: 1 (CALLER)
    expect(view.getUint8(3)).toBe(1);
    // Sequence: 42
    expect(view.getUint32(4, false)).toBe(42);
    // Duration: 128
    expect(view.getUint16(16, false)).toBe(128);
    // Sample rate: 16000
    expect(view.getUint16(18, false)).toBe(16000);
    // Channels: 1
    expect(view.getUint8(20)).toBe(1);
  });

  it('should format RECEIVER role as 0x02 in binary header', () => {
    const pcm16 = new Int16Array(100);
    const buffer = streamingService.encodeAudioFrame(
      'CALL-1001',
      'USER-B',
      'RECEIVER',
      1,
      1700000000000,
      128,
      16000,
      1,
      pcm16
    );

    const view = new DataView(buffer);
    expect(view.getUint8(3)).toBe(2); // ROLE_RECEIVER
  });

  it('should start and end call sessions without error', () => {
    streamingService.startCallSession('CALL-1001', 'CALLER');
    expect(() => streamingService.endCallSession()).not.toThrow();
  });
});
