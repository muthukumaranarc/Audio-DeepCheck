package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.domain.*;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.repository.AnalysisRepository;
import com.audiodeepcheck.backend.websocket.WavUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Manages audio buffering into 5.0-second sliding windows with 2.5-second hops,
 * enforces bounded AI analysis queuing and backpressure control, and dispatches
 * participant-aware audio windows to FastAPI asynchronously.
 */
@Service
public class CallAiWindowScheduler {

    private static final Logger log = LoggerFactory.getLogger(CallAiWindowScheduler.class);

    public static final int SAMPLE_RATE = 16000;
    public static final int CHANNELS = 1;
    public static final int BYTES_PER_SAMPLE = 2; // 16-bit PCM

    // 5.0 seconds = 80,000 samples = 160,000 bytes
    public static final int WINDOW_BYTES = 80000 * BYTES_PER_SAMPLE;
    // 2.5 seconds hop = 40,000 samples = 80,000 bytes
    public static final int HOP_BYTES = 40000 * BYTES_PER_SAMPLE;
    // Minimum 1.0 second for final flush = 16,000 samples = 32,000 bytes
    public static final int MIN_FLUSH_BYTES = 16000 * BYTES_PER_SAMPLE;

    public static final int MAX_PENDING_ANALYSES = 4;

    private final FastApiAiClient aiClient;
    private final CallSessionService sessionService;
    private final AnalysisRepository analysisRepository;
    private final UserPresenceService presenceService;

    private final ExecutorService aiExecutor;
    private final AtomicInteger pendingJobs = new AtomicInteger(0);

    // In-memory audio buffers per call and participant
    private final Map<String, ParticipantAudioBuffer> callerBuffers = new ConcurrentHashMap<>();
    private final Map<String, ParticipantAudioBuffer> receiverBuffers = new ConcurrentHashMap<>();

    public CallAiWindowScheduler(
            FastApiAiClient aiClient,
            CallSessionService sessionService,
            AnalysisRepository analysisRepository,
            UserPresenceService presenceService,
            @Value("${audiodeepcheck.ai-scheduler.threads:2}") int threadCount
    ) {
        this.aiClient = aiClient;
        this.sessionService = sessionService;
        this.analysisRepository = analysisRepository;
        this.presenceService = presenceService;
        this.aiExecutor = Executors.newFixedThreadPool(Math.max(1, threadCount), r -> {
            Thread t = new Thread(r, "ai-window-dispatcher");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Appends an incoming PCM16 audio frame to the participant's sliding window buffer.
     * Extracts full 5-second windows when available and submits them to the AI queue.
     */
    public void appendAudio(
            String callId,
            String participantRole,
            String userId,
            byte[] pcm16Bytes,
            long sequenceNumber
    ) {
        if (pcm16Bytes == null || pcm16Bytes.length == 0) return;

        boolean isCaller = "CALLER".equalsIgnoreCase(participantRole);
        Map<String, ParticipantAudioBuffer> bufferMap = isCaller ? callerBuffers : receiverBuffers;

        ParticipantAudioBuffer participantBuffer = bufferMap.computeIfAbsent(
                callId,
                id -> new ParticipantAudioBuffer(callId, participantRole, userId)
        );

        List<AudioWindowTask> readyWindows;
        synchronized (participantBuffer) {
            participantBuffer.append(pcm16Bytes, sequenceNumber);
            readyWindows = participantBuffer.extractReadyWindows();
        }

        for (AudioWindowTask task : readyWindows) {
            dispatchWindowTask(task);
        }
    }

    /**
     * Dispatches a 5.0-second WAV window to the bounded AI queue.
     */
    private void dispatchWindowTask(AudioWindowTask task) {
        if (pendingJobs.get() >= MAX_PENDING_ANALYSES) {
            log.warn("STREAM_BACKPRESSURE: AI analysis queue full (pending={}/max={}). Dropping chunkIndex={} for callId={}, participant={}",
                    pendingJobs.get(), MAX_PENDING_ANALYSES, task.chunkIndex, task.callId, task.participantRole);
            try {
                CallSession session = sessionService.getSessionOrThrow(task.callId);
                session.setBackpressureDetected(true);
                sessionService.save(session);
            } catch (Exception e) {
                // Ignore if session not found
            }
            return;
        }

        pendingJobs.incrementAndGet();
        aiExecutor.submit(() -> {
            try {
                processAiWindow(task);
            } finally {
                pendingJobs.decrementAndGet();
            }
        });
    }

    private void processAiWindow(AudioWindowTask task) {
        String reqId = "req-ai-" + UUID.randomUUID().toString().substring(0, 8);
        log.info("Processing AI window: callId={}, participant={}, chunk={}, time=[{}-{}s], bytes={}",
                task.callId, task.participantRole, task.chunkIndex, task.startSec, task.endSec, task.wavData.length);

        org.springframework.core.io.ByteArrayResource resource = new org.springframework.core.io.ByteArrayResource(task.wavData) {
            @Override
            public String getFilename() {
                return "window-" + task.chunkIndex + ".wav";
            }
        };

        try {
            FastApiAnalyzeDto result = aiClient.analyzeAudio(
                    resource,
                    "window-" + task.chunkIndex + ".wav",
                    5.0,
                    2.5,
                    null,
                    true,
                    true,
                    reqId
            );
            handleAnalysisSuccess(task, result, reqId);
        } catch (Exception e) {
            handleAnalysisFailure(task, e);
        }
    }

    private void handleAnalysisSuccess(AudioWindowTask task, FastApiAnalyzeDto result, String reqId) {
        try {
            CallSession session = sessionService.getSessionOrThrow(task.callId);
            CallDecision decision = parseDecision(result.masterDecision());
            Double strength = result.decisionStrength();
            Double syntheticScore = result.getEffectiveSyntheticScore();
            ConflictLevel conflict = parseConflictLevel(result.getEffectiveConflictLevel());
            
            AudioQuality quality = null;
            if (result.quality() != null) {
                quality = new AudioQuality(
                        result.quality().qualityScore(),
                        result.quality().usable(),
                        result.quality().snrDb(),
                        result.quality().flags()
                );
            }

            // Record into live call session
            session.recordAnalysisResult(
                    decision, strength, syntheticScore, conflict, quality, (int) task.endSequence, reqId
            );
            sessionService.save(session);

            // Persist chunk to analysis repository
            List<FastApiAnalyzeDto.ChunkDetailDto> chunkDetails = result.getEffectiveChunkDetails();
            if (!chunkDetails.isEmpty()) {
                for (var chunkDto : chunkDetails) {
                    AudioChunkAnalysis chunk = new AudioChunkAnalysis(
                            task.chunkIndex,
                            chunkDto.startSec() != null ? chunkDto.startSec() : task.startSec,
                            chunkDto.endSec() != null ? chunkDto.endSec() : task.endSec,
                            parseDecision(chunkDto.effectiveDecision()),
                            chunkDto.fusionScore(),
                            chunkDto.qualityScore()
                    );
                    analysisRepository.saveChunk(task.callId, chunk);
                }
            }


            // Broadcast ANALYSIS_UPDATE event to participants over WebSocket
            String eventJson = String.format(Locale.US,
                    "{\"type\":\"ANALYSIS_UPDATE\",\"callId\":\"%s\",\"participant\":\"%s\",\"userId\":\"%s\",\"chunkIndex\":%d,\"startSec\":%.1f,\"endSec\":%.1f,\"decision\":\"%s\",\"decisionStrength\":%.2f,\"conflictLevel\":\"%s\"}",
                    task.callId, task.participantRole, task.userId, task.chunkIndex, task.startSec, task.endSec,
                    decision.name(), strength != null ? strength : 0.0, conflict.name()
            );
            presenceService.broadcast(eventJson);

            log.info("AI analysis completed: callId={}, participant={}, chunkIndex={}, decision={}, strength={}",
                    task.callId, task.participantRole, task.chunkIndex, decision, strength);
        } catch (Exception e) {
            log.error("Error saving AI analysis result for callId={}: {}", task.callId, e.getMessage());
        }
    }

    private CallDecision parseDecision(String raw) {
        if (raw == null) return CallDecision.UNCERTAIN;
        try {
            return CallDecision.valueOf(raw.toUpperCase(Locale.US));
        } catch (IllegalArgumentException e) {
            return CallDecision.UNCERTAIN;
        }
    }

    private ConflictLevel parseConflictLevel(String raw) {
        if (raw == null) return ConflictLevel.LOW;
        try {
            return ConflictLevel.valueOf(raw.toUpperCase(Locale.US));
        } catch (IllegalArgumentException e) {
            return ConflictLevel.LOW;
        }
    }

    private void handleAnalysisFailure(AudioWindowTask task, Exception e) {
        log.warn("AI analysis dispatch failed for callId={}, participant={}: {}",
                task.callId, task.participantRole, e.getMessage());
        try {
            CallSession session = sessionService.getSessionOrThrow(task.callId);
            session.setLatestAnalysisStatus("AI_UNAVAILABLE");
            sessionService.save(session);
        } catch (Exception ignored) {}
    }

    /**
     * Flushes any remaining usable audio windows (>= 1.0s) and cleans up session buffers.
     */
    public void flushAndFinish(String callId) {
        log.info("Flushing audio buffers for callId={}", callId);

        List<AudioWindowTask> finalWindows = new ArrayList<>();
        flushBuffer(callerBuffers.remove(callId), finalWindows);
        flushBuffer(receiverBuffers.remove(callId), finalWindows);

        for (AudioWindowTask task : finalWindows) {
            dispatchWindowTask(task);
        }
    }

    private void flushBuffer(ParticipantAudioBuffer buffer, List<AudioWindowTask> outputList) {
        if (buffer == null) return;
        synchronized (buffer) {
            AudioWindowTask finalTask = buffer.extractFinalWindow();
            if (finalTask != null) {
                outputList.add(finalTask);
            }
        }
    }

    public int getPendingJobCount() {
        return pendingJobs.get();
    }

    /**
     * Tracks raw PCM16 audio bytes and window progression for one participant.
     */
    private static class ParticipantAudioBuffer {
        private final String callId;
        private final String participantRole;
        private final String userId;

        private final ByteArrayOutputStream stream = new ByteArrayOutputStream();
        private int chunkIndex = 0;
        private double startSec = 0.0;
        private long currentStartSequence = 0;
        private long currentEndSequence = 0;

        public ParticipantAudioBuffer(String callId, String participantRole, String userId) {
            this.callId = callId;
            this.participantRole = participantRole;
            this.userId = userId;
        }

        public void append(byte[] pcmBytes, long sequenceNumber) {
            try {
                if (stream.size() == 0) {
                    currentStartSequence = sequenceNumber;
                }
                currentEndSequence = sequenceNumber;
                stream.write(pcmBytes);
            } catch (IOException ignored) {}
        }

        public List<AudioWindowTask> extractReadyWindows() {
            List<AudioWindowTask> tasks = new ArrayList<>();
            byte[] allBytes = stream.toByteArray();

            while (allBytes.length >= WINDOW_BYTES) {
                // Extract 5.0 seconds (WINDOW_BYTES)
                byte[] windowBytes = Arrays.copyOfRange(allBytes, 0, WINDOW_BYTES);
                byte[] wav = WavUtils.createWav(windowBytes, SAMPLE_RATE, CHANNELS);

                tasks.add(new AudioWindowTask(
                        callId, participantRole, userId, chunkIndex++,
                        startSec, startSec + 5.0, currentStartSequence, currentEndSequence, wav
                ));

                // Advance hop (2.5 seconds = HOP_BYTES)
                startSec += 2.5;
                currentStartSequence = currentEndSequence;
                allBytes = Arrays.copyOfRange(allBytes, HOP_BYTES, allBytes.length);

                // Reset stream to remaining bytes
                stream.reset();
                try {
                    stream.write(allBytes);
                } catch (IOException ignored) {}
            }
            return tasks;
        }

        public AudioWindowTask extractFinalWindow() {
            byte[] remaining = stream.toByteArray();
            if (remaining.length >= MIN_FLUSH_BYTES) {
                double durationSec = (double) remaining.length / (SAMPLE_RATE * BYTES_PER_SAMPLE);
                byte[] wav = WavUtils.createWav(remaining, SAMPLE_RATE, CHANNELS);
                stream.reset();
                return new AudioWindowTask(
                        callId, participantRole, userId, chunkIndex++,
                        startSec, startSec + durationSec, currentStartSequence, currentEndSequence, wav
                );
            }
            stream.reset();
            return null;
        }
    }

    public static class AudioWindowTask {
        public final String callId;
        public final String participantRole;
        public final String userId;
        public final int chunkIndex;
        public final double startSec;
        public final double endSec;
        public final long startSequence;
        public final long endSequence;
        public final byte[] wavData;

        public AudioWindowTask(
                String callId, String participantRole, String userId, int chunkIndex,
                double startSec, double endSec, long startSequence, long endSequence, byte[] wavData
        ) {
            this.callId = callId;
            this.participantRole = participantRole;
            this.userId = userId;
            this.chunkIndex = chunkIndex;
            this.startSec = startSec;
            this.endSec = endSec;
            this.startSequence = startSequence;
            this.endSequence = endSequence;
            this.wavData = wavData;
        }
    }
}
