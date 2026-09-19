package com.audiodeepcheck.backend.websocket;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class AudioFrameHeaderTest {

    @Test
    @DisplayName("Should encode and decode AudioFrameHeader with payload accurately")
    void shouldEncodeAndDecodeFrame() {
        AudioFrameHeader header = new AudioFrameHeader(
                AudioFrameHeader.TYPE_AUDIO,
                AudioFrameHeader.ROLE_CALLER,
                153L,
                1700000000000L,
                128,
                16000,
                1,
                AudioFrameHeader.ENCODING_PCM16,
                "USER-A",
                "CALL-1001"
        );

        byte[] fakePcm = new byte[4096];
        for (int i = 0; i < fakePcm.length; i++) {
            fakePcm[i] = (byte) (i % 127);
        }

        byte[] encoded = AudioFrameHeader.encode(header, fakePcm);
        assertNotNull(encoded);
        assertTrue(encoded.length > 4096);

        AudioFrame decoded = AudioFrameHeader.decode(ByteBuffer.wrap(encoded));
        assertNotNull(decoded);

        AudioFrameHeader decodedHeader = decoded.getHeader();
        assertEquals(AudioFrameHeader.TYPE_AUDIO, decodedHeader.getFrameType());
        assertEquals(AudioFrameHeader.ROLE_CALLER, decodedHeader.getParticipantRole());
        assertEquals("CALLER", decodedHeader.getParticipantRoleString());
        assertEquals(153L, decodedHeader.getSequenceNumber());
        assertEquals(1700000000000L, decodedHeader.getTimestampMs());
        assertEquals(128, decodedHeader.getDurationMs());
        assertEquals(16000, decodedHeader.getSampleRate());
        assertEquals(1, decodedHeader.getChannels());
        assertEquals(AudioFrameHeader.ENCODING_PCM16, decodedHeader.getEncoding());
        assertEquals("USER-A", decodedHeader.getUserId());
        assertEquals("CALL-1001", decodedHeader.getCallId());

        assertArrayEquals(fakePcm, decoded.getAudioData());
    }

    @Test
    @DisplayName("Should reject frame with invalid magic bytes")
    void shouldRejectInvalidMagic() {
        ByteBuffer buffer = ByteBuffer.allocate(35);
        buffer.putShort((short) 0x1234); // Invalid magic
        buffer.put(new byte[33]);
        buffer.flip();

        assertThrows(IllegalArgumentException.class, () -> AudioFrameHeader.decode(buffer));
    }

    @Test
    @DisplayName("Should reject buffer with insufficient length")
    void shouldRejectShortBuffer() {
        ByteBuffer buffer = ByteBuffer.allocate(10);
        buffer.putShort(AudioFrameHeader.MAGIC);
        buffer.flip();

        assertThrows(IllegalArgumentException.class, () -> AudioFrameHeader.decode(buffer));
    }

    @Test
    @DisplayName("Should produce valid 44-byte RIFF WAV file via WavUtils")
    void shouldProduceValidWav() {
        byte[] pcmData = new byte[32000]; // 1.0 second at 16kHz mono 16-bit
        byte[] wav = WavUtils.createWav(pcmData, 16000, 1);

        assertEquals(32044, wav.length);
        assertEquals('R', (char) wav[0]);
        assertEquals('I', (char) wav[1]);
        assertEquals('F', (char) wav[2]);
        assertEquals('F', (char) wav[3]);
        assertEquals('W', (char) wav[8]);
        assertEquals('A', (char) wav[9]);
        assertEquals('V', (char) wav[10]);
        assertEquals('E', (char) wav[11]);
    }
}
