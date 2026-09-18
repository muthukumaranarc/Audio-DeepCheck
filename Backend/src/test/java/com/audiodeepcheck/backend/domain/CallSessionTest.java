package com.audiodeepcheck.backend.domain;

import com.audiodeepcheck.backend.exception.InvalidCallStateException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CallSessionTest {

    private CallSession session;

    @BeforeEach
    void setUp() {
        session = new CallSession("CALL-1001", "Alice", "Bob", "req-test-1");
    }

    @Test
    @DisplayName("Initial call session is in CREATED state")
    void testInitialStateIsCreated() {
        assertThat(session.getCallId()).isEqualTo("CALL-1001");
        assertThat(session.getCaller()).isEqualTo("Alice");
        assertThat(session.getReceiver()).isEqualTo("Bob");
        assertThat(session.getStatus()).isEqualTo(CallStatus.CREATED);
        assertThat(session.getCreatedAt()).isNotNull();
        assertThat(session.getStartedAt()).isNull();
        assertThat(session.getEndedAt()).isNull();
        assertThat(session.getStatus().isLive()).isTrue();
        assertThat(session.getStatus().isTerminal()).isFalse();
    }

    @Test
    @DisplayName("Transition CREATED -> ACTIVE via start()")
    void testStartFromCreated() {
        Instant startTime = Instant.now();
        session.start(startTime);

        assertThat(session.getStatus()).isEqualTo(CallStatus.ACTIVE);
        assertThat(session.getStartedAt()).isEqualTo(startTime);
    }

    @Test
    @DisplayName("Illegal transition to ACTIVE throws InvalidCallStateException")
    void testStartFromInvalidStateThrows() {
        session.end(Instant.now(), "USER_ENDED");

        assertThatThrownBy(() -> session.start(Instant.now()))
                .isInstanceOf(InvalidCallStateException.class)
                .hasMessageContaining("Cannot start call");
    }

    @Test
    @DisplayName("Transition ACTIVE -> ANALYZING via beginAnalyzing()")
    void testBeginAnalyzingFromActive() {
        session.start(Instant.now());
        session.beginAnalyzing();

        assertThat(session.getStatus()).isEqualTo(CallStatus.ANALYZING);
        assertThat(session.getLatestAnalysisStatus()).isEqualTo("PROCESSING");
    }

    @Test
    @DisplayName("Illegal beginAnalyzing from CREATED throws InvalidCallStateException")
    void testBeginAnalyzingFromCreatedThrows() {
        assertThatThrownBy(() -> session.beginAnalyzing())
                .isInstanceOf(InvalidCallStateException.class)
                .hasMessageContaining("Call must be ACTIVE");
    }

    @Test
    @DisplayName("Recording analysis result updates metrics and status")
    void testRecordAnalysisResult() {
        session.start(Instant.now());
        session.beginAnalyzing();

        AudioQuality quality = new AudioQuality(0.92, true, 28.5, List.of());
        session.recordAnalysisResult(
                CallDecision.AI_GENERATED,
                0.4121,
                0.8115,
                ConflictLevel.MEDIUM,
                quality,
                1,
                "req-test-2"
        );

        assertThat(session.getLatestDecision()).isEqualTo(CallDecision.AI_GENERATED);
        assertThat(session.getDecisionStrength()).isEqualTo(0.4121);
        assertThat(session.getSyntheticEvidenceScore()).isEqualTo(0.8115);
        assertThat(session.getConflictLevel()).isEqualTo(ConflictLevel.MEDIUM);
        assertThat(session.getQuality().score()).isEqualTo(0.92);
        assertThat(session.getLastProcessedSequence()).isEqualTo(1);
        assertThat(session.getLatestAnalysisStatus()).isEqualTo("COMPLETED");
        assertThat(session.getRequestId()).isEqualTo("req-test-2");
    }

    @Test
    @DisplayName("Recording analysis in terminal state throws InvalidCallStateException")
    void testRecordAnalysisResultInTerminalStateThrows() {
        session.start(Instant.now());
        session.end(Instant.now(), "USER_ENDED");
        session.complete();

        assertThatThrownBy(() -> session.recordAnalysisResult(
                CallDecision.HUMAN, 0.5, 0.1, ConflictLevel.LOW, AudioQuality.pristine(), 1, "req-test"
        )).isInstanceOf(InvalidCallStateException.class)
                .hasMessageContaining("terminal state");
    }

    @Test
    @DisplayName("Transition ACTIVE -> ENDED -> COMPLETED")
    void testEndAndComplete() {
        Instant start = Instant.now().minusSeconds(120);
        session.start(start);
        Instant end = Instant.now();
        session.end(end, "USER_HANGUP");

        assertThat(session.getStatus()).isEqualTo(CallStatus.ENDED);
        assertThat(session.getDurationSec()).isGreaterThanOrEqualTo(120L);
        assertThat(session.getEndReason()).isEqualTo("USER_HANGUP");

        session.complete();
        assertThat(session.getStatus()).isEqualTo(CallStatus.COMPLETED);
        assertThat(session.getStatus().isTerminal()).isTrue();
    }

    @Test
    @DisplayName("Ending an already ended call throws InvalidCallStateException")
    void testEndAlreadyEndedThrows() {
        session.start(Instant.now());
        session.end(Instant.now(), "USER_ENDED");

        assertThatThrownBy(() -> session.end(Instant.now(), "ANOTHER_REASON"))
                .isInstanceOf(InvalidCallStateException.class);
    }

    @Test
    @DisplayName("Failing a call marks status FAILED")
    void testFailCall() {
        session.start(Instant.now());
        session.fail("Corrupt audio stream");

        assertThat(session.getStatus()).isEqualTo(CallStatus.FAILED);
        assertThat(session.getFailureReason()).isEqualTo("Corrupt audio stream");
        assertThat(session.getStatus().isTerminal()).isTrue();
    }

    @Test
    @DisplayName("Marking AI unavailable transitions status to AI_UNAVAILABLE")
    void testMarkAiUnavailable() {
        session.start(Instant.now());
        session.beginAnalyzing();
        session.markAiUnavailable("FastAPI service connection refused");

        assertThat(session.getStatus()).isEqualTo(CallStatus.AI_UNAVAILABLE);
        assertThat(session.getLatestAnalysisStatus()).isEqualTo("AI_UNAVAILABLE");
        assertThat(session.getStatus().isTerminal()).isTrue();
    }
}
