package com.audiodeepcheck.backend.domain;

/**
 * Lifecycle states of a voice call session.
 */
public enum CallStatus {
    CREATED,
    RINGING,
    ACCEPTED,
    CONNECTING,
    CONNECTING_MEDIA,
    ACTIVE,
    ANALYZING,
    ENDING,
    ENDED,
    COMPLETED,
    REJECTED,
    CANCELLED,
    MISSED,
    BUSY,
    FAILED,
    INTERRUPTED,
    DISCONNECTED,
    AI_UNAVAILABLE;

    /**
     * Checks whether the state is terminal (no further state progression expected).
     */
    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == INTERRUPTED || this == AI_UNAVAILABLE
                || this == REJECTED || this == CANCELLED || this == MISSED || this == BUSY;
    }

    /**
     * Checks whether the call session is in an active or evaluating state.
     */
    public boolean isLive() {
        return this == CREATED || this == RINGING || this == ACCEPTED || this == CONNECTING 
                || this == CONNECTING_MEDIA || this == ACTIVE || this == ANALYZING || this == ENDING || this == ENDED;
    }

    /**
     * Checks whether media/audio streaming is valid in this state.
     */
    public boolean isMediaActive() {
        return this == ACTIVE || this == ANALYZING || this == ENDING;
    }
}
