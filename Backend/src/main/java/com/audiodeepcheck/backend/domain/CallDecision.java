package com.audiodeepcheck.backend.domain;

/**
 * High-level forensic classification decision for audio analysis.
 */
public enum CallDecision {
    HUMAN,
    AI_GENERATED,
    UNCERTAIN
}
