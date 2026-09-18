package com.audiodeepcheck.backend.domain;

import java.util.Map;

/**
 * Specialist evidence item contributed by an AI detection module.
 */
public record ModuleEvidence(
        String module,
        String status,
        String direction,
        Double contribution,
        Map<String, Object> metadata
) {}
