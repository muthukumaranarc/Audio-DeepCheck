import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Web Audio API classes for jsdom environment
class MockAudioContext {
  sampleRate = 16000;
  currentTime = 0;
  state = 'running';
  destination = {};

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createAnalyser() {
    return {
      fftSize: 512,
      smoothingTimeConstant: 0.3,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      getByteFrequencyData: vi.fn(),
    };
  }

  createScriptProcessor() {
    return {
      onaudioprocess: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createBuffer() {
    return {
      duration: 0.128,
      copyToChannel: vi.fn(),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

// Attach mocks to window
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: MockAudioContext,
});

// Mock MediaDevices
const mockTrack = {
  stop: vi.fn(),
  kind: 'audio',
  enabled: true,
};

const mockMediaStream = {
  getTracks: () => [mockTrack],
  getAudioTracks: () => [mockTrack],
};

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
});

// Mock WebSocket
class MockWebSocket {
  public static OPEN = 1;
  public static CONNECTING = 0;
  public static CLOSING = 2;
  public static CLOSED = 3;

  public readyState = 1;
  public binaryType = 'blob';
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  public send = vi.fn();
  public close = vi.fn();

  constructor(public url: string) {
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }
}

Object.defineProperty(window, 'WebSocket', {
  writable: true,
  value: MockWebSocket,
});
