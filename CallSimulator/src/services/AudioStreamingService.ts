import {
  AnalysisUpdateEvent,
  IncomingCallEvent,
  ParticipantRole,
  UserPresence,
  UserProfile,
} from '../types';
import { AudioPlaybackService } from './AudioPlaybackService';

export interface AudioStreamingCallbacks {
  onPresenceUpdate?: (users: UserPresence[]) => void;
  onIncomingCall?: (event: IncomingCallEvent) => void;
  onCallRinging?: (callId: string, peer: UserProfile) => void;
  onCallActive?: (callId: string, startedAt: string) => void;
  onCallRejected?: (callId: string, reason: string) => void;
  onCallCancelled?: (callId: string, reason: string) => void;
  onCallBusy?: (callId: string, receiver: string) => void;
  onCallEnded?: (callId: string, reason: string, durationSec: number) => void;
  onAnalysisUpdate?: (event: AnalysisUpdateEvent) => void;
  onError?: (code: string, message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

const MAGIC = 0xad01;
const TYPE_AUDIO = 0x01;
const ROLE_CALLER = 0x01;
const ROLE_RECEIVER = 0x02;
const ENCODING_PCM16 = 0x01;

/**
 * Service managing real-time WebSocket connection to Spring Boot (/ws/call),
 * text signaling event coordination, and binary PCM16 audio frame streaming.
 */
export class AudioStreamingService {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private currentUser: UserProfile;
  private playbackService: AudioPlaybackService;
  private callbacks: AudioStreamingCallbacks = {};

  private activeCallId: string | null = null;
  private participantRole: ParticipantRole = 'CALLER';
  private sequenceNumber: number = 0;
  private heartbeatInterval: number | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;

  constructor(
    currentUser: UserProfile,
    playbackService: AudioPlaybackService,
    serverUrl?: string
  ) {
    this.currentUser = currentUser;
    this.playbackService = playbackService;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const defaultWs = `${isHttps ? 'wss' : 'ws'}://${host}:8080/ws/call`;
    this.serverUrl = serverUrl || defaultWs;
  }

  public setCallbacks(callbacks: AudioStreamingCallbacks): void {
    this.callbacks = callbacks;
  }

  public updateUser(user: UserProfile): void {
    this.currentUser = user;
    if (this.isConnected) {
      this.registerPresence();
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.serverUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.callbacks.onConnectionChange?.(true);
        this.registerPresence();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          this.handleTextMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          this.handleBinaryMessage(event.data);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.callbacks.onConnectionChange?.(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('AudioStreaming WebSocket error:', err);
      };
    } catch (e) {
      console.warn('Failed to initialize WebSocket:', e);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.callbacks.onConnectionChange?.(false);
  }

  public startCallSession(callId: string, role: ParticipantRole): void {
    this.activeCallId = callId;
    this.participantRole = role;
    this.sequenceNumber = 0;
  }

  public endCallSession(): void {
    this.activeCallId = null;
    this.sequenceNumber = 0;
  }

  /**
   * Encodes Float32 audio samples from AudioCaptureService into PCM16 binary frame
   * with the 35-byte binary header and transmits over WebSocket.
   */
  public sendAudioChunk(float32Data: Float32Array, durationMs: number = 128): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN || !this.activeCallId) {
      return;
    }

    // 1. Convert Float32Array to PCM16 Int16Array
    const sampleCount = float32Data.length;
    const pcm16Data = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      pcm16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // 2. Encode Binary Frame
    const frameBytes = this.encodeAudioFrame(
      this.activeCallId,
      this.currentUser.userId,
      this.participantRole,
      this.sequenceNumber++,
      Date.now(),
      durationMs,
      16000,
      1,
      pcm16Data
    );

    try {
      this.ws.send(frameBytes);
    } catch (err) {
      console.warn('Error sending binary audio frame:', err);
    }
  }

  // --- Signaling Commands ---

  public inviteCall(receiverTarget: string): void {
    this.sendJson({
      type: 'CALL_INVITE',
      callerUserId: this.currentUser.userId,
      receiverTarget,
    });
  }

  public acceptCall(callId: string): void {
    this.sendJson({
      type: 'CALL_ACCEPT',
      callId,
      userId: this.currentUser.userId,
    });
  }

  public rejectCall(callId: string, reason: string = 'USER_REJECTED'): void {
    this.sendJson({
      type: 'CALL_REJECT',
      callId,
      userId: this.currentUser.userId,
      reason,
    });
  }

  public cancelCall(callId: string, reason: string = 'CALLER_CANCELLED'): void {
    this.sendJson({
      type: 'CALL_CANCEL',
      callId,
      userId: this.currentUser.userId,
      reason,
    });
  }

  public endCall(callId: string, reason: string = 'USER_ENDED'): void {
    this.sendJson({
      type: 'CALL_END',
      callId,
      userId: this.currentUser.userId,
      reason,
    });
  }

  public requestPresence(): void {
    this.sendJson({ type: 'GET_PRESENCE' });
  }

  // --- Internal Methods ---

  private registerPresence(): void {
    this.sendJson({
      type: 'REGISTER_PRESENCE',
      userId: this.currentUser.userId,
      phoneNumber: this.currentUser.phoneNumber,
      displayName: this.currentUser.displayName,
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendJson({
          type: 'HEARTBEAT',
          userId: this.currentUser.userId,
        });
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < 10) {
      const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts++));
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, delay);
    }
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handleTextMessage(payload: string): void {
    try {
      const msg = JSON.parse(payload);
      switch (msg.type) {
        case 'PRESENCE_UPDATE':
          this.callbacks.onPresenceUpdate?.(msg.users || []);
          break;
        case 'INCOMING_CALL':
          this.callbacks.onIncomingCall?.(msg);
          break;
        case 'CALL_RINGING':
          this.callbacks.onCallRinging?.(msg.callId, msg.receiver);
          break;
        case 'CALL_ACTIVE':
          this.callbacks.onCallActive?.(msg.callId, msg.startedAt);
          break;
        case 'CALL_REJECTED':
          this.callbacks.onCallRejected?.(msg.callId, msg.reason);
          break;
        case 'CALL_CANCELLED':
          this.callbacks.onCallCancelled?.(msg.callId, msg.reason);
          break;
        case 'CALL_BUSY':
          this.callbacks.onCallBusy?.(msg.callId, msg.receiver);
          break;
        case 'CALL_ENDED':
          this.callbacks.onCallEnded?.(msg.callId, msg.reason, msg.durationSec || 0);
          break;
        case 'ANALYSIS_UPDATE':
          this.callbacks.onAnalysisUpdate?.(msg);
          break;
        case 'ERROR':
          this.callbacks.onError?.(msg.code, msg.message);
          break;
      }
    } catch (e) {
      console.warn('Failed to parse text message:', payload, e);
    }
  }

  /**
   * Decodes incoming binary frame from peer participant and sends raw PCM16 to AudioPlaybackService.
   */
  private handleBinaryMessage(buffer: ArrayBuffer): void {
    if (buffer.byteLength < 24) return;
    const view = new DataView(buffer);

    const magic = view.getUint16(0, false);
    if (magic !== MAGIC) return;

    const frameType = view.getUint8(2);
    if (frameType !== TYPE_AUDIO) return;

    // Read user length & call length to find audio data offset
    const userLen = view.getUint8(22);
    const callLenOffset = 23 + userLen;
    if (buffer.byteLength < callLenOffset + 1) return;

    const callLen = view.getUint8(callLenOffset);
    const audioDataOffset = callLenOffset + 1 + callLen;

    if (buffer.byteLength <= audioDataOffset) return;

    const pcm16Bytes = new Uint8Array(buffer, audioDataOffset);
    this.playbackService.playPcm16Chunk(pcm16Bytes, 16000);
  }

  /**
   * Packs metadata and PCM16 audio into a compact binary frame matching Backend's AudioFrameHeader.
   */
  public encodeAudioFrame(
    callId: string,
    userId: string,
    role: ParticipantRole,
    sequence: number,
    timestampMs: number,
    durationMs: number,
    sampleRate: number,
    channels: number,
    pcm16Data: Int16Array
  ): ArrayBuffer {
    const enc = new TextEncoder();
    const userBytes = enc.encode(userId);
    const callBytes = enc.encode(callId);
    const audioByteLength = pcm16Data.length * 2;

    const headerLength = 24 + userBytes.length + callBytes.length;
    const totalLength = headerLength + audioByteLength;

    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // Bytes 0-1: Magic
    view.setUint16(0, MAGIC, false);
    // Byte 2: Frame Type
    view.setUint8(2, TYPE_AUDIO);
    // Byte 3: Participant Role
    view.setUint8(3, role === 'CALLER' ? ROLE_CALLER : ROLE_RECEIVER);
    // Bytes 4-7: Sequence Number
    view.setUint32(4, sequence >>> 0, false);
    // Bytes 8-15: Timestamp Ms (BigInt)
    view.setBigInt64(8, BigInt(timestampMs), false);
    // Bytes 16-17: Duration Ms
    view.setUint16(16, durationMs, false);
    // Bytes 18-19: Sample Rate
    view.setUint16(18, sampleRate, false);
    // Byte 20: Channels
    view.setUint8(20, channels);
    // Byte 21: Encoding (PCM16)
    view.setUint8(21, ENCODING_PCM16);

    // Byte 22: User ID length
    view.setUint8(22, userBytes.length);
    // Bytes 23..: User ID ASCII
    uint8.set(userBytes, 23);

    // Byte 23 + userBytes.length: Call ID length
    const callLenOffset = 23 + userBytes.length;
    view.setUint8(callLenOffset, callBytes.length);
    // Bytes: Call ID ASCII
    uint8.set(callBytes, callLenOffset + 1);

    // Audio payload
    const audioDataOffset = callLenOffset + 1 + callBytes.length;
    const pcm8 = new Uint8Array(pcm16Data.buffer, pcm16Data.byteOffset, audioByteLength);
    uint8.set(pcm8, audioDataOffset);

    return buffer;
  }
}
