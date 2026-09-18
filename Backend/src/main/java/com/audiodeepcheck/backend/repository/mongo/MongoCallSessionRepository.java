package com.audiodeepcheck.backend.repository.mongo;

import com.audiodeepcheck.backend.domain.CallDecision;
import com.audiodeepcheck.backend.domain.CallSession;
import com.audiodeepcheck.backend.domain.CallStatus;
import com.audiodeepcheck.backend.repository.CallSessionRepository;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Primary
@Repository
public class MongoCallSessionRepository implements CallSessionRepository {

    private final SpringDataCallSessionMongoRepository springDataRepo;
    private final MongoTemplate mongoTemplate;

    public MongoCallSessionRepository(
            SpringDataCallSessionMongoRepository springDataRepo,
            MongoTemplate mongoTemplate
    ) {
        this.springDataRepo = springDataRepo;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public CallSession save(CallSession callSession) {
        CallSessionDocument doc = CallSessionDocument.fromDomain(callSession);
        CallSessionDocument saved = springDataRepo.save(doc);
        return saved.toDomain();
    }

    @Override
    public Optional<CallSession> findById(String callId) {
        return springDataRepo.findByCallId(callId).map(CallSessionDocument::toDomain);
    }

    @Override
    public List<CallSession> findAll() {
        return springDataRepo.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(CallSessionDocument::toDomain)
                .toList();
    }

    @Override
    public List<CallSession> findByStatusIn(List<CallStatus> statuses) {
        return springDataRepo.findByStatusInOrderByCreatedAtDesc(statuses)
                .stream()
                .map(CallSessionDocument::toDomain)
                .toList();
    }

    @Override
    public List<CallSession> findFiltered(CallStatus status, CallDecision decision, int page, int size) {
        Query query = buildFilteredQuery(status, decision);
        query.with(Sort.by(Sort.Direction.DESC, "createdAt"));
        query.skip((long) page * size).limit(size);

        return mongoTemplate.find(query, CallSessionDocument.class)
                .stream()
                .map(CallSessionDocument::toDomain)
                .toList();
    }

    @Override
    public long countFiltered(CallStatus status, CallDecision decision) {
        Query query = buildFilteredQuery(status, decision);
        return mongoTemplate.count(query, CallSessionDocument.class);
    }

    @Override
    public boolean existsById(String callId) {
        return springDataRepo.existsByCallId(callId);
    }

    @Override
    public long count() {
        return springDataRepo.count();
    }

    @Override
    public void deleteById(String callId) {
        springDataRepo.deleteByCallId(callId);
    }

    @Override
    public void clear() {
        springDataRepo.deleteAll();
    }

    private Query buildFilteredQuery(CallStatus status, CallDecision decision) {
        Query query = new Query();
        if (status != null) {
            query.addCriteria(Criteria.where("status").is(status));
        }
        if (decision != null) {
            query.addCriteria(Criteria.where("latestDecision").is(decision));
        }
        return query;
    }
}
