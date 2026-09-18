package com.audiodeepcheck.backend.dto;

import java.util.List;

public record ActiveCallsResponse(
        List<CallSummaryResponse> calls
) {}
