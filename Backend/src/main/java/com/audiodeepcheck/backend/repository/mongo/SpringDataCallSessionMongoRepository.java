package com.audiodeepcheck.backend.repository.mongo;

import com.audiodeepcheck.backend.domain.CallStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SpringDataCallSessionMongoRepository extends MongoRepository<CallSessionDocument, String> {
    Optional<CallSessionDocument> findByCallId(String callId);
    List<CallSessionDocument> findByStatusInOrderByCreatedAtDesc(List<CallStatus> statuses);
    boolean existsByCallId(String callId);
    void deleteByCallId(String callId);
}
