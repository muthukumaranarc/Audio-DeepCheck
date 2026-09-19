import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LiveCallMonitorPage } from '../pages/LiveCallMonitorPage';
import { api } from '../services/api';

describe('LiveCallMonitorPage UI Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(api, 'getCallDetails').mockResolvedValue({
      callId: 'CALL-1001',
      caller: 'Muthu',
      receiver: 'Friend',
      duration: '01:00',
      durationSec: 60,
      status: 'ACTIVE',
      latestAnalysis: 'HUMAN',
      createdAt: new Date(Date.now() - 60000).toISOString(),
    });

    vi.spyOn(api, 'getAnalysisStatus').mockResolvedValue({
      callId: 'CALL-1001',
      status: 'ANALYZING',
      latestDecision: 'HUMAN',
      decisionStrength: 0.94,
      confidenceStatus: 'PROVISIONAL',
      qualityScore: 0.92,
      conflictLevel: 'LOW',
      lastProcessedSequence: 16,
    });
  });

  it('renders dual participant panels for Caller and Receiver', async () => {
    render(
      <MemoryRouter initialEntries={['/live-monitor/CALL-1001']}>
        <Routes>
          <Route path="/live-monitor/:callId" element={<LiveCallMonitorPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Caller panel
    expect(screen.getByText('CALLER')).toBeInTheDocument();
    expect(screen.getByText('Muthu')).toBeInTheDocument();

    // Receiver panel
    expect(screen.getByText('RECEIVER')).toBeInTheDocument();
    expect(screen.getByText('Friend')).toBeInTheDocument();
  });

  it('renders master decision banner with provisional strength indicator', async () => {
    render(
      <MemoryRouter initialEntries={['/live-monitor/CALL-1001']}>
        <Routes>
          <Route path="/live-monitor/:callId" element={<LiveCallMonitorPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Live Dual-Voice Telephony Monitor')).toBeInTheDocument();
    expect(screen.getByText('CALL-1001')).toBeInTheDocument();
    expect(screen.getByText('Session Decision')).toBeInTheDocument();
    expect(screen.getByText(/Continuous signed scale; not a calibrated probability/i)).toBeInTheDocument();
  });

  it('renders all 5 AI model telemetry indicators with signed contributions', async () => {
    render(
      <MemoryRouter initialEntries={['/live-monitor/CALL-1001']}>
        <Routes>
          <Route path="/live-monitor/:callId" element={<LiveCallMonitorPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Check all 5 models are displayed
    expect(screen.getByText('Wav2Vec2 INT8 ONNX')).toBeInTheDocument();
    expect(screen.getByText('DF Arena 500M')).toBeInTheDocument();
    expect(screen.getByText('Spectrogram CNN')).toBeInTheDocument();
    expect(screen.getByText('Prosody / F0 Analyzer')).toBeInTheDocument();
    expect(screen.getByText('Whisper Tiny Rep')).toBeInTheDocument();

    // Verify directional signed contribution guidance text
    expect(screen.getByText(/Directional contributions across 5 deepfake audio analysis models/i)).toBeInTheDocument();
  });

  it('renders participant-segregated timeline lanes', async () => {
    render(
      <MemoryRouter initialEntries={['/live-monitor/CALL-1001']}>
        <Routes>
          <Route path="/live-monitor/:callId" element={<LiveCallMonitorPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Participant-Segregated Chunk Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Muthu \(Caller Lane\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Friend \(Receiver Lane\)/i)).toBeInTheDocument();
  });

  it('renders acoustic quality diagnostics panel', async () => {
    render(
      <MemoryRouter initialEntries={['/live-monitor/CALL-1001']}>
        <Routes>
          <Route path="/live-monitor/:callId" element={<LiveCallMonitorPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Signal Quality Gate')).toBeInTheDocument();
    expect(screen.getAllByText(/SNR:/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Bandwidth: 16 kHz/i)).toBeInTheDocument();
  });

  it('handles End Call user interaction', async () => {
    const endCallSpy = vi.spyOn(api, 'endCall').mockResolvedValue(true);

    render(
      <MemoryRouter initialEntries={['/live-monitor/CALL-1001']}>
        <Routes>
          <Route path="/live-monitor/:callId" element={<LiveCallMonitorPage />} />
        </Routes>
      </MemoryRouter>
    );

    const endButton = screen.getByRole('button', { name: /End Call/i });
    expect(endButton).toBeInTheDocument();

    fireEvent.click(endButton);

    await waitFor(() => {
      expect(endCallSpy).toHaveBeenCalledWith('CALL-1001', 'OPERATOR_ENDED');
    });
  });
});
