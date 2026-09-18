package com.audiodeepcheck.backend.exception;

public class InvalidCallStateException extends RuntimeException {
    public InvalidCallStateException(String message) {
        super(message);
    }
}
