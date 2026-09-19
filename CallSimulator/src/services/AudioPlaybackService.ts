/**
 * Service for decoding and playing incoming remote audio frames from the peer participant.
 * Keeps playback completely isolated from AudioCaptureService.
 */
export class AudioPlaybackService {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private currentRmsLevel: number = 0;

  /**
   * Initializes or resumes the Web Audio context for remote audio playback.
   */
  public async initialize(): Promise<void> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.5;
      this.analyserNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.isPlaying = true;
    this.nextPlayTime = this.audioContext.currentTime;
  }

  /**
   * Decodes an incoming binary PCM16 audio frame and schedules it for seamless playback.
   * @param pcm16Bytes Raw PCM16 byte array from WebSocket
   * @param sampleRate Default 16000 Hz
   */
  public playPcm16Chunk(pcm16Bytes: ArrayBuffer | Uint8Array, sampleRate: number = 16000): void {
    if (!this.isPlaying || !this.audioContext || this.audioContext.state === 'closed') {
      return;
    }

    const uint8 = pcm16Bytes instanceof Uint8Array ? pcm16Bytes : new Uint8Array(pcm16Bytes);
    if (uint8.length < 2) return;

    // Convert Int16 bytes to Float32 [-1.0, 1.0]
    const sampleCount = Math.floor(uint8.length / 2);
    const int16View = new Int16Array(uint8.buffer, uint8.byteOffset, sampleCount);
    const float32Data = new Float32Array(sampleCount);

    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const s = int16View[i] / 32768.0;
      float32Data[i] = s;
      sumSquares += s * s;
    }

    // Update real-time RMS for remote audio visualizer
    const rms = Math.sqrt(sumSquares / sampleCount);
    this.currentRmsLevel = Math.min(1.0, rms * 4.0);

    if (this.isMuted) {
      return; // Skip audio output if muted
    }

    try {
      const audioBuffer = this.audioContext.createBuffer(1, sampleCount, sampleRate);
      audioBuffer.copyToChannel(float32Data, 0);

      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;

      if (this.analyserNode) {
        sourceNode.connect(this.analyserNode);
      } else {
        sourceNode.connect(this.audioContext.destination);
      }

      // Schedule seamless continuous playback with jitter tolerance
      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      sourceNode.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;
    } catch (err) {
      console.warn('Playback error on audio chunk:', err);
    }
  }

  /**
   * Returns the current root-mean-square (RMS) energy of the incoming remote speaker.
   */
  public getRemoteAudioLevel(): number {
    return this.isPlaying ? this.currentRmsLevel : 0;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.currentRmsLevel = 0;
    }
  }

  public isMuteActive(): boolean {
    return this.isMuted;
  }

  /**
   * Stops playback and cleans up Web Audio nodes.
   */
  public stop(): void {
    this.isPlaying = false;
    this.currentRmsLevel = 0;
    this.nextPlayTime = 0;

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (err) {
        console.warn('Error closing playback AudioContext:', err);
      }
      this.audioContext = null;
      this.analyserNode = null;
    }
  }
}
