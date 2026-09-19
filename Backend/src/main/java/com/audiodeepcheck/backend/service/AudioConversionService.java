package com.audiodeepcheck.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;

/**
 * Audio format normalization and conversion service.
 * Converts MP3 audio into standardized 16kHz 16-bit PCM mono WAV format
 * prior to dispatching to AI neural network models.
 */
@Service
public class AudioConversionService {

    private static final Logger log = LoggerFactory.getLogger(AudioConversionService.class);

    @Value("${audiodeepcheck.python.path:}")
    private String customPythonPath;

    public record ConvertedAudioResult(
            Resource resource,
            String filename,
            boolean wasConverted,
            String originalFormat,
            long sizeBytes
    ) {}

    /**
     * Inspects input audio file. If MP3, converts it to 16kHz mono WAV.
     * If WAV/WAR, normalizes extension and prepares for inference.
     */
    public ConvertedAudioResult prepareAudioForInference(MultipartFile file) throws IOException {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "uploaded_audio.wav";
        }

        String ext = getFileExtension(originalFilename).toLowerCase(Locale.ROOT);
        boolean isMp3 = ext.equals(".mp3");
        boolean isWar = ext.equals(".war");
        boolean isWav = ext.equals(".wav");

        String originalFormat = isMp3 ? "MP3" : (isWar ? "WAR" : (isWav ? "WAV" : ext.replace(".", "").toUpperCase(Locale.ROOT)));

        if (!isMp3) {
            // Already a WAV or WAR file — normalize filename to .wav for neural models
            String normalizedName = originalFilename.replaceAll("(?i)\\.war$", ".wav");
            byte[] bytes = file.getBytes();
            ByteArrayResource resource = new ByteArrayResource(bytes) {
                @Override
                public String getFilename() {
                    return normalizedName;
                }
            };
            return new ConvertedAudioResult(resource, normalizedName, false, originalFormat, bytes.length);
        }

        // MP3 conversion required -> convert to 16kHz mono WAV
        log.info("Converting uploaded MP3 file '{}' to 16kHz mono WAV before inference", originalFilename);
        Path tempDir = Files.createTempDirectory("adc_audio_conv_");
        Path tempInputMp3 = tempDir.resolve("input.mp3");
        Path tempOutputWav = tempDir.resolve("converted_16k.wav");

        try {
            file.transferTo(tempInputMp3.toFile());

            boolean converted = executePythonConversion(tempInputMp3, tempOutputWav);
            if (converted && Files.exists(tempOutputWav) && Files.size(tempOutputWav) > 0) {
                byte[] wavBytes = Files.readAllBytes(tempOutputWav);
                String wavFilename = originalFilename.replaceAll("(?i)\\.mp3$", ".wav");
                ByteArrayResource resource = new ByteArrayResource(wavBytes) {
                    @Override
                    public String getFilename() {
                        return wavFilename;
                    }
                };
                log.info("Successfully converted MP3 to WAV: {} ({} bytes)", wavFilename, wavBytes.length);
                return new ConvertedAudioResult(resource, wavFilename, true, "MP3", wavBytes.length);
            } else {
                log.warn("Python MP3-to-WAV conversion returned non-zero or empty output; falling back to original bytes");
                byte[] rawBytes = Files.readAllBytes(tempInputMp3);
                final String safeOriginalName = originalFilename;
                ByteArrayResource fallback = new ByteArrayResource(rawBytes) {
                    @Override
                    public String getFilename() {
                        return safeOriginalName;
                    }
                };
                return new ConvertedAudioResult(fallback, safeOriginalName, false, "MP3", rawBytes.length);
            }
        } finally {
            // Clean up temporary files
            try {
                Files.deleteIfExists(tempInputMp3);
                Files.deleteIfExists(tempOutputWav);
                Files.deleteIfExists(tempDir);
            } catch (Exception ignored) {}
        }
    }

    private boolean executePythonConversion(Path inputPath, Path outputPath) {
        String pythonExe = resolvePythonExecutable();
        Path scriptPath = resolveConversionScript();

        if (scriptPath == null || !Files.exists(scriptPath)) {
            log.warn("convert_to_wav.py script not found at expected location");
            return false;
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    pythonExe,
                    scriptPath.toAbsolutePath().toString(),
                    inputPath.toAbsolutePath().toString(),
                    outputPath.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                return true;
            } else {
                String output = new String(process.getInputStream().readAllBytes());
                log.warn("Python converter process failed with exit code {}: {}", exitCode, output);
                return false;
            }
        } catch (Exception e) {
            log.error("Failed to execute MP3 conversion process: {}", e.getMessage(), e);
            return false;
        }
    }

    private String resolvePythonExecutable() {
        if (customPythonPath != null && !customPythonPath.isBlank() && new File(customPythonPath).exists()) {
            return customPythonPath;
        }

        // Try AI-Model virtual environment relative to project
        Path userDir = Paths.get(System.getProperty("user.dir", "."));
        Path venvPython = userDir.resolve("AI-Model/.venv/Scripts/python.exe");
        if (Files.exists(venvPython)) {
            return venvPython.toAbsolutePath().toString();
        }

        // Sibling dir check if run from Backend folder
        Path parentVenv = userDir.resolve("../AI-Model/.venv/Scripts/python.exe");
        if (Files.exists(parentVenv)) {
            return parentVenv.toAbsolutePath().toString();
        }

        return "python";
    }

    private Path resolveConversionScript() {
        Path userDir = Paths.get(System.getProperty("user.dir", "."));
        Path script = userDir.resolve("AI-Model/scripts/convert_to_wav.py");
        if (Files.exists(script)) return script;

        Path parentScript = userDir.resolve("../AI-Model/scripts/convert_to_wav.py");
        if (Files.exists(parentScript)) return parentScript;

        return null;
    }

    private String getFileExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot != -1) ? filename.substring(dot) : "";
    }
}
