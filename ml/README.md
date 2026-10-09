# Optional real detector

The default install runs without a model and never invents live scores. To enable the revision-pinned third-party baseline, run from the repository root with the virtual environment active:

```bash
pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r ml/requirements.txt
python ml/download_baseline.py
```

Set this in your local `.env` and restart the backend:

```dotenv
SENTINEL_HF_MODEL_PATH=ml/checkpoints/baseline
SENTINEL_TORCH_THREADS=2
```

The model download is approximately 361 MiB; PyTorch also takes disk/memory. Downloaded weights and private audio are ignored by Git. Model provenance and SHA-256 checksums are recorded in `ml/checkpoints/baseline/provenance.json`.

Read [the model card](../docs/MODEL_CARD.md) before interpreting results. This is a third-party research baseline with incomplete dataset disclosures. It is not our custom trained model, not INT8, and not validated for deployment in banking.

## Bring an ONNX model

Install `onnxruntime==1.21.1`, set `SENTINEL_MODEL_PATH`, and leave `SENTINEL_HF_MODEL_PATH` empty. The model must accept exactly one float32 input of shape `[1, 32000]`, representing two seconds of 16 kHz mono audio normalized to [-1, 1]. Its first output must contain exactly one finite score in [0, 1] where larger means more synthetic/spoof-like. Any preprocessing beyond PCM conversion must be incorporated into that model. No assumption about logit ordering is made.

A model with a different contract must be explicitly adapted and evaluated. Never reinterpret a logit or a real-voice score as a spoof score.
