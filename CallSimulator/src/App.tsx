import React from 'react';
import { MobileFrame } from './components/layout/MobileFrame';
import { DialerScreen } from './components/screens/DialerScreen';
import { ConnectingScreen } from './components/screens/ConnectingScreen';
import { ActiveCallScreen } from './components/screens/ActiveCallScreen';
import { EndedCallScreen } from './components/screens/EndedCallScreen';
import { IncomingCallModal } from './components/screens/IncomingCallModal';
import { useCallSession } from './hooks/useCallSession';
import { useMicrophonePermission } from './hooks/useMicrophonePermission';
import { useNetworkState } from './hooks/useNetworkState';
import { IdentityService } from './services/IdentityService';

export const App: React.FC = () => {
  const {
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
    audioLevel,
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
  } = useCallSession();

  const {
    permissionState: micPermissionState,
    requestPermission,
  } = useMicrophonePermission();

  const { connectionState } = useNetworkState();

  const handleStartCall = async (targetReceiver: string, callerName?: string) => {
    if (micPermissionState !== 'GRANTED') {
      try {
        await requestPermission();
      } catch {
        // Fallback capture will generate simulated audio
      }
    }
    await startCallSession(targetReceiver, callerName);
  };

  const handleAcceptIncoming = async () => {
    if (micPermissionState !== 'GRANTED') {
      try {
        await requestPermission();
      } catch {
        // Fallback capture will generate simulated audio
      }
    }
    await acceptIncomingCall();
  };

  const renderActiveScreen = () => {
    switch (callState) {
      case 'CREATING_CALL':
      case 'RINGING':
      case 'CONNECTING':
        return (
          <ConnectingScreen
            receiver={receiver}
            caller={caller}
            onCancel={() => endCallSession('USER_CANCELLED')}
          />
        );

      case 'ACTIVE':
      case 'ENDING':
        return (
          <ActiveCallScreen
            callId={callId}
            receiver={receiver}
            caller={caller}
            participantRole={participantRole}
            elapsedSeconds={elapsedSeconds}
            audioLevel={audioLevel}
            remoteAudioLevel={remoteAudioLevel}
            latestAnalysis={latestAnalysis}
            isMuted={isMuted}
            connectionState={connectionState}
            onToggleMute={toggleMute}
            onEndCall={() => endCallSession('USER_ENDED')}
          />
        );

      case 'COMPLETED':
        return (
          <EndedCallScreen
            callId={callId}
            receiver={receiver}
            durationSeconds={elapsedSeconds}
            completedDetails={completedDetails}
            onReturnHome={resetToIdle}
          />
        );

      case 'IDLE':
      default:
        return (
          <DialerScreen
            currentUser={currentUser}
            peerUser={IdentityService.getPeerUser()}
            presenceList={presenceList}
            onSwitchIdentity={switchIdentity}
            onStartCall={handleStartCall}
            connectionState={connectionState}
            micPermissionState={micPermissionState}
            onRequestMicPermission={requestPermission}
            failureState={failureState}
            errorMessage={errorMessage}
          />
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen py-4 px-2">
      <MobileFrame
        connectionState={connectionState}
        micPermissionState={micPermissionState}
      >
        {renderActiveScreen()}

        {/* Incoming Call Modal Overlay */}
        {incomingCall && (
          <IncomingCallModal
            caller={incomingCall.caller}
            onAccept={handleAcceptIncoming}
            onDecline={declineIncomingCall}
          />
        )}
      </MobileFrame>
    </div>
  );
};

export default App;
