package com.audiodeepcheck.backend.exception;

public class AudioTooLargeException extends RuntimeException {
    public AudioTooLargeException(String message) {
        super(message);
    }
}
