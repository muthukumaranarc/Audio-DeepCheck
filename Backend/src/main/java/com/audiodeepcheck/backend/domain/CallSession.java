package com.audiodeepcheck.backend.domain;

import com.audiodeepcheck.backend.exception.InvalidCallStateException;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * CallSession domain entity with explicit state-machine transitions.
 */
public class CallSession {

    private final String callId;
    private final String caller;
    private final String receiver;
    private final Instant createdAt;

    private CallStatus status;
    private Instant startedAt;
    private Instant endedAt;
    private Long durationSec;

    private String latestAnalysisStatus;
    private CallDecision latestDecision;
    private Double decisionStrength;
    private String confidenceStatus = "PROVISIONAL";
    private Double syntheticEvidenceScore;
    private ConflictLevel conflictLevel;
    private AudioQuality quality;
    private Integer lastProcessedSequence;
    private String endReason;
    private String failureReason;
    private String requestId;

    // Milestone 12: Two-User Simulation, Participant Identity, Sequencing & Backpressure
    private String callerUserId;
    private String receiverUserId;
    private String callerSessionId;
    private String receiverSessionId;
    private int callerLastSequence = -1;
    private int receiverLastSequence = -1;
    private boolean backpressureDetected = false;

    public CallSession(String callId, String caller, String receiver) {
        this(callId, caller, receiver, null);
    }

    public CallSession(String callId, String caller, String receiver, String requestId) {
        this.callId = Objects.requireNonNull(callId, "callId must not be null");
        this.caller = Objects.requireNonNull(caller, "caller must not be null");
        this.receiver = Objects.requireNonNull(receiver, "receiver must not be null");
        this.createdAt = Instant.now();
        this.status = CallStatus.CREATED;
        this.requestId = requestId;
        this.quality = AudioQuality.pristine();
    }

    /**
     * Transition call from CREATED to RINGING.
     */
    public synchronized void ring() {
        if (status != CallStatus.CREATED) {
            throw new InvalidCallStateException(
                    "Cannot ring call " + callId + " from state " + status + ". Expected CREATED.");
        }
        this.status = CallStatus.RINGING;
    }

    /**
     * Transition call from RINGING (or CREATED) to ACCEPTED.
     */
    public synchronized void accept() {
        // Idempotent: already accepted or active — no-op
        if (status == CallStatus.ACCEPTED || status == CallStatus.ACTIVE
                || status == CallStatus.CONNECTING_MEDIA) {
            return;
        }
        if (status != CallStatus.RINGING && status != CallStatus.CREATED) {
            throw new InvalidCallStateException(
                    "Cannot accept call " + callId + " from state " + status + ". Expected RINGING or CREATED.");
        }
        this.status = CallStatus.ACCEPTED;
    }

    /**
     * Transition call to CONNECTING_MEDIA.
     */
    public synchronized void connectMedia() {
        if (status != CallStatus.ACCEPTED && status != CallStatus.CONNECTING && status != CallStatus.CREATED) {
            throw new InvalidCallStateException(
                    "Cannot connect media for call " + callId + " from state " + status);
        }
        this.status = CallStatus.CONNECTING_MEDIA;
    }

    /**
     * Start the call, moving to ACTIVE.
     */
    public synchronized void start(Instant startedAt) {
        if (status != CallStatus.CREATED && status != CallStatus.CONNECTING 
                && status != CallStatus.RINGING && status != CallStatus.ACCEPTED 
                && status != CallStatus.CONNECTING_MEDIA) {
            throw new InvalidCallStateException(
                    "Cannot start call " + callId + " from state " + status);
        }
        this.status = CallStatus.ACTIVE;
        this.startedAt = startedAt != null ? startedAt : Instant.now();
    }

    /**
     * Transition call from CREATED/RINGING to REJECTED.
     */
    public synchronized void reject(String reason) {
        if (status.isTerminal()) {
            throw new InvalidCallStateException("Cannot reject call " + callId + " in terminal state " + status);
        }
        this.status = CallStatus.REJECTED;
        this.endReason = reason != null ? reason : "USER_REJECTED";
        if (this.endedAt == null) {
            this.endedAt = Instant.now();
        }
    }

    /**
     * Transition call to CANCELLED.
     */
    public synchronized void cancel(String reason) {
        if (status.isTerminal()) {
            throw new InvalidCallStateException("Cannot cancel call " + callId + " in terminal state " + status);
        }
        this.status = CallStatus.CANCELLED;
        this.endReason = reason != null ? reason : "USER_CANCELLED";
        if (this.endedAt == null) {
            this.endedAt = Instant.now();
        }
    }

    /**
     * Mark call as ENDING (stopping new media frames while flushing AI buffer).
     */
    public synchronized void markEnding() {
        if (status != CallStatus.ACTIVE && status != CallStatus.ANALYZING) {
            return;
        }
        this.status = CallStatus.ENDING;
    }

    /**
     * Mark that audio analysis is in progress.
     */
    public synchronized void beginAnalyzing() {
        if (status != CallStatus.ACTIVE && status != CallStatus.ANALYZING) {
            throw new InvalidCallStateException(
                    "Audio cannot be analyzed because call " + callId + " is in state: " + status + ". Call must be ACTIVE.");
        }
        this.status = CallStatus.ANALYZING;
        this.latestAnalysisStatus = "PROCESSING";
    }

    /**
     * Update call session with newly arrived AI analysis results.
     */
    public synchronized void recordAnalysisResult(
            CallDecision decision,
            Double strength,
            Double syntheticScore,
            ConflictLevel conflict,
            AudioQuality audioQuality,
            Integer sequenceNumber,
            String reqId
    ) {
        if (status.isTerminal()) {
            throw new InvalidCallStateException(
                    "Cannot record analysis for call " + callId + " in terminal state: " + status);
        }
        this.latestDecision = decision;
        this.decisionStrength = strength;
        this.syntheticEvidenceScore = syntheticScore;
        this.conflictLevel = conflict;
        if (audioQuality != null) {
            this.quality = audioQuality;
        }
        if (sequenceNumber != null) {
            this.lastProcessedSequence = sequenceNumber;
        }
        if (reqId != null) {
            this.requestId = reqId;
        }
        this.latestAnalysisStatus = "COMPLETED";
    }

    /**
     * End the call, transitioning from live states to ENDED.
     */
    public synchronized void end(Instant endedAt, String reason) {
        if (status.isTerminal()) {
            throw new InvalidCallStateException("Call " + callId + " has already terminated with state: " + status);
        }
        if (status == CallStatus.ENDED) {
            throw new InvalidCallStateException("Call " + callId + " is already in ENDED state.");
        }

        this.status = CallStatus.ENDED;
        this.endedAt = endedAt != null ? endedAt : Instant.now();
        this.endReason = reason != null ? reason : "USER_ENDED";

        if (this.startedAt != null) {
            this.durationSec = Math.max(0, Duration.between(this.startedAt, this.endedAt).toSeconds());
        } else {
            this.durationSec = 0L;
        }
    }

    /**
     * Complete the call session after all processing has finished.
     */
    public synchronized void complete() {
        if (status != CallStatus.ENDED && status != CallStatus.ENDING && status != CallStatus.ANALYZING && status != CallStatus.ACTIVE) {
            throw new InvalidCallStateException(
                    "Cannot complete call " + callId + " from state " + status + ". Call must be ENDED, ENDING or ACTIVE.");
        }
        if (this.endedAt == null) {
            this.endedAt = Instant.now();
            if (this.startedAt != null) {
                this.durationSec = Math.max(0, Duration.between(this.startedAt, this.endedAt).toSeconds());
            } else {
                this.durationSec = 0L;
            }
        }
        this.status = CallStatus.COMPLETED;
    }

    /**
     * Mark the call as failed due to a fatal operational error.
     */
    public synchronized void fail(String reason) {
        this.status = CallStatus.FAILED;
        this.failureReason = reason;
        this.endReason = reason;
        if (this.endedAt == null) {
            this.endedAt = Instant.now();
        }
    }

    /**
     * Mark call as AI_UNAVAILABLE when the AI service is unreachable during active analysis.
     */
    public synchronized void markAiUnavailable(String reason) {
        this.status = CallStatus.AI_UNAVAILABLE;
        this.failureReason = reason;
        this.latestAnalysisStatus = "AI_UNAVAILABLE";
        if (this.endedAt == null) {
            this.endedAt = Instant.now();
        }
    }

    // --- Getters & Setters ---

    public String getCallId() { return callId; }
    public String getCaller() { return caller; }
    public String getReceiver() { return receiver; }
    public Instant getCreatedAt() { return createdAt; }
    public CallStatus getStatus() { return status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public Long getDurationSec() {
        if (durationSec != null) return durationSec;
        if (startedAt != null) {
            Instant endPoint = endedAt != null ? endedAt : Instant.now();
            return Math.max(0, Duration.between(startedAt, endPoint).toSeconds());
        }
        return 0L;
    }
    public String getLatestAnalysisStatus() { return latestAnalysisStatus; }
    public CallDecision getLatestDecision() { return latestDecision; }
    public Double getDecisionStrength() { return decisionStrength; }
    public String getConfidenceStatus() { return confidenceStatus; }
    public Double getSyntheticEvidenceScore() { return syntheticEvidenceScore; }
    public ConflictLevel getConflictLevel() { return conflictLevel; }
    public AudioQuality getQuality() { return quality; }
    public Integer getLastProcessedSequence() { return lastProcessedSequence; }
    public String getEndReason() { return endReason; }
    public String getFailureReason() { return failureReason; }
    public String getRequestId() { return requestId; }

    public String getCallerUserId() { return callerUserId; }
    public void setCallerUserId(String callerUserId) { this.callerUserId = callerUserId; }

    public String getReceiverUserId() { return receiverUserId; }
    public void setReceiverUserId(String receiverUserId) { this.receiverUserId = receiverUserId; }

    public String getCallerSessionId() { return callerSessionId; }
    public void setCallerSessionId(String callerSessionId) { this.callerSessionId = callerSessionId; }

    public String getReceiverSessionId() { return receiverSessionId; }
    public void setReceiverSessionId(String receiverSessionId) { this.receiverSessionId = receiverSessionId; }

    public int getCallerLastSequence() { return callerLastSequence; }
    public void setCallerLastSequence(int callerLastSequence) { this.callerLastSequence = callerLastSequence; }

    public int getReceiverLastSequence() { return receiverLastSequence; }
    public void setReceiverLastSequence(int receiverLastSequence) { this.receiverLastSequence = receiverLastSequence; }

    public boolean isBackpressureDetected() { return backpressureDetected; }
    public void setBackpressureDetected(boolean backpressureDetected) { this.backpressureDetected = backpressureDetected; }

    public void setRequestId(String requestId) { this.requestId = requestId; }
    public void setLatestAnalysisStatus(String status) { this.latestAnalysisStatus = status; }
}
