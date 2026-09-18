package com.audiodeepcheck.backend.dto.fastapi;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record FastApiHealthDto(
        String status,
        String version,
        String device,
        @JsonProperty("active_detectors") List<String> activeDetectors,
        @JsonProperty("concurrency_limit") Integer concurrencyLimit,
        String timestamp
) {}
