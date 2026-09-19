package com.audiodeepcheck.backend.controller;

import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.service.CallSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Hidden developer control panel endpoints.
 * NOT linked from any frontend navigation.
 * Access via direct URL: /api/v1/developer/*
 *
 * ⚠️  For development/testing only – do NOT expose in production.
 */
@RestController
@RequestMapping("/api/v1/developer")
@CrossOrigin(origins = "*")
public class DeveloperController {

    private final CallSessionService callSessionService;

    public DeveloperController(CallSessionService callSessionService) {
        this.callSessionService = callSessionService;
    }

    // ── GET /api/v1/developer/stats ────────────────────────────────────────────
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = callSessionService.getStats();
        stats.put("endpoint", "developer-stats");
        return ResponseEntity.ok(stats);
    }

    // ── DELETE /api/v1/developer/reset ────────────────────────────────────────
    /** Purge ALL call sessions and analysis data; reset ID counter to 1000. */
    @DeleteMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetAll() {
        callSessionService.clearAllData();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("action", "RESET_ALL");
        resp.put("message", "All call sessions and analysis data have been purged. ID sequence reset to 1000.");
        resp.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(resp);
    }

    // ── DELETE /api/v1/developer/calls/{callId} ────────────────────────────────
    /** Delete a single call session by callId. */
    @DeleteMapping("/calls/{callId}")
    public ResponseEntity<Map<String, Object>> deleteCall(@PathVariable String callId) {
        boolean deleted = callSessionService.deleteCall(callId);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", deleted);
        resp.put("callId", callId);
        resp.put("action", "DELETE_CALL");
        resp.put("message", deleted ? "Call " + callId + " deleted successfully."
                                    : "Call " + callId + " not found.");
        resp.put("timestamp", Instant.now().toString());
        return deleted ? ResponseEntity.ok(resp) : ResponseEntity.status(404).body(resp);
    }

    // ── POST /api/v1/developer/seed ───────────────────────────────────────────
    /** Seed a demo call so the UI has data to display immediately after a reset. */
    @PostMapping("/seed")
    public ResponseEntity<Map<String, Object>> seedDemo() {
        CallSession demo = callSessionService.seedDemoCall();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("action", "SEED_DEMO");
        resp.put("callId", demo.getCallId());
        resp.put("caller", demo.getCaller());
        resp.put("receiver", demo.getReceiver());
        resp.put("message", "Demo call " + demo.getCallId() + " created successfully.");
        resp.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(resp);
    }
}
