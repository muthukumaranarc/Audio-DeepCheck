package com.audiodeepcheck.backend.domain;

import java.time.Instant;

/**
 * Forensic analysis result for a specific temporal chunk of audio.
 */
public record AudioChunkAnalysis(
        int chunkIndex,
        double startSec,
        double endSec,
        CallDecision decision,
        double decisionStrength,
        double qualityScore,
        Instant timestamp
) {
    public AudioChunkAnalysis {
        if (timestamp == null) {
            timestamp = Instant.now();
        }
    }
}
