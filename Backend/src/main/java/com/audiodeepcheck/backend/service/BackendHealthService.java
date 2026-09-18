package com.audiodeepcheck.backend.service;

import com.audiodeepcheck.backend.client.FastApiAiClient;
import com.audiodeepcheck.backend.dto.HealthResponse;
import com.audiodeepcheck.backend.dto.fastapi.FastApiHealthDto;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class BackendHealthService {

    private static final Logger log = LoggerFactory.getLogger(BackendHealthService.class);

    private final FastApiAiClient aiClient;
    private final MongoTemplate mongoTemplate;

    public BackendHealthService(FastApiAiClient aiClient, MongoTemplate mongoTemplate) {
        this.aiClient = aiClient;
        this.mongoTemplate = mongoTemplate;
    }

    public HealthResponse getHealth() {
        Map<String, String> components = new LinkedHashMap<>();
        components.put("backend", "UP");

        String dbStatus = "DOWN";
        try {
            if (mongoTemplate != null) {
                mongoTemplate.executeCommand(new Document("ping", 1));
                dbStatus = "UP";
            }
        } catch (Exception e) {
            log.warn("Database health probe failed: {}", e.getMessage());
            dbStatus = "DOWN";
        }
        components.put("database", dbStatus);

        String aiStatus = "DOWN";
        try {
            FastApiHealthDto aiHealth = aiClient.checkHealth();
            if (aiHealth != null && "healthy".equalsIgnoreCase(aiHealth.status())) {
                aiStatus = "UP";
            }
        } catch (Exception e) {
            log.warn("FastAPI health probe failed: {}", e.getMessage());
            aiStatus = "DOWN";
        }
        components.put("aiService", aiStatus);

        String overallStatus;
        if ("UP".equals(aiStatus) && "UP".equals(dbStatus)) {
            overallStatus = "UP";
        } else if ("DOWN".equals(aiStatus) && "DOWN".equals(dbStatus)) {
            overallStatus = "DOWN";
        } else {
            overallStatus = "DEGRADED";
        }

        return new HealthResponse(
                overallStatus,
                "audio-deepcheck-backend",
                Instant.now(),
                components
        );
    }
}
