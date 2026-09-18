#!/usr/bin/env bash
# Audio DeepCheck - Linux/Ubuntu environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
export HF_HOME="${PROJECT_ROOT}/models/huggingface"
export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH}"
export HF_HUB_DISABLE_SYMLINKS_WARNING=1
echo "Audio DeepCheck environment configured (Linux/Ubuntu)."
