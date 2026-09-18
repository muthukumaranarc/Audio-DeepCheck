package com.audiodeepcheck.backend.repository.mongo;

import com.audiodeepcheck.backend.domain.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.lang.reflect.Field;
import java.time.Instant;

/**
 * MongoDB document representation for a voice call session.
 */
@Document(collection = "call_sessions")
@CompoundIndex(name = "status_decision_created_idx", def = "{'status': 1, 'latestDecision': 1, 'createdAt': -1}")
public class CallSessionDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String callId;

    @Indexed
    private String caller;

    @Indexed
    private String receiver;

    @Indexed
    private CallStatus status;

    @Indexed
    private Instant createdAt;

    private Instant startedAt;
    private Instant endedAt;
    private Long durationSec;

    private String latestAnalysisStatus;

    @Indexed
    private CallDecision latestDecision;

    private Double decisionStrength;
    private String confidenceStatus;
    private Double syntheticEvidenceScore;
    private ConflictLevel conflictLevel;
    private AudioQuality quality;
    private Integer lastProcessedSequence;
    private String endReason;
    private String failureReason;
    private String requestId;

    public CallSessionDocument() {}

    public CallSessionDocument(String callId, String caller, String receiver) {
        this.id = callId;
        this.callId = callId;
        this.caller = caller;
        this.receiver = receiver;
        this.status = CallStatus.CREATED;
        this.createdAt = Instant.now();
    }

    public static CallSessionDocument fromDomain(CallSession session) {
        CallSessionDocument doc = new CallSessionDocument();
        doc.id = session.getCallId();
        doc.callId = session.getCallId();
        doc.caller = session.getCaller();
        doc.receiver = session.getReceiver();
        doc.status = session.getStatus();
        doc.createdAt = session.getCreatedAt();
        doc.startedAt = session.getStartedAt();
        doc.endedAt = session.getEndedAt();
        doc.durationSec = session.getDurationSec();
        doc.latestAnalysisStatus = session.getLatestAnalysisStatus();
        doc.latestDecision = session.getLatestDecision();
        doc.decisionStrength = session.getDecisionStrength();
        doc.confidenceStatus = session.getConfidenceStatus();
        doc.syntheticEvidenceScore = session.getSyntheticEvidenceScore();
        doc.conflictLevel = session.getConflictLevel();
        doc.quality = session.getQuality();
        doc.lastProcessedSequence = session.getLastProcessedSequence();
        doc.endReason = session.getEndReason();
        doc.failureReason = session.getFailureReason();
        doc.requestId = session.getRequestId();
        return doc;
    }

    public CallSession toDomain() {
        CallSession session = new CallSession(callId, caller, receiver, requestId);
        setField(session, "createdAt", createdAt);
        setField(session, "status", status);
        setField(session, "startedAt", startedAt);
        setField(session, "endedAt", endedAt);
        setField(session, "durationSec", durationSec);
        setField(session, "latestAnalysisStatus", latestAnalysisStatus);
        setField(session, "latestDecision", latestDecision);
        setField(session, "decisionStrength", decisionStrength);
        setField(session, "confidenceStatus", confidenceStatus);
        setField(session, "syntheticEvidenceScore", syntheticEvidenceScore);
        setField(session, "conflictLevel", conflictLevel);
        setField(session, "quality", quality);
        setField(session, "lastProcessedSequence", lastProcessedSequence);
        setField(session, "endReason", endReason);
        setField(session, "failureReason", failureReason);
        return session;
    }

    private static void setField(Object target, String fieldName, Object value) {
        if (value == null) return;
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            // fallback
        }
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCallId() { return callId; }
    public void setCallId(String callId) { this.callId = callId; }
    public String getCaller() { return caller; }
    public void setCaller(String caller) { this.caller = caller; }
    public String getReceiver() { return receiver; }
    public void setReceiver(String receiver) { this.receiver = receiver; }
    public CallStatus getStatus() { return status; }
    public void setStatus(CallStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
    public Long getDurationSec() { return durationSec; }
    public void setDurationSec(Long durationSec) { this.durationSec = durationSec; }
    public String getLatestAnalysisStatus() { return latestAnalysisStatus; }
    public void setLatestAnalysisStatus(String latestAnalysisStatus) { this.latestAnalysisStatus = latestAnalysisStatus; }
    public CallDecision getLatestDecision() { return latestDecision; }
    public void setLatestDecision(CallDecision latestDecision) { this.latestDecision = latestDecision; }
    public Double getDecisionStrength() { return decisionStrength; }
    public void setDecisionStrength(Double decisionStrength) { this.decisionStrength = decisionStrength; }
    public String getConfidenceStatus() { return confidenceStatus; }
    public void setConfidenceStatus(String confidenceStatus) { this.confidenceStatus = confidenceStatus; }
    public Double getSyntheticEvidenceScore() { return syntheticEvidenceScore; }
    public void setSyntheticEvidenceScore(Double syntheticEvidenceScore) { this.syntheticEvidenceScore = syntheticEvidenceScore; }
    public ConflictLevel getConflictLevel() { return conflictLevel; }
    public void setConflictLevel(ConflictLevel conflictLevel) { this.conflictLevel = conflictLevel; }
    public AudioQuality getQuality() { return quality; }
    public void setQuality(AudioQuality quality) { this.quality = quality; }
    public Integer getLastProcessedSequence() { return lastProcessedSequence; }
    public void setLastProcessedSequence(Integer lastProcessedSequence) { this.lastProcessedSequence = lastProcessedSequence; }
    public String getEndReason() { return endReason; }
    public void setEndReason(String endReason) { this.endReason = endReason; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
}
