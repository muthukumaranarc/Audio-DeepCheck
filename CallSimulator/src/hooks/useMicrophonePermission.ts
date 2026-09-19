import { useState, useEffect, useCallback } from 'react';
import { MicPermissionState } from '../types';

export function useMicrophonePermission() {
  const [permissionState, setPermissionState] = useState<MicPermissionState>('UNKNOWN');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check existing permission state if supported
  useEffect(() => {
    let mounted = true;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          if (!mounted) return;

          const updateState = () => {
            if (permissionStatus.state === 'granted') {
              setPermissionState('GRANTED');
            } else if (permissionStatus.state === 'denied') {
              setPermissionState('BLOCKED');
            } else {
              setPermissionState('UNKNOWN');
            }
          };

          updateState();
          permissionStatus.onchange = updateState;
        })
        .catch(() => {
          // Permissions query not supported or rejected
          if (mounted) setPermissionState('UNKNOWN');
        });
    }

    return () => {
      mounted = false;
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('BLOCKED');
      setErrorMessage('Audio recording is not supported on this device/browser.');
      return false;
    }

    setPermissionState('REQUESTING');
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop track so mic indicator does not stay active before actual call
      stream.getTracks().forEach((track) => track.stop());

      setPermissionState('GRANTED');
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        // User explicitly clicked "Deny" or blocked in browser settings
        setPermissionState('DENIED');
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermissionState('BLOCKED');
        setErrorMessage('No microphone input device found.');
      } else {
        setPermissionState('DENIED');
        setErrorMessage(`Microphone error: ${error.message || 'Permission failed'}`);
      }
      return false;
    }
  }, []);

  return {
    permissionState,
    errorMessage,
    hasPermission: permissionState === 'GRANTED',
    requestPermission
  };
}
