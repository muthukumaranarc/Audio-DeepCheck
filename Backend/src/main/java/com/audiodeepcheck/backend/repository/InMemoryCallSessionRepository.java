package com.audiodeepcheck.backend.repository;

import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Repository
public class InMemoryCallSessionRepository implements CallSessionRepository {

    private final ConcurrentMap<String, CallSession> store = new ConcurrentHashMap<>();

    @Override
    public CallSession save(CallSession callSession) {
        store.put(callSession.getCallId(), callSession);
        return callSession;
    }

    @Override
    public Optional<CallSession> findById(String callId) {
        return Optional.ofNullable(store.get(callId));
    }

    @Override
    public List<CallSession> findAll() {
        return store.values().stream()
                .sorted(Comparator.comparing(CallSession::getCreatedAt).reversed())
                .toList();
    }

    @Override
    public List<CallSession> findByStatusIn(List<CallStatus> statuses) {
        return store.values().stream()
                .filter(session -> statuses.contains(session.getStatus()))
                .sorted(Comparator.comparing(CallSession::getCreatedAt).reversed())
                .toList();
    }

    @Override
    public List<CallSession> findFiltered(CallStatus status, CallDecision decision, int page, int size) {
        return store.values().stream()
                .filter(session -> status == null || session.getStatus() == status)
                .filter(session -> decision == null || session.getLatestDecision() == decision)
                .sorted(Comparator.comparing(CallSession::getCreatedAt).reversed())
                .skip((long) page * size)
                .limit(size)
                .toList();
    }

    @Override
    public long countFiltered(CallStatus status, CallDecision decision) {
        return store.values().stream()
                .filter(session -> status == null || session.getStatus() == status)
                .filter(session -> decision == null || session.getLatestDecision() == decision)
                .count();
    }

    @Override
    public boolean existsById(String callId) {
        return store.containsKey(callId);
    }

    @Override
    public long count() {
        return store.size();
    }

    @Override
    public void deleteById(String callId) {
        store.remove(callId);
    }

    @Override
    public void clear() {
        store.clear();
    }
}
