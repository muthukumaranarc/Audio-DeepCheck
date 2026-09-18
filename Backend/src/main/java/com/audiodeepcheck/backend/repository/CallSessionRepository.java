package com.audiodeepcheck.backend.repository;

import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;

import java.util.List;
import java.util.Optional;

public interface CallSessionRepository {
    CallSession save(CallSession callSession);
    Optional<CallSession> findById(String callId);
    List<CallSession> findAll();
    List<CallSession> findByStatusIn(List<CallStatus> statuses);
    List<CallSession> findFiltered(CallStatus status, CallDecision decision, int page, int size);
    long countFiltered(CallStatus status, CallDecision decision);
    boolean existsById(String callId);
    long count();
    void deleteById(String callId);
    void clear();
}
