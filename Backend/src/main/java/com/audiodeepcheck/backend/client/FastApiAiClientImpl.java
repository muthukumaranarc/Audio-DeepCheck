package com.audiodeepcheck.backend.client;

import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.dto.fastapi.FastApiHealthDto;
import com.audiodeepcheck.backend.exception.AiServiceBusyException;
import com.audiodeepcheck.backend.exception.AiServiceUnavailableException;
import com.audiodeepcheck.backend.exception.AudioTooLargeException;
import com.audiodeepcheck.backend.exception.InvalidAudioException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * REST client for the internal Python FastAPI AI service.
 * <p>
 * TIMEOUT & RETRY POLICY:
 * AI inference across deep acoustic models (Wav2Vec2, DF Arena 500M, Whisper Tiny, etc.)
 * is computationally heavy on CPU (taking up to 45 seconds). Automatic blind retries
 * are explicitly avoided because re-submitting expensive requests duplicates inference
 * workloads on a concurrency-guarded (concurrency=1) queue and exacerbates queue exhaustion.
 */
@Component
public class FastApiAiClientImpl implements FastApiAiClient {

    private static final Logger log = LoggerFactory.getLogger(FastApiAiClientImpl.class);
    private static final String REQUEST_ID_HEADER = "X-Request-ID";

    private final RestClient restClient;

    public FastApiAiClientImpl(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public FastApiHealthDto checkHealth() {
        try {
            return restClient.get()
                    .uri("/api/v1/health")
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        throw new AiServiceUnavailableException("AI service health check failed with status: " + res.getStatusCode().value());
                    })
                    .body(FastApiHealthDto.class);
        } catch (ResourceAccessException e) {
            log.warn("AI service health probe unreachable: {}", e.getMessage());
            throw new AiServiceUnavailableException("AI service is unreachable: " + e.getMessage(), e);
        }
    }

    @Override
    public FastApiAnalyzeDto analyzeAudio(
            Resource audioResource,
            String filename,
            Double chunkSec,
            Double hopSec,
            String ablate,
            Boolean returnChunks,
            Boolean returnModules,
            String requestId
    ) {
        UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromPath("/api/v1/analyze");
        if (chunkSec != null) uriBuilder.queryParam("chunk_sec", chunkSec);
        if (hopSec != null) uriBuilder.queryParam("hop_sec", hopSec);
        if (ablate != null && !ablate.isBlank()) uriBuilder.queryParam("ablate", ablate);
        if (returnChunks != null) uriBuilder.queryParam("return_chunks", returnChunks);
        if (returnModules != null) uriBuilder.queryParam("return_modules", returnModules);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentDispositionFormData("file", filename != null ? filename : "audio.wav");
        body.add("file", new HttpEntity<>(audioResource, fileHeaders));

        try {
            RestClient.RequestHeadersSpec<?> requestSpec = restClient.post()
                    .uri(uriBuilder.toUriString())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body);

            if (requestId != null && !requestId.isBlank()) {
                requestSpec.header(REQUEST_ID_HEADER, requestId);
            }

            return requestSpec.retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        int status = res.getStatusCode().value();
                        String responseBody = readBody(res.getBody());
                        log.warn("FastAPI returned 4xx client error {}: {}", status, responseBody);

                        if (status == 413) {
                            throw new AudioTooLargeException("Audio file exceeds maximum allowed size (25 MB).");
                        } else if (status == 415) {
                            throw new InvalidAudioException("Unsupported audio format or corrupt media file.");
                        } else {
                            throw new InvalidAudioException("Audio analysis request invalid (HTTP " + status + "): " + responseBody);
                        }
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
                        int status = res.getStatusCode().value();
                        String responseBody = readBody(res.getBody());
                        log.error("FastAPI returned 5xx server error {}: {}", status, responseBody);

                        if (status == 503) {
                            throw new AiServiceBusyException("AI analysis service is currently busy. Queue is saturated.");
                        } else {
                            throw new AiServiceUnavailableException("AI analysis service encountered an internal error: HTTP " + status);
                        }
                    })
                    .body(FastApiAnalyzeDto.class);

        } catch (ResourceAccessException e) {
            log.error("AI service connection failed or timed out: {}", e.getMessage());
            throw new AiServiceUnavailableException("AI service connection timed out or is unavailable.", e);
        }
    }

    private String readBody(InputStream is) {
        if (is == null) return "";
        try {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }
}
