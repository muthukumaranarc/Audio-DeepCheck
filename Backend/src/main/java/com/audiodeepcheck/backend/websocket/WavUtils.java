package com.audiodeepcheck.backend.websocket;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Utility for encoding raw PCM16 audio bytes into standard 44-byte RIFF WAV format.
 */
public final class WavUtils {

    private WavUtils() {}

    public static byte[] createWav(byte[] pcm16Data, int sampleRate, int channels) {
        int audioLength = pcm16Data != null ? pcm16Data.length : 0;
        int totalDataLen = audioLength + 36;
        int byteRate = sampleRate * channels * 2;
        int blockAlign = channels * 2;

        ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        // RIFF header
        header.put((byte) 'R').put((byte) 'I').put((byte) 'F').put((byte) 'F');
        header.putInt(totalDataLen);
        header.put((byte) 'W').put((byte) 'A').put((byte) 'V').put((byte) 'E');

        // fmt subchunk
        header.put((byte) 'f').put((byte) 'm').put((byte) 't').put((byte) ' ');
        header.putInt(16); // SubChunk1Size (16 for PCM)
        header.putShort((short) 1); // AudioFormat (1 = PCM)
        header.putShort((short) channels);
        header.putInt(sampleRate);
        header.putInt(byteRate);
        header.putShort((short) blockAlign);
        header.putShort((short) 16); // BitsPerSample

        // data subchunk
        header.put((byte) 'd').put((byte) 'a').put((byte) 't').put((byte) 'a');
        header.putInt(audioLength);

        ByteArrayOutputStream baos = new ByteArrayOutputStream(44 + audioLength);
        try {
            baos.write(header.array());
            if (audioLength > 0) {
                baos.write(pcm16Data);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to construct WAV byte array", e);
        }
        return baos.toByteArray();
    }
}
