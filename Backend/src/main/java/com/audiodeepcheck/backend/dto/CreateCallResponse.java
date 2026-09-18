package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.CallStatus;
import java.time.Instant;

public record CreateCallResponse(
        String callId,
        CallStatus status,
        String caller,
        String receiver,
        Instant createdAt
) {}
