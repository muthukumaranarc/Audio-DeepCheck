package com.audiodeepcheck.backend.exception;

public class AiServiceUnavailableException extends AiServiceException {
    public AiServiceUnavailableException(String message) {
        super(message);
    }

    public AiServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
