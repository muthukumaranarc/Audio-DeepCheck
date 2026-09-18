package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.AudioQuality;
import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallStatus;

import java.time.Instant;

public record CallResponse(
        String callId,
        String caller,
        String receiver,
        CallStatus status,
        Instant startedAt,
        Instant endedAt,
        Long durationSec,
        CallDecision decision,
        Double decisionStrength,
        String confidenceStatus,
        AudioQuality quality,
        String requestId
) {}
