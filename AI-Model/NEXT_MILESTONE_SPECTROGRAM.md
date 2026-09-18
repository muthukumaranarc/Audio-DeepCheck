# Audio DeepCheck — Next Milestone
## Spectrogram Analysis Evidence Layer

### Goal

Add spectrogram analysis as an independent evidence source for the **Human vs AI** problem.

Do not build the final fusion model yet.
Do not build a large spectrogram CNN yet.

## 1. Input

Use the same source audio already used by the other detectors.

```text
audio
  ↓
STFT
  ↓
linear spectrogram
  +
Mel spectrogram
  ↓
features + visualization
```

## 2. Required features

Investigate at least:

- spectral centroid
- spectral bandwidth
- spectral rolloff
- spectral flatness
- zero-crossing rate
- spectral contrast
- RMS energy
- harmonic/percussive energy relationship
- Mel-band energy statistics
- temporal variation of spectral energy

Provide summary statistics such as mean, standard deviation, median, range and useful percentiles.

Do not create hundreds of redundant features without evidence that they help.

## 3. STFT

Make parameters configurable:

- sample rate
- `n_fft`
- hop length
- window

Document the defaults.

## 4. Mel spectrogram

Generate and optionally save Mel spectrograms for visual inspection.

Do not claim that a visual pattern by itself proves human or AI.

## 5. Service

Create:

`app/services/spectrogram_service.py`

Keep core feature extraction independent from plotting where practical.

Responsibilities:

- validate audio
- compute STFT
- compute Mel spectrogram
- extract numerical features
- optionally create visualizations

## 6. CLI

Create:

`scripts/analyze_spectrogram.py`

Example:

```powershell
py -3.11 scripts/analyze_spectrogram.py data/samples/human_voice.wav
```

Save generated outputs under:

`data/test/spectrogram/`

Generate:

- waveform
- linear spectrogram
- Mel spectrogram
- feature JSON

Do not commit generated large artifacts.

## 7. Benchmark

Process available samples from the existing benchmark matrix:

Human:
- `human_voice.wav`
- `human_kennedy.ogg`
- `human_churchill.wav`
- `human_armstrong.wav`

AI:
- `ai_voice.wav`
- `ai_luvvoice.wav`
- `ai_kokoro_heart0.wav`
- `ai_piper_amy.mp3`

Do not fabricate missing files.

Report exactly which files were available.

## 8. Optional classifier

Only if the available labeled data is sufficient, try a lightweight exploratory model:

- Logistic Regression
- Random Forest
- XGBoost

Do not call its score the production final probability.

Do not train on the final evaluation samples.

If data is insufficient, skip the classifier and document why.

## 9. Tests

Create:

`tests/test_spectrogram.py`

Test:

- mono/stereo input
- different sample rates
- empty input rejection
- STFT dimensions
- Mel dimensions
- expected feature keys
- finite numeric outputs

Run:

```powershell
py -3.11 -m pytest -v
```

Existing Wav2Vec2 and DF Arena tests must remain passing.

## 10. Performance

Measure:

- feature extraction time
- approximate RAM use
- visualization/output size

Keep this component lightweight.

## 11. Definition of Done

Complete when:

- spectrogram service exists
- STFT works
- Mel spectrogram works
- feature extraction works
- visualizer works
- benchmark matrix is processed
- tests pass
- existing tests still pass
- findings are documented
- `current-stage.md` is updated

Do not automatically build a CNN after this milestone.

## 12. Next decision

After analysis:

- If features add useful information → keep for fusion and consider a lightweight classifier.
- If they add little → keep visualization for explainability without adding a large model.
- If a dedicated image model is justified → create a separate future milestone.
