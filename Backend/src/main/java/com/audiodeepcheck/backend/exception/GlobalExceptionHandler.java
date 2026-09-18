package com.audiodeepcheck.backend.exception;

import com.audiodeepcheck.backend.config.RequestIdFilter;
import com.audiodeepcheck.backend.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(CallNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleCallNotFound(CallNotFoundException ex, HttpServletRequest request) {
        log.warn("Call not found: {}", ex.getMessage());
        return buildResponse(HttpStatus.NOT_FOUND, "CALL_NOT_FOUND", ex.getMessage(), request);
    }

    @ExceptionHandler(InvalidCallStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCallState(InvalidCallStateException ex, HttpServletRequest request) {
        log.warn("Invalid call state: {}", ex.getMessage());
        return buildResponse(HttpStatus.BAD_REQUEST, "INVALID_CALL_STATE", ex.getMessage(), request);
    }

    @ExceptionHandler(InvalidAudioException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAudio(InvalidAudioException ex, HttpServletRequest request) {
        log.warn("Invalid audio request: {}", ex.getMessage());
        return buildResponse(HttpStatus.BAD_REQUEST, "INVALID_AUDIO", ex.getMessage(), request);
    }

    @ExceptionHandler(AudioTooLargeException.class)
    public ResponseEntity<ErrorResponse> handleAudioTooLarge(AudioTooLargeException ex, HttpServletRequest request) {
        log.warn("Audio too large: {}", ex.getMessage());
        return buildResponse(HttpStatus.PAYLOAD_TOO_LARGE, "AUDIO_TOO_LARGE", ex.getMessage(), request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        log.warn("Upload size exceeded: {}", ex.getMessage());
        return buildResponse(HttpStatus.PAYLOAD_TOO_LARGE, "AUDIO_TOO_LARGE",
                "Uploaded audio file exceeds the maximum allowable limit (25 MB).", request);
    }

    @ExceptionHandler(AiServiceBusyException.class)
    public ResponseEntity<ErrorResponse> handleAiBusy(AiServiceBusyException ex, HttpServletRequest request) {
        log.warn("AI service busy: {}", ex.getMessage());
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, "AI_SERVICE_BUSY", ex.getMessage(), request);
    }

    @ExceptionHandler(AiServiceUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleAiUnavailable(AiServiceUnavailableException ex, HttpServletRequest request) {
        log.error("AI service unavailable: {}", ex.getMessage());
        return buildResponse(HttpStatus.SERVICE_UNAVAILABLE, "AI_SERVICE_UNAVAILABLE",
                "The audio analysis AI service is currently unavailable. Please check service health.", request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        log.warn("Validation error on request: {}", details);
        return buildResponse(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", details, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception processing request {}: ", request.getRequestURI(), ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR",
                "An internal error occurred while processing the request.", request);
    }

    private ResponseEntity<ErrorResponse> buildResponse(
            HttpStatus status,
            String code,
            String message,
            HttpServletRequest request
    ) {
        String requestId = RequestIdFilter.getCurrentRequestId();
        ErrorResponse body = new ErrorResponse(
                Instant.now(),
                status.value(),
                code,
                message,
                request.getRequestURI(),
                requestId
        );
        return ResponseEntity.status(status).body(body);
    }
}
