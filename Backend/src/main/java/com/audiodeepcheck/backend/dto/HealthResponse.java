package com.audiodeepcheck.backend.dto;

import java.time.Instant;
import java.util.Map;

public record HealthResponse(
        String status,
        String service,
        Instant timestamp,
        Map<String, String> components
) {}
