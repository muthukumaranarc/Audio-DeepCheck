package com.audiodeepcheck.backend.dto;

import com.audiodeepcheck.backend.domain.CallDecision;
import java.util.List;

public record ChunksTimelineResponse(
        String callId,
        List<ChunkItem> chunks
) {
    public record ChunkItem(
            int chunkIndex,
            double startSec,
            double endSec,
            CallDecision decision,
            double decisionStrength,
            double qualityScore
    ) {}
}
