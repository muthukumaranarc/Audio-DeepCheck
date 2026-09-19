import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CallState,
  CallFailureState,
  CallDetailsResponse,
  UserProfile,
  UserPresence,
  IncomingCallEvent,
  AnalysisUpdateEvent,
  ParticipantRole,
} from '../types';
import { callApiService } from '../services/CallApiService';
import { audioCaptureService } from '../services/AudioCaptureService';
import { AudioPlaybackService } from '../services/AudioPlaybackService';
import { AudioStreamingService } from '../services/AudioStreamingService';
import { IdentityService } from '../services/IdentityService';

export function useCallSession() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(IdentityService.getActiveUser());
  const [presenceList, setPresenceList] = useState<UserPresence[]>([]);

  const [callState, setCallState] = useState<CallState>('IDLE');
  const [failureState, setFailureState] = useState<CallFailureState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [callId, setCallId] = useState<string | null>(null);
  const [caller, setCaller] = useState<string>(currentUser.displayName);
  const [receiver, setReceiver] = useState<string>(IdentityService.getPeerUser().displayName);
  const [participantRole, setParticipantRole] = useState<ParticipantRole>('CALLER');

  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisUpdateEvent | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [completedDetails, setCompletedDetails] = useState<CallDetailsResponse | null>(null);

  // References for services and loops
  const playbackServiceRef = useRef<AudioPlaybackService | null>(null);
  const streamingServiceRef = useRef<AudioStreamingService | null>(null);
  const audioUnsubRef = useRef<(() => void) | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize playback & streaming services
  if (!playbackServiceRef.current) {
    playbackServiceRef.current = new AudioPlaybackService();
  }
  if (!streamingServiceRef.current) {
    streamingServiceRef.current = new AudioStreamingService(
      currentUser,
      playbackServiceRef.current
    );
  }

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    callStartTimeRef.current = null;
  }, []);

  const stopAudioLevelLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setLocalAudioLevel(0);
    setRemoteAudioLevel(0);
  }, []);

  const startAudioLevelLoop = useCallback(() => {
    stopAudioLevelLoop();
    const updateLevel = () => {
      setLocalAudioLevel(audioCaptureService.getAudioLevel());
      if (playbackServiceRef.current) {
        setRemoteAudioLevel(playbackServiceRef.current.getRemoteAudioLevel());
      }
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    animFrameRef.current = requestAnimationFrame(updateLevel);
  }, [stopAudioLevelLoop]);

  const cleanupHardwareAndMedia = useCallback(() => {
    stopTimer();
    stopAudioLevelLoop();

    if (audioUnsubRef.current) {
      audioUnsubRef.current();
      audioUnsubRef.current = null;
    }

    audioCaptureService.stopCapture();

    if (playbackServiceRef.current) {
      playbackServiceRef.current.stop();
    }

    if (streamingServiceRef.current) {
      streamingServiceRef.current.endCallSession();
    }
  }, [stopTimer, stopAudioLevelLoop]);

  // Activate media hardware and start streaming for an active call
  const activateMedia = useCallback(async (activeCallId: string, role: ParticipantRole) => {
    setCallId(activeCallId);
    setParticipantRole(role);
    setCallState('ACTIVE');
    setIncomingCall(null);
    setFailureState(null);

    // 1. Initialize remote audio playback
    if (playbackServiceRef.current) {
      await playbackServiceRef.current.initialize();
    }

    // 2. Configure streaming service
    if (streamingServiceRef.current) {
      streamingServiceRef.current.startCallSession(activeCallId, role);
    }

    // 3. Start audio capture (real mic or simulated fallback)
    try {
      await audioCaptureService.startCapture();

      // Forward audio frames to WebSocket
      audioUnsubRef.current = audioCaptureService.onDataAvailable((chunk) => {
        streamingServiceRef.current?.sendAudioChunk(chunk.data, chunk.durationMs);
      });
    } catch (err: unknown) {
      console.warn('Microphone capture warning (using silent/simulated fallback):', err);
    }

    // 4. Start call timer & audio equalizer loops
    callStartTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }
    }, 1000);

    startAudioLevelLoop();
  }, [cleanupHardwareAndMedia, startAudioLevelLoop]);

  // Wire WebSocket event callbacks
  useEffect(() => {
    const streaming = streamingServiceRef.current;
    if (!streaming) return;

    streaming.setCallbacks({
      onPresenceUpdate: (users) => {
        setPresenceList(users);
      },
      onIncomingCall: (event) => {
        setIncomingCall(event);
      },
      onCallRinging: (ringingCallId, peer) => {
        setCallId(ringingCallId);
        setReceiver(peer.displayName || peer.phoneNumber);
        setCallState('RINGING');
      },
      onCallActive: (activeCallId) => {
        // Only auto-activate for the CALLER side (CREATING_CALL / RINGING).
        // The RECEIVER side already called activateMedia via acceptIncomingCall()
        // with the correct 'RECEIVER' role — do NOT override it here.
        setCallState((prev) => {
          if (prev === 'CREATING_CALL' || prev === 'RINGING') {
            // Activate asynchronously so we can use the current state value
            activateMedia(activeCallId, 'CALLER');
          }
          return prev; // keep existing state; activateMedia sets it to ACTIVE
        });
      },
      onCallRejected: (_cid, reason) => {
        cleanupHardwareAndMedia();
        setCallState('IDLE');
        setFailureState('CALL_REJECTED');
        setErrorMessage(reason ? `Call was declined (${reason})` : 'Call was declined by receiver');
      },
      onCallCancelled: (_cid, reason) => {
        cleanupHardwareAndMedia();
        setIncomingCall(null);
        setCallState('IDLE');
        setFailureState('CALL_CANCELLED');
        setErrorMessage(reason ? `Call cancelled (${reason})` : 'Caller cancelled the call');
      },
      onCallBusy: (_cid, receiverName) => {
        cleanupHardwareAndMedia();
        setCallState('IDLE');
        setFailureState('CALL_BUSY');
        setErrorMessage(`${receiverName || 'User'} is currently busy on another call`);
      },
      onCallEnded: async (endedCallId, _reason, duration) => {
        cleanupHardwareAndMedia();
        setElapsedSeconds(duration);
        setCallState('COMPLETED');
        try {
          const details = await callApiService.getCall(endedCallId);
          if (details) setCompletedDetails(details);
        } catch {
          // ignore
        }
      },
      onAnalysisUpdate: (analysisEvent) => {
        setLatestAnalysis(analysisEvent);
      },
      onError: (code, msg) => {
        console.warn('Signaling Error:', code, msg);
      },
    });

    streaming.connect();

    return () => {
      cleanupHardwareAndMedia();
    };
  }, [activateMedia, cleanupHardwareAndMedia]);

  // Handle identity changes
  const switchIdentity = useCallback(() => {
    const nextUser = IdentityService.switchUser();
    setCurrentUser(nextUser);
    setCaller(nextUser.displayName);
    setReceiver(IdentityService.getPeerUser().displayName);
    streamingServiceRef.current?.updateUser(nextUser);
  }, []);

  /**
   * Initiate an outgoing call
   */
  const startCallSession = useCallback(async (
    targetReceiver: string = IdentityService.getPeerUser().phoneNumber,
    callerName: string = currentUser.displayName
  ) => {
    if (callState !== 'IDLE' && callState !== 'COMPLETED' && !failureState) {
      return;
    }

    setErrorMessage(null);
    setFailureState(null);
    setReceiver(targetReceiver);
    setCaller(callerName);
    setElapsedSeconds(0);
    setIsMuted(false);
    setCompletedDetails(null);
    setLatestAnalysis(null);

    setCallState('CREATING_CALL');

    // Prioritize WebSocket signaling when connected to ensure synchronized two-user session
    if (streamingServiceRef.current && streamingServiceRef.current.getIsConnected()) {
      streamingServiceRef.current.inviteCall(targetReceiver);
      // Server will respond with CALL_RINGING (caller) and INCOMING_CALL (receiver)
      return;
    }

    // Fallback: REST call creation & start (when offline or in test environments without active WebSocket)
    try {
      const createRes = await callApiService.createCall(callerName, targetReceiver);
      setCallId(createRes.callId);

      const startRes = await callApiService.startCall(createRes.callId);
      if (startRes.status === 'ACTIVE') {
        await activateMedia(createRes.callId, 'CALLER');
      }
    } catch (err: unknown) {
      if (callState === 'ACTIVE' || callState === 'RINGING') return;
      const error = err as Error;
      cleanupHardwareAndMedia();
      setCallState('IDLE');
      setFailureState('CREATE_FAILED');
      setErrorMessage(error.message || 'Failed to establish call session');
    }
  }, [callState, failureState, currentUser, activateMedia, cleanupHardwareAndMedia]);

  /**
   * Accept an incoming call
   */
  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;

    const callIdToAccept = incomingCall.callId;
    setReceiver(incomingCall.caller.displayName || incomingCall.caller.phoneNumber);
    setIncomingCall(null);

    // Tell server we accepted
    streamingServiceRef.current?.acceptCall(callIdToAccept);

    // Activate hardware & streaming as RECEIVER
    await activateMedia(callIdToAccept, 'RECEIVER');
  }, [incomingCall, activateMedia]);

  /**
   * Decline/reject an incoming call
   */
  const declineIncomingCall = useCallback((reason: string = 'USER_DECLINED') => {
    if (!incomingCall) return;
    streamingServiceRef.current?.rejectCall(incomingCall.callId, reason);
    setIncomingCall(null);
  }, [incomingCall]);

  /**
   * End the active or connecting call
   */
  const endCallSession = useCallback(async (reason: string = 'USER_ENDED') => {
    if (callState === 'IDLE' || callState === 'COMPLETED') {
      return;
    }

    const currentCallId = callId;
    setCallState('ENDING');

    cleanupHardwareAndMedia();

    if (currentCallId) {
      streamingServiceRef.current?.endCall(currentCallId, reason);
      try {
        await callApiService.endCall(currentCallId, reason);
        const details = await callApiService.getCall(currentCallId);
        if (details) setCompletedDetails(details);
      } catch {
        // ignore
      }
    }

    setCallState('COMPLETED');
  }, [callState, callId, cleanupHardwareAndMedia]);

  /**
   * Toggle microphone mute
   */
  const toggleMute = useCallback(() => {
    if (isMuted) {
      audioCaptureService.resumeCapture();
      setIsMuted(false);
    } else {
      audioCaptureService.pauseCapture();
      setIsMuted(true);
      setLocalAudioLevel(0);
    }
  }, [isMuted]);

  /**
   * Reset back to IDLE
   */
  const resetToIdle = useCallback(() => {
    cleanupHardwareAndMedia();
    setCallState('IDLE');
    setFailureState(null);
    setErrorMessage(null);
    setCallId(null);
    setElapsedSeconds(0);
    setCompletedDetails(null);
    setLatestAnalysis(null);
    setIsMuted(false);
    setIncomingCall(null);
  }, [cleanupHardwareAndMedia]);

  return {
    currentUser,
    presenceList,
    callState,
    failureState,
    errorMessage,
    callId,
    caller,
    receiver,
    participantRole,
    incomingCall,
    latestAnalysis,
    elapsedSeconds,
    audioLevel: localAudioLevel,
    localAudioLevel,
    remoteAudioLevel,
    isMuted,
    completedDetails,
    startCallSession,
    acceptIncomingCall,
    declineIncomingCall,
    endCallSession,
    switchIdentity,
    toggleMute,
    resetToIdle,
  };
}
