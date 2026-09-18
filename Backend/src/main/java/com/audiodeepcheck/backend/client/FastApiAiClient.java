package com.audiodeepcheck.backend.client;

import com.audiodeepcheck.backend.dto.fastapi.FastApiAnalyzeDto;
import com.audiodeepcheck.backend.dto.fastapi.FastApiHealthDto;
import org.springframework.core.io.Resource;

public interface FastApiAiClient {

    /**
     * Fast non-blocking health probe to FastAPI service.
     */
    FastApiHealthDto checkHealth();

    /**
     * Multipart audio upload and forensic analysis request.
     */
    FastApiAnalyzeDto analyzeAudio(
            Resource audioResource,
            String filename,
            Double chunkSec,
            Double hopSec,
            String ablate,
            Boolean returnChunks,
            Boolean returnModules,
            String requestId
    );
}
