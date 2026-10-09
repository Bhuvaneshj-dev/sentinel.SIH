import numpy as np
import pytest
from sentinel.audio import AudioWindow

class Missing:
    available=False
class Stub:
    available=True
    def predict(self,x):return .9,1.0

def test_silence_is_not_genuine():
    w=AudioWindow(Missing())
    for _ in range(10):r=w.feed(np.zeros(3200,dtype='<f4').tobytes())
    assert r['status']=='silence' and r['risk'] is None

def test_bounded_window_and_score():
    w=AudioWindow(Stub())
    for _ in range(30):r=w.feed(np.full(3200,.1,dtype='<f4').tobytes())
    assert len(w.samples)==32000
    assert r['status']=='high_risk' and r['risk']==.9
    assert r['inference_ms']==1.0

@pytest.mark.parametrize('payload',[b'bad',np.full(3200,np.nan,dtype='<f4').tobytes(),np.full(3200,2,dtype='<f4').tobytes()])
def test_malformed_pcm(payload):
    with pytest.raises(ValueError):AudioWindow(Missing()).feed(payload)

def test_inference_failure_not_safe():
    class Broken:
        available=True
        def predict(self,x):raise RuntimeError('broken')
    w=AudioWindow(Broken())
    for _ in range(10):r=w.feed(np.full(3200,.1,dtype='<f4').tobytes())
    assert r['status']=='model_error' and r['risk'] is None
