package com.audiodeepcheck.backend.controller;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.config.RequestIdFilter;
import com.audiodeepcheck.backend.dto.AudioVerificationResponse;
import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.exception.InvalidAudioException;
import com.audiodeepcheck.backend.service.AudioConversionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Dedicated controller for standalone audio file verification (MP3 / WAV / WAR).
 * Automatically converts MP3 audio into standardized 16kHz mono WAV format
 * prior to dispatching to AI neural network models, and returns comprehensive
 * forensic AI vs Human verification results.
 */
@RestController
@RequestMapping({"/api/v1/audio", "/audio", "/api/audio"})
public class AudioVerificationController {

    private static final Logger log = LoggerFactory.getLogger(AudioVerificationController.class);

    private final AudioConversionService conversionService;
    private final FastApiAiClient aiClient;

    public AudioVerificationController(AudioConversionService conversionService, FastApiAiClient aiClient) {
        this.conversionService = conversionService;
        this.aiClient = aiClient;
    }

    /**
     * Upload an audio file (.mp3, .wav, .war, .ogg, .flac) to verify whether
     * it is AI-generated (Deepfake / Synthetic) or Genuine Human speech.
     * MP3 files are automatically converted to 16kHz mono WAV format before inference.
     */
    @PostMapping(value = {"/verify", "/analyze"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AudioVerificationResponse> verifyAudio(
            @RequestParam(value = "file", required = false) MultipartFile filePart,
            @RequestParam(value = "audio", required = false) MultipartFile audioPart,
            @RequestParam(value = "chunkSec", required = false) Double chunkSec,
            @RequestParam(value = "hopSec", required = false) Double hopSec,
            @RequestParam(value = "ablate", required = false) String ablate
    ) {
        MultipartFile upload = filePart != null ? filePart : audioPart;
        if (upload == null || upload.isEmpty()) {
            throw new InvalidAudioException("Missing audio file. Please upload an .mp3, .wav, or .war audio file.");
        }

        String originalFilename = upload.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "audio_recording.wav";
        }

        String ext = getFileExtension(originalFilename).toLowerCase(Locale.ROOT);
        if (!ext.equals(".mp3") && !ext.equals(".wav") && !ext.equals(".war") && !ext.equals(".flac") && !ext.equals(".ogg")) {
            throw new InvalidAudioException("Unsupported audio format: " + ext + ". Allowed formats are .mp3, .wav, .war, .ogg, .flac");
        }

        String reqId = RequestIdFilter.getCurrentRequestId();
        log.info("Received audio verification request for file='{}', size={} bytes, reqId={}",
                originalFilename, upload.getSize(), reqId);

        try {
            // 1. Convert MP3 to WAV (16kHz mono) if necessary
            AudioConversionService.ConvertedAudioResult prepResult = conversionService.prepareAudioForInference(upload);

            // 2. Dispatch converted audio to AI models (Wav2Vec2, DF Arena, Spectrogram, Prosody, Whisper)
            FastApiAnalyzeDto aiResponse = aiClient.analyzeAudio(
                    prepResult.resource(),
                    prepResult.filename(),
                    chunkSec,
                    hopSec,
                    ablate,
                    true,
                    true,
                    reqId
            );

            // 3. Assemble clean verification response
            AudioVerificationResponse response = buildVerificationResponse(originalFilename, prepResult, aiResponse);
            log.info("Audio verification complete for '{}': Decision={}, Strength={}",
                    originalFilename, response.decision(), response.decisionStrength());

            return ResponseEntity.ok(response);
        } catch (InvalidAudioException | com.audiodeepcheck.backend.exception.AiServiceUnavailableException
                | com.audiodeepcheck.backend.exception.AiServiceBusyException
                | com.audiodeepcheck.backend.exception.AudioTooLargeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to verify audio file '{}': {}", originalFilename, e.getMessage(), e);
            throw new RuntimeException("Audio verification failed: " + e.getMessage(), e);
        }
    }

    private AudioVerificationResponse buildVerificationResponse(
            String originalFilename,
            AudioConversionService.ConvertedAudioResult prepResult,
            FastApiAnalyzeDto ai
    ) {
        String rawDecision = ai.getEffectiveDecision();
        String decision = switch (rawDecision.toUpperCase(Locale.ROOT)) {
            case "AI_GENERATED", "AI_VOICE", "FAKE", "SPOOF" -> "AI_GENERATED";
            case "HUMAN", "AUTHENTIC", "REAL", "BONAFIDE" -> "HUMAN";
            default -> "UNCERTAIN";
        };

        Double strength = ai.decisionStrength() != null ? ai.decisionStrength() : 0.0;
        String confidenceStatus = ai.confidenceStatus() != null ? ai.confidenceStatus() : "PROVISIONAL";
        Double synthScore = ai.getEffectiveSyntheticScore();
        Double humanScore = ai.getEffectiveHumanScore();
        String conflictLevel = ai.getEffectiveConflictLevel();

        Double durationSec = 0.0;
        if (ai.processingMetadata() != null && ai.processingMetadata().durationSec() != null) {
            durationSec = ai.processingMetadata().durationSec();
        } else if (ai.quality() != null && ai.quality().metrics() != null
                   && ai.quality().metrics().durationSec() != null) {
            durationSec = ai.quality().metrics().durationSec();
        }

        AudioVerificationResponse.QualityReportDto qualityDto = null;
        if (ai.quality() != null) {
            qualityDto = new AudioVerificationResponse.QualityReportDto(
                    ai.quality().qualityScore(),
                    ai.quality().usable(),
                    ai.quality().snrDb(),
                    ai.quality().flags()
            );
        }

        List<AudioVerificationResponse.ModuleResultDto> moduleDtos = new ArrayList<>();
        for (var m : ai.getEffectiveModuleList()) {
            Double contrib = (m.normalizedScore() != null && m.effectiveWeight() != null)
                    ? m.normalizedScore() * m.effectiveWeight()
                    : 0.0;
            moduleDtos.add(new AudioVerificationResponse.ModuleResultDto(
                    m.module(),
                    m.evidenceType(),
                    m.syntheticScore(),
                    m.normalizedScore(),
                    m.effectiveWeight(),
                    contrib,
                    m.status(),
                    m.reason()
            ));
        }

        List<AudioVerificationResponse.ChunkResultDto> chunkDtos = new ArrayList<>();
        for (var c : ai.getEffectiveChunkDetails()) {
            chunkDtos.add(new AudioVerificationResponse.ChunkResultDto(
                    c.chunkIndex(),
                    c.startSec(),
                    c.endSec(),
                    c.fusionScore(),
                    c.qualityScore(),
                    c.conflictLevel() != null ? c.conflictLevel() : conflictLevel
            ));
        }

        return new AudioVerificationResponse(
                originalFilename,
                prepResult.filename(),
                prepResult.originalFormat(),
                prepResult.wasConverted(),
                decision,
                strength,
                confidenceStatus,
                synthScore,
                humanScore,
                conflictLevel,
                durationSec,
                qualityDto,
                moduleDtos,
                chunkDtos
        );
    }

    private String getFileExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot != -1) ? filename.substring(dot) : "";
    }
}
