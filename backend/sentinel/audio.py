"""Bounded PCM streaming with an optional, explicit ONNX probability contract."""
import os
import time
import numpy as np


class Detector:
    def __init__(self):
        self.session = None
        self.error = None
        path = os.getenv('SENTINEL_MODEL_PATH', '')
        if path:
            try:
                import onnxruntime as ort
                self.session = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
                spec = self.session.get_inputs()[0]
                if spec.type != 'tensor(float)' or spec.shape != [1, 32000]:
                    raise ValueError('Expected float32 input [1, 32000]')
                self.input_name = spec.name
            except Exception:
                self.session = None
                self.error = 'Model could not be loaded; check the documented model contract.'

    @property
    def available(self):
        return self.session is not None

    def predict(self, samples):
        start = time.perf_counter()
        output = self.session.run(None, {self.input_name: samples.reshape(1, 32000)})[0]
        if np.asarray(output).size != 1:
            raise ValueError('Expected one spoof probability')
        score = float(np.asarray(output).reshape(-1)[0])
        if not np.isfinite(score) or not 0 <= score <= 1:
            raise ValueError('Invalid spoof probability')
        return score, round((time.perf_counter() - start) * 1000, 3)


class AudioWindow:
    def __init__(self, detector):
        self.detector = detector
        self.samples = np.empty(0, dtype=np.float32)
        self.since = 0
        self.ewma = None

    def feed(self, payload):
        if not 6400 <= len(payload) <= 32000 or len(payload) % 4:
            raise ValueError('Send 100–500 ms of mono float32 PCM at 16 kHz')
        frame = np.frombuffer(payload, dtype='<f4')
        if not np.isfinite(frame).all() or np.any(np.abs(frame) > 1.001):
            raise ValueError('PCM must be finite and within [-1, 1]')
        self.samples = np.concatenate((self.samples, frame))[-32000:]
        self.since += len(frame)
        rms = float(np.sqrt(np.mean(frame ** 2)))
        base = dict(risk=None, raw_score=None, inference_ms=None, rms=round(rms, 5), source='live', window_ms=2000)
        if len(self.samples) < 32000:
            return dict(base, status='buffering')
        if rms < 0.008:
            self.ewma = None
            return dict(base, status='silence')
        if not self.detector.available:
            return dict(base, status='model_unavailable')
        if self.since < getattr(self.detector, 'hop_samples', 3200):
            return {**base, 'status': 'high_risk' if self.ewma is not None and self.ewma >= .8 else 'monitoring', 'risk': self.ewma}
        self.since = 0
        try:
            score, latency = self.detector.predict(self.samples)
        except Exception:
            self.ewma = None
            return dict(base, status='model_error')
        self.ewma = score if self.ewma is None else .3 * score + .7 * self.ewma
        return dict(base, status='high_risk' if self.ewma >= .8 else 'monitoring',
                    risk=round(self.ewma, 4), raw_score=round(score, 4), inference_ms=latency)
