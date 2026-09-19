package com.audiodeepcheck.backend.controller;

import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.dto.*;
import com.audiodeepcheck.backend.exception.InvalidAudioException;
import com.audiodeepcheck.backend.service.CallAnalysisService;
import com.audiodeepcheck.backend.service.CallSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/v1/calls", "/calls", "/api/calls"})
public class CallController {

    private final CallSessionService sessionService;
    private final CallAnalysisService analysisService;

    public CallController(CallSessionService sessionService, CallAnalysisService analysisService) {
        this.sessionService = sessionService;
        this.analysisService = analysisService;
    }

    /**
     * Create a new simulated call session.
     */
    @PostMapping
    public ResponseEntity<CreateCallResponse> createCall(@Valid @RequestBody CreateCallRequest request) {
        CreateCallResponse response = sessionService.createCall(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Start the call session.
     */
    @PostMapping("/{callId}/start")
    public ResponseEntity<StartCallResponse> startCall(@PathVariable String callId) {
        return ResponseEntity.ok(sessionService.startCall(callId));
    }

    /**
     * Retrieve complete details for a call session.
     */
    @GetMapping("/{callId}")
    public ResponseEntity<CallResponse> getCall(@PathVariable String callId) {
        return ResponseEntity.ok(sessionService.getCall(callId));
    }

    /**
     * Retrieve currently active or analyzing call sessions.
     */
    @GetMapping("/active")
    public ResponseEntity<ActiveCallsResponse> getActiveCalls() {
        return ResponseEntity.ok(sessionService.getActiveCalls());
    }

    /**
     * Retrieve historical calls with filtering and pagination.
     */
    @GetMapping
    public ResponseEntity<PagedCallsResponse> getCalls(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) CallStatus status,
            @RequestParam(required = false) CallDecision decision
    ) {
        return ResponseEntity.ok(sessionService.getCalls(page, size, status, decision));
    }

    /**
     * Ingest and analyze an audio chunk or file for a live call session.
     * Supports either 'audio' or 'file' form field parameter.
     */
    @PostMapping(value = "/{callId}/audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AudioUploadResponse> submitAudio(
            @PathVariable String callId,
            @RequestParam(value = "audio", required = false) MultipartFile audioPart,
            @RequestParam(value = "file", required = false) MultipartFile filePart,
            @RequestParam(value = "sequenceNumber", required = false) Integer sequenceNumber,
            @RequestParam(value = "chunkSec", required = false) Double chunkSec,
            @RequestParam(value = "hopSec", required = false) Double hopSec,
            @RequestParam(value = "ablate", required = false) String ablate
    ) {
        MultipartFile upload = audioPart != null ? audioPart : filePart;
        if (upload == null || upload.isEmpty()) {
            throw new InvalidAudioException("Missing audio file part (expected 'audio' or 'file').");
        }

        AudioUploadResponse response = analysisService.analyzeCallAudio(
                callId,
                upload,
                sequenceNumber,
                chunkSec,
                hopSec,
                ablate
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve the latest analysis status for a call.
     */
    @GetMapping("/{callId}/analysis")
    public ResponseEntity<AnalysisStatusResponse> getAnalysisStatus(@PathVariable String callId) {
        return ResponseEntity.ok(sessionService.getAnalysisStatus(callId));
    }

    /**
     * Terminate an active call session.
     */
    @PostMapping("/{callId}/end")
    public ResponseEntity<EndCallResponse> endCall(
            @PathVariable String callId,
            @RequestBody(required = false) EndCallRequest request
    ) {
        return ResponseEntity.ok(sessionService.endCall(callId, request));
    }

    /**
     * Retrieve module-level evidence breakdown for a call session.
     */
    @GetMapping("/{callId}/evidence")
    public ResponseEntity<EvidenceResponse> getEvidence(@PathVariable String callId) {
        return ResponseEntity.ok(sessionService.getEvidence(callId));
    }

    /**
     * Retrieve chunk analysis timeline for a call session.
     */
    @GetMapping("/{callId}/chunks")
    public ResponseEntity<ChunksTimelineResponse> getChunks(@PathVariable String callId) {
        return ResponseEntity.ok(sessionService.getChunks(callId));
    }

    /**
     * Retrieve the comprehensive post-call audit report.
     */
    @GetMapping("/{callId}/report")
    public ResponseEntity<CallReportResponse> getReport(@PathVariable String callId) {
        return ResponseEntity.ok(sessionService.getReport(callId));
    }
}
