package com.audiodeepcheck.backend.dto;

import java.util.List;

public record PagedCallsResponse(
        List<CallSummaryResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
