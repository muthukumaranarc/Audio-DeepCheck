package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.CallStatus;
import java.time.Instant;

public record StartCallResponse(
        String callId,
        CallStatus status,
        Instant startedAt
) {}
