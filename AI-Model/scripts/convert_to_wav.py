# Audio DeepCheck - Audio Format Normalization & MP3 to WAV Converter
import sys
from pathlib import Path
import soundfile as sf
import librosa
import numpy as np

def convert_audio_to_wav(input_path: str, output_path: str, target_sr: int = 16000) -> bool:
    """
    Decodes input audio (.mp3, .wav, .war, .flac, .ogg) and writes
    a pristine 16,000 Hz, 16-bit PCM mono WAV file suitable for deep learning models.
    """
    inp = Path(input_path).resolve()
    out = Path(output_path).resolve()
    
    if not inp.exists():
        print(f"ERROR: Input file does not exist: {inp}", file=sys.stderr)
        return False
        
    out.parent.mkdir(parents=True, exist_ok=True)
    
    # 1. Attempt loading with librosa (handles MP3, OGG, WAV, etc.)
    try:
        y, sr = librosa.load(str(inp), sr=target_sr, mono=True)
    except Exception as e:
        # Fallback to soundfile if librosa fails
        try:
            data, orig_sr = sf.read(str(inp), dtype='float32')
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            if orig_sr != target_sr:
                data = librosa.resample(data, orig_sr=orig_sr, target_sr=target_sr)
            y, sr = data, target_sr
        except Exception as e2:
            print(f"ERROR: Failed to decode audio file {inp}: {e} / {e2}", file=sys.stderr)
            return False
            
    # 2. Write 16-bit PCM WAV
    try:
        sf.write(str(out), y, sr, subtype='PCM_16', format='WAV')
        duration = len(y) / sr
        print(f"SUCCESS: Converted '{inp.name}' to WAV ({sr}Hz, mono, duration={duration:.2f}s) -> '{out.name}'")
        return True
    except Exception as e:
        print(f"ERROR: Failed to write WAV file {out}: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_to_wav.py <input_file> <output_file.wav>")
        sys.exit(1)
        
    success = convert_audio_to_wav(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)
