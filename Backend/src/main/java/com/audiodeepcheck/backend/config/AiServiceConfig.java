package com.audiodeepcheck.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class AiServiceConfig {

    @Value("${ai.service.base-url:http://localhost:8000}")
    private String baseUrl;

    @Value("${ai.service.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${ai.service.read-timeout-ms:180000}")
    private int readTimeoutMs;

    @Bean
    public RestClient aiServiceRestClient(RestClient.Builder builder) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(connectTimeoutMs))
                .build();

        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        return builder
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public String getBaseUrl() {
        return baseUrl;
    }
}
