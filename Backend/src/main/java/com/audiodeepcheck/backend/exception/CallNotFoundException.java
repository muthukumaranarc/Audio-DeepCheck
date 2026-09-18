package com.audiodeepcheck.backend.exception;

public class CallNotFoundException extends RuntimeException {
    public CallNotFoundException(String callId) {
        super("Call session not found: " + callId);
    }
}
