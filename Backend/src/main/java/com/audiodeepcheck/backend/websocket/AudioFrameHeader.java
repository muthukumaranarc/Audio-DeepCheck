package com.audiodeepcheck.backend.websocket;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

/**
 * Binary protocol header for Audio DeepCheck live audio frames.
 * Frame Layout:
 * - Bytes 0-1: Magic bytes (0xAD 0x01)
 * - Byte 2: Frame Type (0x01 = AUDIO, 0x02 = HEARTBEAT)
 * - Byte 3: Participant Role (0x01 = CALLER, 0x02 = RECEIVER)
 * - Bytes 4-7: Sequence Number (uint32 big-endian)
 * - Bytes 8-15: Timestamp Ms (int64 big-endian)
 * - Bytes 16-17: Duration Ms (uint16 big-endian)
 * - Bytes 18-19: Sample Rate (uint16 big-endian, 16000)
 * - Byte 20: Channels (uint8, 1)
 * - Byte 21: Encoding (uint8, 1 = PCM16)
 * - Byte 22: User ID Length (uint8)
 * - Bytes 23..(22+L_u): User ID ASCII
 * - Byte 23+L_u: Call ID Length (uint8)
 * - Bytes 24+L_u..(23+L_u+L_c): Call ID ASCII
 * - Remainder: Raw PCM16 audio bytes
 */
public class AudioFrameHeader {

    public static final short MAGIC = (short) 0xAD01;
    public static final byte TYPE_AUDIO = 0x01;
    public static final byte TYPE_HEARTBEAT = 0x02;

    public static final byte ROLE_CALLER = 0x01;
    public static final byte ROLE_RECEIVER = 0x02;

    public static final byte ENCODING_PCM16 = 0x01;

    private final byte frameType;
    private final byte participantRole;
    private final long sequenceNumber;
    private final long timestampMs;
    private final int durationMs;
    private final int sampleRate;
    private final int channels;
    private final byte encoding;
    private final String userId;
    private final String callId;

    public AudioFrameHeader(
            byte frameType,
            byte participantRole,
            long sequenceNumber,
            long timestampMs,
            int durationMs,
            int sampleRate,
            int channels,
            byte encoding,
            String userId,
            String callId
    ) {
        this.frameType = frameType;
        this.participantRole = participantRole;
        this.sequenceNumber = sequenceNumber;
        this.timestampMs = timestampMs;
        this.durationMs = durationMs;
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.encoding = encoding;
        this.userId = Objects.requireNonNull(userId, "userId must not be null");
        this.callId = Objects.requireNonNull(callId, "callId must not be null");
    }

    public static AudioFrame decode(ByteBuffer buffer) {
        buffer.order(ByteOrder.BIG_ENDIAN);
        if (buffer.remaining() < 24) {
            throw new IllegalArgumentException("Buffer too short for AudioFrameHeader (minimum 24 bytes)");
        }

        short magic = buffer.getShort();
        if (magic != MAGIC) {
            throw new IllegalArgumentException(String.format("Invalid magic bytes: 0x%04X. Expected 0x%04X", magic, MAGIC));
        }

        byte frameType = buffer.get();
        byte participantRole = buffer.get();
        long sequenceNumber = Integer.toUnsignedLong(buffer.getInt());
        long timestampMs = buffer.getLong();
        int durationMs = Short.toUnsignedInt(buffer.getShort());
        int sampleRate = Short.toUnsignedInt(buffer.getShort());
        int channels = Byte.toUnsignedInt(buffer.get());
        byte encoding = buffer.get();

        int userIdLen = Byte.toUnsignedInt(buffer.get());
        if (buffer.remaining() < userIdLen + 1) {
            throw new IllegalArgumentException("Truncated buffer while reading userId");
        }
        byte[] userIdBytes = new byte[userIdLen];
        buffer.get(userIdBytes);
        String userId = new String(userIdBytes, StandardCharsets.US_ASCII);

        int callIdLen = Byte.toUnsignedInt(buffer.get());
        if (buffer.remaining() < callIdLen) {
            throw new IllegalArgumentException("Truncated buffer while reading callId");
        }
        byte[] callIdBytes = new byte[callIdLen];
        buffer.get(callIdBytes);
        String callId = new String(callIdBytes, StandardCharsets.US_ASCII);

        byte[] audioData = new byte[buffer.remaining()];
        buffer.get(audioData);

        AudioFrameHeader header = new AudioFrameHeader(
                frameType, participantRole, sequenceNumber, timestampMs,
                durationMs, sampleRate, channels, encoding, userId, callId
        );
        return new AudioFrame(header, audioData);
    }

    public static byte[] encode(AudioFrameHeader header, byte[] audioData) {
        byte[] userBytes = header.getUserId().getBytes(StandardCharsets.US_ASCII);
        byte[] callBytes = header.getCallId().getBytes(StandardCharsets.US_ASCII);
        int audioLen = audioData != null ? audioData.length : 0;
        int totalLen = 2 + 1 + 1 + 4 + 8 + 2 + 2 + 1 + 1 + 1 + userBytes.length + 1 + callBytes.length + audioLen;

        ByteBuffer buffer = ByteBuffer.allocate(totalLen).order(ByteOrder.BIG_ENDIAN);
        buffer.putShort(MAGIC);
        buffer.put(header.getFrameType());
        buffer.put(header.getParticipantRole());
        buffer.putInt((int) header.getSequenceNumber());
        buffer.putLong(header.getTimestampMs());
        buffer.putShort((short) header.getDurationMs());
        buffer.putShort((short) header.getSampleRate());
        buffer.put((byte) header.getChannels());
        buffer.put(header.getEncoding());

        buffer.put((byte) userBytes.length);
        buffer.put(userBytes);
        buffer.put((byte) callBytes.length);
        buffer.put(callBytes);

        if (audioData != null && audioData.length > 0) {
            buffer.put(audioData);
        }
        return buffer.array();
    }

    public byte getFrameType() { return frameType; }
    public byte getParticipantRole() { return participantRole; }
    public String getParticipantRoleString() {
        return participantRole == ROLE_CALLER ? "CALLER" : "RECEIVER";
    }
    public long getSequenceNumber() { return sequenceNumber; }
    public long getTimestampMs() { return timestampMs; }
    public int getDurationMs() { return durationMs; }
    public int getSampleRate() { return sampleRate; }
    public int getChannels() { return channels; }
    public byte getEncoding() { return encoding; }
    public String getUserId() { return userId; }
    public String getCallId() { return callId; }
}
