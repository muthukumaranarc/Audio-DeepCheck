package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.ConflictLevel;
import java.util.List;

public record EvidenceResponse(
        String callId,
        List<ModuleItem> modules,
        ConflictLevel conflictLevel
) {
    public record ModuleItem(
            String module,
            String status,
            String direction,
            Double contribution
    ) {}
}
