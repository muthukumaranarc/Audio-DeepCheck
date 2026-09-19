import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CallRecord,
  ParticipantState,
  ParticipantChunkTimelineItem,
  EvidenceModule,
  AudioQualityInfo,
  MonitoringAlert,
  ConnectionState,
  DecisionType,
  ConflictLevel,
  ConfidenceStatus
} from '../types';
import { api } from '../services/api';
import { liveMonitor } from '../services/LiveMonitoringService';
import { mockEvidenceModules } from '../services/mockData';

export interface UseLiveCallMonitorOptions {
  callId: string;
  defaultCallerName?: string;
  defaultReceiverName?: string;
}

export function useLiveCallMonitor({
  callId,
  defaultCallerName = 'Muthu',
  defaultReceiverName = 'Friend',
}: UseLiveCallMonitorOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(liveMonitor.getConnectionState());
  const [callRecord, setCallRecord] = useState<CallRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Separate Participant States
  const [callerState, setCallerState] = useState<ParticipantState>({
    role: 'CALLER',
    userId: 'USER-A',
    displayName: defaultCallerName,
    phoneNumber: '+91 90000 00001',
    voiceActivity: false,
    quality: { score: 0.94, usable: true, snrDb: 28.5, flags: [] },
    latestDecision: 'HUMAN',
    decisionStrength: -0.65,
    confidenceStatus: 'PROVISIONAL',
    lastUpdate: Date.now(),
  });

  const [receiverState, setReceiverState] = useState<ParticipantState>({
    role: 'RECEIVER',
    userId: 'USER-B',
    displayName: defaultReceiverName,
    phoneNumber: '+91 90000 00002',
    voiceActivity: false,
    quality: { score: 0.92, usable: true, snrDb: 27.2, flags: [] },
    latestDecision: 'HUMAN',
    decisionStrength: -0.58,
    confidenceStatus: 'PROVISIONAL',
    lastUpdate: Date.now(),
  });

  // Participant-Specific Segregated Timelines
  const [callerTimeline, setCallerTimeline] = useState<ParticipantChunkTimelineItem[]>([]);
  const [receiverTimeline, setReceiverTimeline] = useState<ParticipantChunkTimelineItem[]>([]);

  // Telemetry Evidence Modules (5 models)
  const [evidenceModules, setEvidenceModules] = useState<EvidenceModule[]>(mockEvidenceModules);

  // Overall Master Decision & Quality
  const [masterDecision, setMasterDecision] = useState<DecisionType>('HUMAN');
  const [decisionStrength, setDecisionStrength] = useState<number>(-0.62);
  const [confidenceStatus, setConfidenceStatus] = useState<ConfidenceStatus>('PROVISIONAL');
  const [conflictLevel, setConflictLevel] = useState<ConflictLevel>('LOW');
  const [quality, setQuality] = useState<AudioQualityInfo>({
    score: 0.93,
    usable: true,
    snrDb: 28.0,
    flags: [],
  });

  // Specific Call Alerts
  const [callAlerts, setCallAlerts] = useState<MonitoringAlert[]>([]);

  // Timer reference for voice activity pulse simulation / decay
  const callerActivityTimer = useRef<any>(null);
  const receiverActivityTimer = useRef<any>(null);

  // Load Authoritative State via REST
  const refreshAuthoritativeState = useCallback(async () => {
    try {
      const details = await api.getCallDetails(callId);
      if (details) {
        setCallRecord(details);
        setMasterDecision(details.latestAnalysis || 'UNCERTAIN');
        if (details.decisionStrength !== undefined && details.decisionStrength !== null) {
          setDecisionStrength(details.decisionStrength);
        } else {
          setDecisionStrength(0.0);
        }

        if (details.confidenceStatus) setConfidenceStatus(details.confidenceStatus);
        if (details.conflictLevel) setConflictLevel(details.conflictLevel);
        if (details.quality) {
          setQuality({
            score: details.quality.score ?? 0.92,
            usable: details.quality.usable ?? true,
            snrDb: details.quality.snrDb ?? 28.0,
            flags: details.quality.flags ?? [],
          });
        } else if (details.qualityScore !== undefined && details.qualityScore !== null) {
          setQuality((prev) => ({
            ...prev,
            score: details.qualityScore ?? 0.92,
          }));
        }

        setCallerState((prev) => ({
          ...prev,
          displayName: details.caller || prev.displayName,
          userId: details.callerUserId || prev.userId,
          decisionStrength: (details.decisionStrength !== undefined && details.decisionStrength !== null) ? details.decisionStrength : prev.decisionStrength,
        }));
        setReceiverState((prev) => ({
          ...prev,
          displayName: details.receiver || prev.displayName,
          userId: details.receiverUserId || prev.userId,
          decisionStrength: (details.decisionStrength !== undefined && details.decisionStrength !== null) ? details.decisionStrength : prev.decisionStrength,
        }));
      }

      // Fetch Evidence
      const ev = await api.getCallEvidence(callId);
      if (ev && ev.modules && ev.modules.length > 0) {
        setEvidenceModules(ev.modules);
        setConflictLevel(ev.conflictLevel || 'LOW');
      }

      // Fetch Chunks
      const chunks = await api.getCallChunks(callId);
      if (chunks && chunks.length > 0) {
        // Segregate existing chunks between caller and receiver
        const callerChunks: ParticipantChunkTimelineItem[] = [];
        const receiverChunks: ParticipantChunkTimelineItem[] = [];

        chunks.forEach((ch, idx) => {
          // In two-user calls, even chunk indices represent caller turns, odd represent receiver turns
          // unless explicitly marked
          const role: 'CALLER' | 'RECEIVER' = idx % 2 === 0 ? 'CALLER' : 'RECEIVER';
          const item: ParticipantChunkTimelineItem = {
            chunkIndex: ch.chunkIndex,
            callId,
            participant: role,
            userId: role === 'CALLER' ? 'USER-A' : 'USER-B',
            startSec: ch.startSec,
            endSec: ch.endSec,
            decision: ch.decision,
            decisionStrength: ch.decisionStrength,
            qualityScore: ch.qualityScore,
            conflictLevel: 'LOW',
            timestamp: Date.now() - (chunks.length - idx) * 2500,
          };

          if (role === 'CALLER') {
            callerChunks.push(item);
          } else {
            receiverChunks.push(item);
          }
        });

        setCallerTimeline(callerChunks.sort((a, b) => a.chunkIndex - b.chunkIndex));
        setReceiverTimeline(receiverChunks.sort((a, b) => a.chunkIndex - b.chunkIndex));
      }
    } catch {
      // Keep state
    } finally {
      setIsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    refreshAuthoritativeState();
    liveMonitor.connect();

    // Subscribe to live connection changes
    const unsubConn = liveMonitor.onConnectionState((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        // Reconnection recovery: fetch authoritative state
        refreshAuthoritativeState();
      }
    });

    // Subscribe to analysis updates
    const unsubAnalysis = liveMonitor.onAnalysisUpdate((event) => {
      if (event.callId !== callId) return;

      const isCaller = event.participant === 'CALLER' || event.userId === 'USER-A';
      const safeStrength = (event.decisionStrength !== undefined && event.decisionStrength !== null) ? event.decisionStrength : 0.0;

      if (isCaller) {
        // Update Caller
        setCallerState((prev) => ({
          ...prev,
          latestDecision: event.decision,
          decisionStrength: safeStrength,
          voiceActivity: true,
          lastUpdate: Date.now(),
        }));

        // Pulse voice activity for 1.5s
        if (callerActivityTimer.current) clearTimeout(callerActivityTimer.current);
        callerActivityTimer.current = setTimeout(() => {
          setCallerState((prev) => ({ ...prev, voiceActivity: false }));
        }, 1500);

        // Add to Caller Timeline without duplicates
        setCallerTimeline((prev) => {
          const exists = prev.some((p) => p.chunkIndex === event.chunkIndex);
          if (exists) {
            return prev.map((p) => (p.chunkIndex === event.chunkIndex ? event : p));
          }
          return [...prev, event].sort((a, b) => a.chunkIndex - b.chunkIndex);
        });
      } else {
        // Update Receiver
        setReceiverState((prev) => ({
          ...prev,
          latestDecision: event.decision,
          decisionStrength: safeStrength,
          voiceActivity: true,
          lastUpdate: Date.now(),
        }));

        // Pulse voice activity for 1.5s
        if (receiverActivityTimer.current) clearTimeout(receiverActivityTimer.current);
        receiverActivityTimer.current = setTimeout(() => {
          setReceiverState((prev) => ({ ...prev, voiceActivity: false }));
        }, 1500);

        // Add to Receiver Timeline without duplicates
        setReceiverTimeline((prev) => {
          const exists = prev.some((p) => p.chunkIndex === event.chunkIndex);
          if (exists) {
            return prev.map((p) => (p.chunkIndex === event.chunkIndex ? event : p));
          }
          return [...prev, event].sort((a, b) => a.chunkIndex - b.chunkIndex);
        });
      }

      // Update Master Decision
      setMasterDecision(event.decision);
      setDecisionStrength(safeStrength);
      if (event.conflictLevel) setConflictLevel(event.conflictLevel);
    });

    // Subscribe to call ended
    const unsubEnded = liveMonitor.onCallEnded((data) => {
      if (data.callId === callId) {
        setCallRecord((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
        refreshAuthoritativeState();
      }
    });

    // Subscribe to alerts
    const unsubAlert = liveMonitor.onAlert((alert) => {
      if (alert.callId === callId || alert.callId === 'SYSTEM') {
        setCallAlerts((prev) => [alert, ...prev.slice(0, 9)]);
      }
    });

    // Periodic polling sync every 6s as backup
    const poller = setInterval(() => {
      refreshAuthoritativeState();
    }, 6000);

    return () => {
      unsubConn();
      unsubAnalysis();
      unsubEnded();
      unsubAlert();
      clearInterval(poller);
      if (callerActivityTimer.current) clearTimeout(callerActivityTimer.current);
      if (receiverActivityTimer.current) clearTimeout(receiverActivityTimer.current);
    };
  }, [callId, refreshAuthoritativeState]);

  return {
    callRecord,
    connectionState,
    callerState,
    receiverState,
    callerTimeline,
    receiverTimeline,
    evidenceModules,
    masterDecision,
    decisionStrength,
    confidenceStatus,
    conflictLevel,
    quality,
    callAlerts,
    isLoading,
    refresh: refreshAuthoritativeState,
  };
}
