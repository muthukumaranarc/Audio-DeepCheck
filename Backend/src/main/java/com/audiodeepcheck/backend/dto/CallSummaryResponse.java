package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallStatus;

import java.time.Instant;

public record CallSummaryResponse(
        String callId,
        String caller,
        String receiver,
        CallStatus status,
        Long durationSec,
        CallDecision latestDecision,
        Instant createdAt
) {}
