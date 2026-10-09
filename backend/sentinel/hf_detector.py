"""Optional local-only Wav2Vec2 baseline. This is not a custom SENTINEL model."""
import os
import time
import numpy as np

class HuggingFaceDetector:
    hop_samples = 8000  # At least 500 ms between heavy CPU inferences.
    def __init__(self, path):
        self.error=None
        self.model=None
        try:
            import torch
            from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
            torch.set_num_threads(max(1,int(os.getenv('SENTINEL_TORCH_THREADS','2'))))
            self.torch=torch
            self.processor=AutoFeatureExtractor.from_pretrained(path,local_files_only=True,trust_remote_code=False)
            self.model=AutoModelForAudioClassification.from_pretrained(path,local_files_only=True,trust_remote_code=False,use_safetensors=True).eval()
            labels={str(v).lower():int(k) for k,v in self.model.config.id2label.items()}
            if 'fake' not in labels or self.processor.sampling_rate!=16000:
                raise ValueError('Expected fake label and 16 kHz processor')
            self.fake_index=labels['fake']
        except Exception:
            self.model=None
            self.error='Local baseline failed to load. Install ml requirements and download the pinned checkpoint.'
    @property
    def available(self):return self.model is not None
    def predict(self,samples):
        start=time.perf_counter()
        inputs=self.processor(np.asarray(samples,dtype=np.float32),sampling_rate=16000,return_tensors='pt')
        with self.torch.inference_mode():
            score=float(self.model(**inputs).logits.softmax(-1)[0,self.fake_index])
        if not np.isfinite(score):raise ValueError('Invalid model output')
        return score,round((time.perf_counter()-start)*1000,3)
