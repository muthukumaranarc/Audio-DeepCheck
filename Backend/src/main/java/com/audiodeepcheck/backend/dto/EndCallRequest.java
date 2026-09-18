package com.audiodeepcheck.backend.dto;

import java.time.Instant;

public record EndCallRequest(
        Instant endedAt,
        String reason
) {}
