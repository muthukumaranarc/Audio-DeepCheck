package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.domain.ConflictLevel;

public record AnalysisStatusResponse(
        String callId,
        CallStatus status,
        CallDecision latestDecision,
        Double decisionStrength,
        String confidenceStatus,
        Double qualityScore,
        ConflictLevel conflictLevel,
        Integer lastProcessedSequence
) {}
