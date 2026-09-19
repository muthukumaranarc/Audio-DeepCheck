package com.audiodeepcheck.backend.websocket;

import java.util.Objects;

/**
 * Encapsulates a decoded binary audio frame (header metadata + raw PCM16 payload).
 */
public class AudioFrame {

    private final AudioFrameHeader header;
    private final byte[] audioData;

    public AudioFrame(AudioFrameHeader header, byte[] audioData) {
        this.header = Objects.requireNonNull(header, "header must not be null");
        this.audioData = audioData != null ? audioData : new byte[0];
    }

    public AudioFrameHeader getHeader() {
        return header;
    }

    public byte[] getAudioData() {
        return audioData;
    }

    public int getPayloadLength() {
        return audioData.length;
    }

    public byte[] toBytes() {
        return AudioFrameHeader.encode(header, audioData);
    }
}
