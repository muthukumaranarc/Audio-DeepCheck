package com.audiodeepcheck.backend.dto;

import java.time.Instant;

public record ErrorResponse(
        Instant timestamp,
        int status,
        String code,
        String message,
        String path,
        String requestId
) {
    public static ErrorResponse of(int status, String code, String message, String path, String requestId) {
        return new ErrorResponse(Instant.now(), status, code, message, path, requestId);
    }
}
