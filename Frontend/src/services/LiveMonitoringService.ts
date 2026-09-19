import {
  ConnectionState,
  MonitoringAlert,
  ParticipantChunkTimelineItem,
  ParticipantRole,
  DecisionType,
  ConflictLevel
} from '../types';
import { api } from './api';

export type AnalysisUpdateHandler = (event: ParticipantChunkTimelineItem) => void;
export type CallActiveHandler = (data: { callId: string; startedAt: string }) => void;
export type CallEndedHandler = (data: { callId: string; reason: string; durationSec: number }) => void;
export type AlertHandler = (alert: MonitoringAlert) => void;
export type ConnectionStateHandler = (state: ConnectionState) => void;
export type PresenceUpdateHandler = (users: any[]) => void;

export class LiveMonitoringService {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectDelay = 8000;
  private reconnectTimer: any = null;
  private pollingTimer: any = null;
  private shouldReconnect = true;

  // Stale-event tracking: key = `${callId}_${participant}` -> lastChunkIndex
  private lastChunkIndexMap = new Map<string, number>();
  // Timestamp tracking: key = `${callId}` -> lastUpdateTimestamp
  private lastUpdateTimestampMap = new Map<string, number>();

  // Subscribers
  private analysisSubscribers = new Set<AnalysisUpdateHandler>();
  private callActiveSubscribers = new Set<CallActiveHandler>();
  private callEndedSubscribers = new Set<CallEndedHandler>();
  private alertSubscribers = new Set<AlertHandler>();
  private connectionStateSubscribers = new Set<ConnectionStateHandler>();
  private presenceSubscribers = new Set<PresenceUpdateHandler>();

  constructor(customWsUrl?: string) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const defaultWsUrl = `${protocol}//${host}:8080/ws/call`;
    this.wsUrl = customWsUrl || localStorage.getItem('audio_deepcheck_ws_url') || defaultWsUrl;
  }

  public setWsUrl(url: string) {
    this.wsUrl = url;
    localStorage.setItem('audio_deepcheck_ws_url', url);
  }

  public getWsUrl(): string {
    return this.wsUrl;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  private setConnectionState(state: ConnectionState) {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.connectionStateSubscribers.forEach((fn) => fn(state));
    }
  }

  public connect() {
    this.shouldReconnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setConnectionState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
        this.stopPolling();

        // Register dashboard presence so server knows client is listening
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'REGISTER_PRESENCE',
              userId: 'DASHBOARD',
              phoneNumber: '',
              displayName: 'Security Operations Dashboard',
            })
          );
        }

        // Trigger an authoritative REST refresh on connection/reconnection
        this.emitAlert({
          id: `conn-${Date.now()}`,
          callId: 'SYSTEM',
          type: 'INFO',
          title: 'Live Telemetry Connected',
          message: `Connected to live telephony feed at ${this.wsUrl}`,
          timestamp: Date.now(),
          severity: 'info',
        });
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          this.handleTextMessage(event.data);
        }
      };

      this.ws.onclose = () => {
        this.setConnectionState('disconnected');
        this.scheduleReconnect();
        this.startPolling();
      };

      this.ws.onerror = () => {
        this.setConnectionState('disconnected');
      };
    } catch {
      this.setConnectionState('disconnected');
      this.scheduleReconnect();
      this.startPolling();
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('disconnected');
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Controlled fallback polling when WebSocket is offline
  private startPolling() {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(async () => {
      try {
        await api.checkHealth();
        await api.getActiveCalls();
      } catch {
        // quiet polling fallback
      }
    }, 4000);
  }

  private stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // Process incoming text signaling & telemetry messages
  public handleTextMessage(payload: string) {
    try {
      const data = JSON.parse(payload);
      const type = data.type;

      switch (type) {
        case 'ANALYSIS_UPDATE':
          this.processAnalysisUpdate(data);
          break;

        case 'CALL_ACTIVE':
          this.callActiveSubscribers.forEach((fn) =>
            fn({ callId: data.callId, startedAt: data.startedAt || new Date().toISOString() })
          );
          break;

        case 'CALL_ENDED':
          this.processCallEnded(data);
          break;

        case 'PRESENCE_UPDATE':
          this.presenceSubscribers.forEach((fn) => fn(data.users || []));
          break;

        default:
          break;
      }
    } catch {
      // Ignored malformed payload
    }
  }

  // Stale-event protected analysis update processor
  public processAnalysisUpdate(data: any): boolean {
    const callId = data.callId;
    const participant = (data.participant as ParticipantRole) || 'CALLER';
    const chunkIndex = typeof data.chunkIndex === 'number' ? data.chunkIndex : 0;
    const trackingKey = `${callId}_${participant}`;

    // STALE EVENT PROTECTION:
    // If we have already seen a higher chunk index for this participant on this call, discard it.
    const lastSeenIndex = this.lastChunkIndexMap.get(trackingKey);
    if (lastSeenIndex !== undefined && chunkIndex < lastSeenIndex) {
      return false; // Stale event discarded
    }
    this.lastChunkIndexMap.set(trackingKey, chunkIndex);

    const timestamp = data.timestamp || Date.now();
    this.lastUpdateTimestampMap.set(callId, timestamp);

    const decision = (data.decision as DecisionType) || 'UNCERTAIN';
    const decisionStrength = typeof data.decisionStrength === 'number' ? data.decisionStrength : 0.0;
    const conflictLevel = (data.conflictLevel as ConflictLevel) || 'LOW';
    const qualityScore = typeof data.qualityScore === 'number' ? data.qualityScore : 0.85;

    const item: ParticipantChunkTimelineItem = {
      chunkIndex,
      callId,
      participant,
      userId: data.userId || (participant === 'CALLER' ? 'USER-A' : 'USER-B'),
      startSec: typeof data.startSec === 'number' ? data.startSec : chunkIndex * 2.5,
      endSec: typeof data.endSec === 'number' ? data.endSec : chunkIndex * 2.5 + 5.0,
      decision,
      decisionStrength,
      qualityScore,
      conflictLevel,
      timestamp,
    };

    // Broadcast to subscribers
    this.analysisSubscribers.forEach((fn) => fn(item));

    // Automated Diagnostic Monitoring Alerts (Not fraud verdicts)
    if (conflictLevel === 'HIGH') {
      this.emitAlert({
        id: `alert-conflict-${callId}-${chunkIndex}`,
        callId,
        type: 'HIGH_CONFLICT',
        title: 'High Model Conflict Detected',
        message: `Wav2Vec2 and DF Arena produced opposing direction verdicts on chunk ${chunkIndex + 1}.`,
        timestamp,
        severity: 'warning',
      });
    }

    if (qualityScore < 0.6) {
      this.emitAlert({
        id: `alert-qual-${callId}-${chunkIndex}`,
        callId,
        type: 'LOW_QUALITY',
        title: 'Degraded Acoustic Quality',
        message: `Low SNR / clipping observed on ${participant} stream (quality: ${(qualityScore * 100).toFixed(0)}%).`,
        timestamp,
        severity: 'warning',
      });
    }

    if (data.backpressureDetected || data.streamState === 'STREAM_BACKPRESSURE') {
      this.emitAlert({
        id: `alert-backpressure-${callId}-${chunkIndex}`,
        callId,
        type: 'BACKPRESSURE',
        title: 'Inference Queue Backpressure',
        message: `AI analysis queue exceeded 4 windows. Oldest window dropped to maintain real-time sync.`,
        timestamp,
        severity: 'danger',
      });
    }

    return true;
  }

  private processCallEnded(data: any) {
    const callId = data.callId;
    const reason = data.reason || 'USER_ENDED';
    const durationSec = data.durationSec || 0;

    this.callEndedSubscribers.forEach((fn) => fn({ callId, reason, durationSec }));

    this.emitAlert({
      id: `alert-ended-${callId}-${Date.now()}`,
      callId,
      type: 'CALL_ENDED',
      title: 'Call Session Terminated',
      message: `Call ${callId} ended (${reason}). Duration: ${durationSec}s. Final report compiled.`,
      timestamp: Date.now(),
      severity: 'info',
    });
  }

  public emitAlert(alert: MonitoringAlert) {
    this.alertSubscribers.forEach((fn) => fn(alert));
  }

  // Subscription helpers
  public onAnalysisUpdate(fn: AnalysisUpdateHandler): () => void {
    this.analysisSubscribers.add(fn);
    return () => this.analysisSubscribers.delete(fn);
  }

  public onCallActive(fn: CallActiveHandler): () => void {
    this.callActiveSubscribers.add(fn);
    return () => this.callActiveSubscribers.delete(fn);
  }

  public onCallEnded(fn: CallEndedHandler): () => void {
    this.callEndedSubscribers.add(fn);
    return () => this.callEndedSubscribers.delete(fn);
  }

  public onAlert(fn: AlertHandler): () => void {
    this.alertSubscribers.add(fn);
    return () => this.alertSubscribers.delete(fn);
  }

  public onConnectionState(fn: ConnectionStateHandler): () => void {
    this.connectionStateSubscribers.add(fn);
    // Send immediate current state
    fn(this.connectionState);
    return () => this.connectionStateSubscribers.delete(fn);
  }

  public onPresenceUpdate(fn: PresenceUpdateHandler): () => void {
    this.presenceSubscribers.add(fn);
    return () => this.presenceSubscribers.delete(fn);
  }

  // For testing state reset
  public resetState() {
    this.lastChunkIndexMap.clear();
    this.lastUpdateTimestampMap.clear();
  }
}

export const liveMonitor = new LiveMonitoringService();
