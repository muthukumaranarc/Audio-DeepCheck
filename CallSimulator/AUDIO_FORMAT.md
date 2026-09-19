# Audio Format Specification — Mobile Call Simulator

## 1. Executive Summary

This document specifies the actual audio format captured by the Mobile Call Simulator (`CallSimulator/`) and defines the data boundary interfacing with the future streaming layer (`AudioStreamingService`, Milestone 12).

---

## 2. Actual Audio Capture Specifications

Based on the Web Audio API standard implemented in `AudioCaptureService`:

| Attribute | Specification | Technical Rationale |
| :--- | :--- | :--- |
| **Sample Rate** | **16,000 Hz** (or native hardware fallback `44,100 Hz` / `48,000 Hz`) | The downstream deepfake detection models (Wav2Vec2, DF Arena 500M, Whisper Tiny, Spectrogram, Prosody) operate strictly at 16,000 Hz. The AudioContext requests 16 kHz directly from browser media hardware. |
| **Channels** | **1 (Mono)** | Voice telephony is single-channel mono. Media constraints enforce `{ channelCount: 1 }`, averaging or selecting channel 0. |
| **Sample Format** | **32-bit Float PCM (`Float32Array`)** | Native Web Audio API `AudioBuffer` format, with sample values in range `[-1.0, +1.0]`. Ready for direct conversion to signed 16-bit PCM (`Int16Array`) or Opus frames in Milestone 12. |
| **Frame / Buffer Size** | **2,048 samples** per frame | At 16,000 Hz, 2,048 samples corresponds to **128.0 ms** per frame. At 48,000 Hz, it corresponds to **42.6 ms**. This provides smooth real-time volume calculation and low-latency chunk buffering. |
| **Audio Preprocessing** | Hardware / Browser AGC, AEC, NS | MediaTrackConstraints: `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`. |
| **Audio Level Metric** | **Normalized Root Mean Square (RMS)** | $RMS = \sqrt{\frac{1}{N} \sum_{i=1}^N x[i]^2}$, clamped to `[0.0, 1.0]`. Exclusively used for UI microphone activity indication. |

---

## 3. Data Structure Contract

Each captured audio frame is packaged as an `AudioDataChunk`:

```typescript
export interface AudioDataChunk {
  sequenceNumber: number; // Monotonically increasing sequence index (0, 1, 2, ...)
  timestampMs: number;    // Unix epoch timestamp in milliseconds (Date.now())
  durationMs: number;     // Frame duration in milliseconds (~128 ms at 16kHz)
  data: Float32Array;     // Raw float32 PCM samples in [-1.0, 1.0]
  rmsLevel: number;       // Physical energy level for local UI meter
}
```

---

## 4. Architectural Separation (Non-Goals Honored)

```text
┌─────────────────────────────────────────────────────────────┐
│  Mobile Call Simulator (Milestone 11 - COMPLETE)            │
│                                                             │
│  Microphone Hardware                                        │
│         ↓                                                   │
│  getUserMedia({ audio: true })                              │
│         ↓                                                   │
│  AudioContext (16 kHz, Mono)                                │
│         ↓                                                   │
│  AudioCaptureService (start/pause/resume/stop)              │
│         ↓                                                   │
│  Local AudioVisualizer (Activity Meter)                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Clean Interface Boundary)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  AudioStreamingService (Milestone 12 - UPCOMING)            │
│                                                             │
│  PCM16 / Opus Encoder                                       │
│         ↓                                                   │
│  WebSocket Transport                                        │
│         ↓                                                   │
│  Spring Boot (Voice Ingestion)                              │
│         ↓                                                   │
│  FastAPI Multi-Evidence AI Pipeline                         │
└─────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> `AudioCaptureService` does NOT contain any network transport or WebSocket logic. In Milestone 12, `AudioStreamingService` will subscribe to `audioCaptureService.onDataAvailable(chunk)` to transmit framed binary payloads to the Spring Boot backend.
