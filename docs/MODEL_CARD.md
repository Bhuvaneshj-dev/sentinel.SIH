# Model card and claim boundaries

## Included integration

SENTINEL integrates a third-party Wav2Vec2 classifier as an **optional research baseline**, not a custom SENTINEL-V0, AASIST student, or distilled model.

- Upstream: https://huggingface.co/mo-thecreator/Deepfake-audio-detection
- Pinned revision: `e4d9874b493362149cec96ced85f00b00b1a04c0`
- Declared upstream license: Apache-2.0. Preserve upstream attribution and review dataset rights separately.
- Architecture: Wav2Vec2ForSequenceClassification, 94,569,090 parameters according to upstream metadata.
- Input: 16 kHz mono float32 waveform; two-second windows in this application.
- Normalization: upstream AutoFeatureExtractor, configured `do_normalize: true`.
- Output: softmax score for upstream `fake` label, index 0. This is an uncalibrated model score, not the probability that the caller is an impostor.
- Runtime: optional CPU PyTorch, local safetensors only, `trust_remote_code=False`.
- Checkpoint files are downloaded by a revision-pinned script; SHA-256 provenance is written alongside them.

## Validation status

A model-load and compute smoke benchmark was run on a synthetic tone. It does **not** establish speech classification accuracy. See `evaluation/benchmark.json` for the actual measurement.

The upstream card does not adequately describe its training/evaluation dataset, intended uses, or limitations. Its reported evaluation accuracy must **not** be advertised as SENTINEL accuracy. Independent speech evaluation, split verification, codec evaluation, and threshold calibration remain outstanding.

No claim is made of Indian-language robustness, zero-shot generalization, sub-10 ms inference, verified impersonation detection, or prevention of all fraud. Genuine human voices can deliver scams. Synthetic voices can have legitimate uses. Audio classification does not establish speaker identity or authorize an action.

## Operational behavior

- No configured model: `model_unavailable`, risk is null.
- Failed inference: `model_error`, risk is null.
- Insufficient samples: `buffering`, risk is null.
- Quiet frames: `silence`, risk is null; EWMA is reset.
- Valid inference: score smoothed with alpha 0.3; alert at 0.80.
- Threshold and smoothing are prototype choices, not calibrated operating points.
- Two seconds of evidence is needed before the first assessment. Inference time excludes collection/network/UI delay.
- A separate authorization is required for all sandbox transfers regardless of the score.

## ONNX option

Set `SENTINEL_MODEL_PATH` to an ONNX model meeting the contract in `ml/README.md`. It is an adapter, not a supplied or validated INT8 checkpoint. If both model paths are configured, the Hugging Face baseline takes precedence.

## Planned research

Held-out speaker/generator evaluation; AMR/Opus/G.711 transformations; teacher-student distillation; quantization; calibration; realistic time-to-alert measurements. These are not implemented claims.
