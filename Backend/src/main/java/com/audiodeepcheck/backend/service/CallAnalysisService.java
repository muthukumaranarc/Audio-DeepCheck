package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.config.RequestIdFilter;
import com.audiodeepcheck.backend.domain.*;
import com.audiodeepcheck.backend.dto.AudioUploadResponse;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.exception.AiServiceException;
import com.audiodeepcheck.backend.exception.AiServiceUnavailableException;
import com.audiodeepcheck.backend.exception.InvalidAudioException;
import com.audiodeepcheck.backend.repository.AnalysisRepository;
import com.audiodeepcheck.backend.repository.CallSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class CallAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(CallAnalysisService.class);

    private final CallSessionService sessionService;
    private final CallSessionRepository sessionRepository;
    private final AnalysisRepository analysisRepository;
    private final FastApiAiClient aiClient;

    public CallAnalysisService(
            CallSessionService sessionService,
            CallSessionRepository sessionRepository,
            AnalysisRepository analysisRepository,
            FastApiAiClient aiClient
    ) {
        this.sessionService = sessionService;
        this.sessionRepository = sessionRepository;
        this.analysisRepository = analysisRepository;
        this.aiClient = aiClient;
    }

    /**
     * Ingests and processes an audio chunk/recording for an active call session.
     */
    public AudioUploadResponse analyzeCallAudio(
            String callId,
            MultipartFile file,
            Integer sequenceNumber,
            Double chunkSec,
            Double hopSec,
            String ablate
    ) {
        if (file == null || file.isEmpty()) {
            throw new InvalidAudioException("Uploaded audio file is empty or missing.");
        }

        CallSession session = sessionService.getSessionOrThrow(callId);

        // State validation & transition to ANALYZING
        session.beginAnalyzing();
        sessionRepository.save(session);

        String requestId = RequestIdFilter.getCurrentRequestId();
        log.info("Dispatching audio analysis for callId={}, seq={}, reqId={}", callId, sequenceNumber, requestId);

        FastApiAnalyzeDto aiResponse;
        try {
            Resource resource = file.getResource();
            aiResponse = aiClient.analyzeAudio(
                    resource,
                    file.getOriginalFilename(),
                    chunkSec,
                    hopSec,
                    ablate,
                    true,
                    true,
                    requestId
            );
        } catch (AiServiceUnavailableException e) {
            log.error("AI service unreachable during call {}: {}", callId, e.getMessage());
            session.markAiUnavailable(e.getMessage());
            sessionRepository.save(session);
            throw e;
        } catch (Exception e) {
            log.error("Audio analysis failed for call {}: {}", callId, e.getMessage());
            session.fail(e.getMessage());
            sessionRepository.save(session);
            throw e;
        }

        // Map AI result onto domain models
        CallDecision decision = parseDecision(aiResponse.masterDecision());
        ConflictLevel conflict = parseConflictLevel(aiResponse.conflictLevel());

        AudioQuality quality = null;
        if (aiResponse.quality() != null) {
            quality = new AudioQuality(
                    aiResponse.quality().qualityScore(),
                    aiResponse.quality().usable(),
                    aiResponse.quality().snrDb(),
                    aiResponse.quality().flags()
            );
        }

        // Record on session
        session.recordAnalysisResult(
                decision,
                aiResponse.decisionStrength(),
                aiResponse.syntheticEvidenceScore(),
                conflict,
                quality,
                sequenceNumber,
                requestId
        );
        sessionRepository.save(session);

        // Store raw response
        analysisRepository.saveFastApiResponse(callId, aiResponse);

        // Map and store chunk timeline
        if (aiResponse.chunkDetails() != null && !aiResponse.chunkDetails().isEmpty()) {
            List<AudioChunkAnalysis> chunkList = new ArrayList<>();
            for (FastApiAnalyzeDto.ChunkDetailDto cd : aiResponse.chunkDetails()) {
                chunkList.add(new AudioChunkAnalysis(
                        cd.chunkIndex() != null ? cd.chunkIndex() : 0,
                        cd.startSec() != null ? cd.startSec() : 0.0,
                        cd.endSec() != null ? cd.endSec() : 0.0,
                        parseDecision(cd.effectiveDecision()),
                        cd.fusionScore() != null ? cd.fusionScore() : 0.0,
                        cd.qualityScore() != null ? cd.qualityScore() : 1.0,
                        Instant.now()
                ));
            }
            analysisRepository.saveChunks(callId, chunkList);
        }

        // Map and store module evidence
        if (aiResponse.modules() != null && !aiResponse.modules().isEmpty()) {
            List<ModuleEvidence> evidenceList = new ArrayList<>();
            aiResponse.modules().forEach((key, mod) -> {
                String direction = "NEUTRAL";
                if (mod.syntheticScore() != null) {
                    direction = mod.syntheticScore() >= 0.5 ? "SYNTHETIC" : "HUMAN";
                }
                evidenceList.add(new ModuleEvidence(
                        mod.module() != null ? mod.module() : key,
                        mod.status() != null ? mod.status() : "USED",
                        direction,
                        mod.effectiveWeight() != null ? mod.effectiveWeight() : 0.0,
                        mod.metadata()
                ));
            });
            analysisRepository.saveEvidence(callId, evidenceList, conflict);
        }

        log.info("Analysis completed for callId={}, decision={}, strength={}",
                callId, decision, aiResponse.decisionStrength());

        return new AudioUploadResponse(
                callId,
                sequenceNumber != null ? sequenceNumber : 1,
                true,
                "COMPLETED"
        );
    }

    private CallDecision parseDecision(String decisionStr) {
        if (decisionStr == null) return CallDecision.UNCERTAIN;
        return switch (decisionStr.toUpperCase()) {
            case "HUMAN" -> CallDecision.HUMAN;
            case "AI_GENERATED", "AI", "SYNTHETIC" -> CallDecision.AI_GENERATED;
            default -> CallDecision.UNCERTAIN;
        };
    }

    private ConflictLevel parseConflictLevel(String conflictStr) {
        if (conflictStr == null) return ConflictLevel.LOW;
        return switch (conflictStr.toUpperCase()) {
            case "HIGH" -> ConflictLevel.HIGH;
            case "MEDIUM" -> ConflictLevel.MEDIUM;
            default -> ConflictLevel.LOW;
        };
    }
}
