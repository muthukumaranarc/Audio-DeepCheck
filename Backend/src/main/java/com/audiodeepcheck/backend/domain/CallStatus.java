package com.audiodeepcheck.backend.domain;

/**
 * Lifecycle states of a voice call session.
 */
public enum CallStatus {
    CREATED,
    CONNECTING,
    ACTIVE,
    ANALYZING,
    ENDED,
    COMPLETED,
    FAILED,
    INTERRUPTED,
    AI_UNAVAILABLE;

    /**
     * Checks whether the state is terminal (no further state progression expected).
     */
    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == INTERRUPTED || this == AI_UNAVAILABLE;
    }

    /**
     * Checks whether the call session is in an active or evaluating state.
     */
    public boolean isLive() {
        return this == CREATED || this == CONNECTING || this == ACTIVE || this == ANALYZING || this == ENDED;
    }
}
