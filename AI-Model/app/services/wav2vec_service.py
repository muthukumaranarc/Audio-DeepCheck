import os
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import numpy as np
import soundfile as sf
import scipy.signal

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = PROJECT_ROOT / 'models' / 'huggingface'
ONNX_MODEL_DIR = PROJECT_ROOT / 'models' / 'wav2vec2'
DEFAULT_ONNX_MODEL_PATH = ONNX_MODEL_DIR / 'wav2vec2_deepfake_int8.onnx'
ONNX_HF_REPO = 'pranjal-pravesh/wav2vec2-large-xlsr-deepfake-audio-classification'
PYTORCH_MODEL_ID = 'garystafford/wav2vec2-deepfake-voice-detector'

os.environ['HF_HOME'] = str(CACHE_DIR)
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

TARGET_SAMPLE_RATE = 16000


def inspect_audio(file_path: Path) -> Dict[str, Any]:
    """Inspect an audio file and return its technical properties."""
    info = sf.info(str(file_path))
    return {
        'file_name': file_path.name,
        'sample_rate': info.samplerate,
        'channels': info.channels,
        'duration_seconds': round(info.duration, 3),
        'sample_count': info.frames,
        'format': info.format,
        'subtype': info.subtype,
    }


def load_and_preprocess_audio(
    file_path: Path,
    target_sr: int = TARGET_SAMPLE_RATE
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Load audio, convert to mono float32, and resample to target sampling rate.
    """
    metadata = inspect_audio(file_path)

    # Load audio with soundfile to get raw array
    audio, sr = sf.read(str(file_path), dtype='float32')

    # Convert multi-channel (stereo) to mono
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    # Resample to target sample rate if needed
    if sr != target_sr:
        try:
            import librosa
            audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
        except Exception:
            num_samples = int(len(audio) * target_sr / sr)
            audio = scipy.signal.resample(audio, num_samples)

    # Peak normalization to ensure amplitude range within [-1.0, 1.0]
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio = audio / max_val

    return audio.astype(np.float32), metadata


class Wav2Vec2Detector:
    """
    Wav2Vec2 pretrained deepfake voice detector wrapper.
    Supports both ONNX Runtime (default, fast CPU) and PyTorch backends.
    """

    def __init__(
        self,
        model_path: Optional[Path] = None,
        model_id: str = PYTORCH_MODEL_ID,
        cache_dir: Optional[Path] = None,
        prefer_onnx: bool = True
    ):
        self.prefer_onnx = prefer_onnx
        self.model_id = model_id
        self.cache_dir = cache_dir or CACHE_DIR
        self.backend = None
        self.session = None

        if self.prefer_onnx:
            try:
                import onnxruntime as ort
                target_onnx_path = model_path or DEFAULT_ONNX_MODEL_PATH
                if not target_onnx_path.exists():
                    from huggingface_hub import hf_hub_download
                    print(f"ONNX model not found locally at {target_onnx_path}. Downloading from {ONNX_HF_REPO}...")
                    target_onnx_path.parent.mkdir(parents=True, exist_ok=True)
                    downloaded = hf_hub_download(repo_id=ONNX_HF_REPO, filename='model_int8.onnx')
                    import shutil
                    shutil.copyfile(downloaded, target_onnx_path)

                self.session = ort.InferenceSession(str(target_onnx_path), providers=['CPUExecutionProvider'])
                self.input_names = [i.name for i in self.session.get_inputs()]
                self.backend = 'onnxruntime'
                class _DeviceShim:
                    type = 'cpu'
                self.device = _DeviceShim()
                self.id2label = {0: 'real', 1: 'fake'}
                self.label2id = {'real': 0, 'fake': 1}
                class _FeatureExtractorShim:
                    sampling_rate = TARGET_SAMPLE_RATE
                self.feature_extractor = _FeatureExtractorShim()
            except Exception as e:
                print(f"Warning: ONNX Runtime initialization failed ({e}). Falling back to PyTorch if available.")

        if self.backend is None:
            # PyTorch fallback
            import torch
            from transformers import AutoFeatureExtractor, Wav2Vec2ForSequenceClassification
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(
                self.model_id,
                cache_dir=str(self.cache_dir)
            )
            self.model = Wav2Vec2ForSequenceClassification.from_pretrained(
                self.model_id,
                cache_dir=str(self.cache_dir)
            )
            self.model.to(self.device)
            self.model.eval()
            self.id2label = self.model.config.id2label
            self.label2id = self.model.config.label2id
            self.backend = 'pytorch'

    def predict_waveform(self, waveform: np.ndarray, sample_rate: int = TARGET_SAMPLE_RATE) -> Dict[str, Any]:
        """Run inference on a 1D float32 numpy waveform."""
        if len(waveform) == 0:
            raise ValueError('Audio waveform is empty.')

        # Wav2Vec2 standard feature normalization (zero mean, unit variance)
        norm_waveform = (waveform - np.mean(waveform)) / np.sqrt(np.var(waveform) + 1e-7)

        if self.backend == 'onnxruntime':
            input_values = norm_waveform.reshape(1, -1).astype(np.float32)
            feed_dict = {'input_values': input_values}
            if 'attention_mask' in self.input_names:
                feed_dict['attention_mask'] = np.ones_like(input_values, dtype=np.int32)

            logits = self.session.run(None, feed_dict)[0]
            real_logit = float(logits[0][0])
            fake_logit = float(logits[0][1])

            # Softmax calculation
            exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)
            real_prob = float(probs[0][0])
            fake_prob = float(probs[0][1])

        else:
            import torch
            import torch.nn.functional as F
            inputs = self.feature_extractor(
                waveform,
                sampling_rate=sample_rate,
                return_tensors='pt',
                padding=True
            )
            input_values = inputs.input_values.to(self.device)
            with torch.no_grad():
                outputs = self.model(input_values)
                logits = outputs.logits
                probs = F.softmax(logits, dim=-1).squeeze(0).cpu().numpy()

            real_logit = float(logits[0][self.label2id['real']])
            fake_logit = float(logits[0][self.label2id['fake']])
            real_prob = float(probs[self.label2id['real']])
            fake_prob = float(probs[self.label2id['fake']])

        predicted_label = 'fake' if fake_prob > real_prob else 'real'

        if fake_prob >= 0.70:
            assessment = 'LIKELY_SYNTHETIC'
        elif real_prob >= 0.70:
            assessment = 'LIKELY_HUMAN'
        else:
            assessment = 'UNCERTAIN'

        return {
            'prediction': predicted_label,
            'assessment': assessment,
            'real_probability': round(real_prob, 4),
            'fake_probability': round(fake_prob, 4),
            'logits': {
                'real': round(real_logit, 4),
                'fake': round(fake_logit, 4),
            },
            'engine': self.backend
        }

    def predict_file(self, file_path: Path) -> Dict[str, Any]:
        """Preprocess audio file and run inference."""
        file_path = Path(file_path)
        waveform, metadata = load_and_preprocess_audio(file_path, target_sr=TARGET_SAMPLE_RATE)
        result = self.predict_waveform(waveform, sample_rate=TARGET_SAMPLE_RATE)
        result['audio_properties'] = metadata
        return result
