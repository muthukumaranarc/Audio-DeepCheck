import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioCaptureService } from '../services/AudioCaptureService';

describe('AudioCaptureService', () => {
  let captureService: AudioCaptureService;

  beforeEach(() => {
    vi.clearAllMocks();
    captureService = new AudioCaptureService();
  });

  afterEach(() => {
    captureService.stopCapture();
  });

  it('starts capture and returns audio metadata', async () => {
    const metadata = await captureService.startCapture();

    expect(metadata.sampleRate).toBe(16000);
    expect(metadata.channelCount).toBe(1);
    expect(metadata.sampleFormat).toBe('float32');
    expect(metadata.frameSize).toBe(2048);
    expect(metadata.startTime).toBeGreaterThan(0);
    expect(captureService.isCapturing()).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: false
    });
  });

  it('pauses and resumes capture', async () => {
    await captureService.startCapture();
    expect(captureService.isCapturing()).toBe(true);

    captureService.pauseCapture();
    expect(captureService.isCapturing()).toBe(false);
    expect(captureService.getAudioLevel()).toBe(0);

    captureService.resumeCapture();
    expect(captureService.isCapturing()).toBe(true);
  });

  it('stops capture and releases media tracks and audio nodes', async () => {
    await captureService.startCapture();
    expect(captureService.isCapturing()).toBe(true);

    captureService.stopCapture();
    expect(captureService.isCapturing()).toBe(false);
    expect(captureService.isInitialized()).toBe(false);
  });

  it('registers and unregisters data listeners', async () => {
    const listener = vi.fn();
    const unsubscribe = captureService.onDataAvailable(listener);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
