package com.audiodeepcheck.backend.repository.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SpringDataAnalysisMongoRepository extends MongoRepository<AnalysisResultDocument, String> {
    Optional<AnalysisResultDocument> findByCallId(String callId);
}
