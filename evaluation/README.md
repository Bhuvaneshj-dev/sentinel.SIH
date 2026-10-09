# Reproducible evaluation

## Current evidence

`benchmark.json` contains a measured compute smoke benchmark for the optional pinned baseline. Its waveform is a synthetic sine tone. It provides no detection accuracy evidence and is not an end-to-end latency test.

Reproduce from the root:

```bash
SENTINEL_HF_MODEL_PATH=ml/checkpoints/baseline python evaluation/benchmark.py
```

CPU hardware, thread count, warmup, run count and window length are recorded. Hardware/load differences change measurements. The heavier baseline requests inference at least every 500 ms (600 ms with the browser’s 200 ms blocks), while the ONNX path uses a 200 ms hop. The last assessment is held between inference steps. The client closes a stream if its outgoing buffer overflows. Multi-call throughput is not benchmarked.

## Speech evaluation

1. Obtain licensed/consented genuine and synthetic speech. Do not commit private speech.
2. Create disjoint training, validation and test speaker sets; hold out generators for generalization experiments. Upstream baseline dataset overlap is unknown, so disclose that limitation.
3. Convert inputs to 16 kHz mono PCM16 WAV. Each clip needs at least two seconds.
4. Copy `manifest.example.csv` and replace every example entry with a real file. Labels: 0 genuine, 1 synthetic. Record condition and speaker ID.
5. Choose a threshold on validation data, freeze it, then evaluate the test manifest:

```bash
SENTINEL_HF_MODEL_PATH=ml/checkpoints/baseline python evaluation/evaluate.py /path/to/test.csv --threshold 0.8 --output evaluation/results.json
```

The evaluator reports accuracy, false-positive rate, miss rate, confusion counts and results grouped by condition. It averages complete nonoverlapping 2-second window scores per clip, discarding a trailing incomplete window. It intentionally does not claim to reproduce streaming EWMA/time-to-alert behavior.

A condition with no real or no fake examples receives null for the corresponding rate. Both classes are required overall. The evaluator does not certify dataset licenses, speaker-disjointness, or absence of leakage: those require independent provenance review.

## Missing research

No held-out speech result is committed yet. ASVspoof, Indian-language, codec, ablation, calibration, and unseen-generator experiments remain to be performed. Do not turn upstream reported metrics or demo scores into SENTINEL metrics.
