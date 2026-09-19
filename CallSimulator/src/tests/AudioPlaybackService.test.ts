import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioPlaybackService } from '../services/AudioPlaybackService';

describe('AudioPlaybackService', () => {
  let playbackService: AudioPlaybackService;

  beforeEach(() => {
    playbackService = new AudioPlaybackService();
  });

  afterEach(() => {
    playbackService.stop();
  });

  it('should initialize and stop cleanly without errors', async () => {
    await playbackService.initialize();
    expect(playbackService.getRemoteAudioLevel()).toBe(0);

    playbackService.stop();
    expect(playbackService.getRemoteAudioLevel()).toBe(0);
  });

  it('should decode PCM16 bytes into Float32 and update remote audio RMS level', async () => {
    await playbackService.initialize();

    // Create 128 samples of PCM16 audio (256 bytes)
    const int16Array = new Int16Array(128);
    for (let i = 0; i < 128; i++) {
      int16Array[i] = 16000; // ~0.5 amplitude
    }

    playbackService.playPcm16Chunk(int16Array.buffer);
    const level = playbackService.getRemoteAudioLevel();
    expect(level).toBeGreaterThan(0);
  });

  it('should mute and unmute remote playback', async () => {
    await playbackService.initialize();

    playbackService.setMuted(true);
    expect(playbackService.isMuteActive()).toBe(true);
    expect(playbackService.getRemoteAudioLevel()).toBe(0);

    playbackService.setMuted(false);
    expect(playbackService.isMuteActive()).toBe(false);
  });
});
