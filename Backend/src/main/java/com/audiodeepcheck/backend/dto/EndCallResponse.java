package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.CallStatus;
import java.time.Instant;

public record EndCallResponse(
        String callId,
        CallStatus status,
        Instant endedAt
) {}
