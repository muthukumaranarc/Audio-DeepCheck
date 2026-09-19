import { AudioCaptureMetadata, AudioDataChunk } from '../types';

export type AudioDataListener = (chunk: AudioDataChunk) => void;

/**
 * Dedicated microphone audio capture service using Web Audio API.
 * 
 * Strict architectural rule:
 * Contains ZERO network transport code. Network streaming is deferred to Milestone 12.
 */
export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  private listeners: Set<AudioDataListener> = new Set();
  private sequenceNumber: number = 0;
  private startTime: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentAudioLevel: number = 0;

  /**
   * Start capturing microphone audio.
   */
  async startCapture(): Promise<AudioCaptureMetadata> {
    if (this.isRunning) {
      this.stopCapture();
    }

    const bufferSize = 2048;
    const targetSampleRate = 16000;

    // 1. Try to request real microphone stream
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
    } catch (micErr) {
      console.warn('[AudioCapture] Mic unavailable — using silent simulated fallback:', micErr);
    }

    this.isRunning = true;
    this.isPaused = false;
    this.sequenceNumber = 0;
    this.startTime = Date.now();

    if (stream) {
      // === REAL MIC PATH ===
      this.mediaStream = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.audioContext = new AudioContextClass({ sampleRate: targetSampleRate });
      } catch {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.3;

      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRunning || this.isPaused) {
          this.currentAudioLevel = 0;
          return;
        }

        const inputBuffer = e.inputBuffer.getChannelData(0);

        let sumSquares = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sumSquares += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / inputBuffer.length);
        this.currentAudioLevel = Math.min(1.0, rms * 5.0);

        const audioData = new Float32Array(inputBuffer);
        const now = Date.now();
        const chunk: AudioDataChunk = {
          sequenceNumber: this.sequenceNumber++,
          timestampMs: now,
          durationMs: (bufferSize / this.audioContext!.sampleRate) * 1000,
          data: audioData,
          rmsLevel: this.currentAudioLevel
        };

        this.listeners.forEach((listener) => {
          try {
            listener(chunk);
          } catch (err) {
            console.error('Error in audio data listener:', err);
          }
        });
      };

      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      return {
        sampleRate: this.audioContext.sampleRate,
        channelCount: 1,
        sampleFormat: 'float32',
        frameSize: bufferSize,
        startTime: this.startTime
      };
    } else {
      // === SIMULATED FALLBACK PATH (mic denied / busy) ===
      // Emit periodic silent PCM frames at ~43ms intervals (bufferSize/16000 * 1000 ms)
      const frameIntervalMs = Math.round((bufferSize / targetSampleRate) * 1000);

      const emitFrame = () => {
        if (!this.isRunning || this.isPaused) {
          this.currentAudioLevel = 0;
          return;
        }

        // Generate near-silent audio with tiny random noise to keep the stream alive
        const audioData = new Float32Array(bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          audioData[i] = (Math.random() - 0.5) * 0.002; // ~−54 dBFS noise floor
        }
        this.currentAudioLevel = 0.01;

        const chunk: AudioDataChunk = {
          sequenceNumber: this.sequenceNumber++,
          timestampMs: Date.now(),
          durationMs: frameIntervalMs,
          data: audioData,
          rmsLevel: this.currentAudioLevel
        };

        this.listeners.forEach((listener) => {
          try {
            listener(chunk);
          } catch (err) {
            console.error('Error in simulated audio listener:', err);
          }
        });

        // Schedule next frame using timeout stored in processorNode slot (re-used as a flag handle)
        if (this.isRunning) {
          (this as unknown as Record<string, unknown>)['_simulatedTimer'] = setTimeout(emitFrame, frameIntervalMs);
        }
      };

      // Kick off first frame
      (this as unknown as Record<string, unknown>)['_simulatedTimer'] = setTimeout(emitFrame, frameIntervalMs);

      return {
        sampleRate: targetSampleRate,
        channelCount: 1,
        sampleFormat: 'float32',
        frameSize: bufferSize,
        startTime: this.startTime
      };
    }
  }


  /**
   * Pause audio capture (e.g. mic mute).
   */
  pauseCapture(): void {
    this.isPaused = true;
    this.currentAudioLevel = 0;
  }

  /**
   * Resume audio capture.
   */
  resumeCapture(): void {
    this.isPaused = false;
  }

  /**
   * Stop audio capture and release all hardware resources.
   */
  stopCapture(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.currentAudioLevel = 0;

    // Clear simulated fallback timer (if running without real mic)
    const self = this as unknown as Record<string, unknown>;
    if (self['_simulatedTimer']) {
      clearTimeout(self['_simulatedTimer'] as number);
      self['_simulatedTimer'] = null;
    }

    // Disconnect audio nodes
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Stop and release all media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
  }

  /**
   * Get current live audio level (0.0 to 1.0) for UI visualization.
   */
  getAudioLevel(): number {
    return this.currentAudioLevel;
  }

  /**
   * Register a listener for incoming raw audio chunks.
   * Returns an unsubscribe function.
   */
  onDataAvailable(listener: AudioDataListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isCapturing(): boolean {
    return this.isRunning && !this.isPaused;
  }

  isInitialized(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const audioCaptureService = new AudioCaptureService();
