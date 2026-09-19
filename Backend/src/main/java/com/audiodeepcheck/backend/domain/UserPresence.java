package com.audiodeepcheck.backend.domain;

import java.time.Instant;

/**
 * User Presence representation in the mobile call simulation.
 */
public class UserPresence {

    public enum Status {
        ONLINE,
        OFFLINE,
        BUSY,
        IN_CALL
    }

    private final String userId;
    private final String phoneNumber;
    private final String displayName;
    private Status status;
    private Instant lastHeartbeat;
    private String currentCallId;

    public UserPresence(String userId, String phoneNumber, String displayName) {
        this.userId = userId;
        this.phoneNumber = phoneNumber;
        this.displayName = displayName;
        this.status = Status.OFFLINE;
        this.lastHeartbeat = Instant.now();
    }

    public String getUserId() { return userId; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getDisplayName() { return displayName; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getLastHeartbeat() { return lastHeartbeat; }
    public void setLastHeartbeat(Instant lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }
    public String getCurrentCallId() { return currentCallId; }
    public void setCurrentCallId(String currentCallId) { this.currentCallId = currentCallId; }
}
