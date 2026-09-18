package com.audiodeepcheck.backend.controller;

import com.audiodeepcheck.backend.dto.HealthResponse;
import com.audiodeepcheck.backend.service.BackendHealthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BackendHealthService healthService;

    @Test
    @DisplayName("GET /api/v1/health returns composite system health")
    void testGetHealth() throws Exception {
        HealthResponse response = new HealthResponse(
                "UP",
                "audio-deepcheck-backend",
                Instant.now(),
                Map.of("backend", "UP", "database", "UP", "aiService", "UP")
        );

        when(healthService.getHealth()).thenReturn(response);

        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("audio-deepcheck-backend"))
                .andExpect(jsonPath("$.components.backend").value("UP"))
                .andExpect(jsonPath("$.components.aiService").value("UP"))
                .andExpect(jsonPath("$.components.database").value("UP"));
    }
}
