package com.audiodeepcheck.backend.controller;

import com.audiodeepcheck.backend.dto.HealthResponse;
import com.audiodeepcheck.backend.service.BackendHealthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    private final BackendHealthService healthService;

    public HealthController(BackendHealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> getHealth() {
        return ResponseEntity.ok(healthService.getHealth());
    }
}
