package com.audiodeepcheck.backend.dto;

public record AudioUploadResponse(
        String callId,
        Integer sequenceNumber,
        Boolean received,
        String analysisStatus
) {}
