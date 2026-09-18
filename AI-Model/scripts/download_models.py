# Audio DeepCheck - Model Download Utility
import argparse
import os
import sys
from pathlib import Path

# Configure local Hugging Face cache inside project
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = PROJECT_ROOT / 'models' / 'huggingface'
CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ['HF_HOME'] = str(CACHE_DIR)
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

WAV2VEC2_MODEL_ID = 'garystafford/wav2vec2-deepfake-voice-detector'
DF_ARENA_MODEL_ID = 'Speech-Arena-2025/DF_Arena_500M_V_1'


def download_wav2vec2():
    from transformers import AutoFeatureExtractor, AutoModelForAudioClassification, Wav2Vec2ForSequenceClassification

    print('=' * 60)
    print(f'Downloading Wav2Vec2 model: {WAV2VEC2_MODEL_ID}')
    print(f'Cache directory:   {CACHE_DIR}')
    print('Approximate size:  ~1.2 GB')
    print('=' * 60)

    print('1. Downloading and loading feature extractor...')
    feature_extractor = AutoFeatureExtractor.from_pretrained(
        WAV2VEC2_MODEL_ID,
        cache_dir=str(CACHE_DIR)
    )
    print(f'   Feature extractor loaded: {type(feature_extractor).__name__}')
    print(f'   Target sampling rate:     {feature_extractor.sampling_rate} Hz')

    print('2. Downloading and loading model...')
    try:
        model = AutoModelForAudioClassification.from_pretrained(
            WAV2VEC2_MODEL_ID,
            cache_dir=str(CACHE_DIR)
        )
    except Exception as e:
        print(f'   AutoModelForAudioClassification fallback: {e}')
        model = Wav2Vec2ForSequenceClassification.from_pretrained(
            WAV2VEC2_MODEL_ID,
            cache_dir=str(CACHE_DIR)
        )

    model.eval()
    print(f'   Model loaded:             {type(model).__name__}')
    print(f'   id2label mapping:         {model.config.id2label}')
    print(f'   label2id mapping:         {model.config.label2id}')
    print(f'   Number of parameters:     {sum(p.numel() for p in model.parameters()):,}')
    print('WAV2VEC2 DOWNLOAD AND VERIFICATION COMPLETE!\n')


def download_df_arena():
    from huggingface_hub import snapshot_download
    from transformers import AutoModel

    print('=' * 60)
    print(f'Downloading DF Arena 500M model: {DF_ARENA_MODEL_ID}')
    print(f'Cache directory:   {CACHE_DIR}')
    print('Approximate size:  ~1.74 GB')
    print('=' * 60)

    print('1. Fetching repository files and weights...')
    path = snapshot_download(DF_ARENA_MODEL_ID, cache_dir=str(CACHE_DIR))
    print(f'   Snapshot available at: {path}')

    print('2. Loading and verifying DF Arena model...')
    model = AutoModel.from_pretrained(
        DF_ARENA_MODEL_ID,
        trust_remote_code=True,
        cache_dir=str(CACHE_DIR)
    )
    model.eval()
    print(f'   Model loaded:             {type(model).__name__}')
    print(f'   Number of parameters:     {sum(p.numel() for p in model.parameters()):,}')
    print('DF ARENA 500M DOWNLOAD AND VERIFICATION COMPLETE!\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Download models for Audio DeepCheck.")
    parser.add_argument(
        '--model',
        choices=['wav2vec2', 'df_arena', 'all'],
        default='all',
        help="Specify which model to download (default: all)"
    )
    args = parser.parse_args()

    if args.model in ['wav2vec2', 'all']:
        download_wav2vec2()
    if args.model in ['df_arena', 'all']:
        download_df_arena()
