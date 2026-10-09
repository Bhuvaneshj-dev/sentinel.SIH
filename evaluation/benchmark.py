"""Compute-only benchmark on a deterministic synthetic waveform; never an accuracy test."""
import json, os, platform, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from sentinel.audio import Detector
from sentinel.hf_detector import HuggingFaceDetector
d=HuggingFaceDetector(os.environ['SENTINEL_HF_MODEL_PATH']) if os.getenv('SENTINEL_HF_MODEL_PATH') else Detector()
if not d.available:raise SystemExit(d.error or 'No model configured')
x=(.2*np.sin(2*np.pi*220*np.arange(32000)/16000)).astype(np.float32)
for _ in range(3):d.predict(x)
times=[d.predict(x)[1] for _ in range(20)]
result={'kind':'synthetic-compute-benchmark','model':'third-party Wav2Vec2 baseline' if os.getenv('SENTINEL_HF_MODEL_PATH') else 'configured ONNX',
        'created_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'platform':platform.platform(),
        'cpu':platform.processor(),'threads':int(os.getenv('SENTINEL_TORCH_THREADS','2')),
        'window_ms':2000,'warmup_runs':3,'measured_runs':20,'median_ms':round(float(np.median(times)),2),'p95_ms':round(float(np.percentile(times,95)),2),
        'accuracy':None,'note':'Synthetic tone, not speech. Measures preprocessing + model execution only, not detection accuracy or end-to-end latency.'}
Path('evaluation/benchmark.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
