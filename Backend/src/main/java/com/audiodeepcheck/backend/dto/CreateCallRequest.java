package com.audiodeepcheck.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.Instant;

public record CreateCallRequest(
        @NotBlank(message = "caller is required") String caller,
        @NotBlank(message = "receiver is required") String receiver
) {}
