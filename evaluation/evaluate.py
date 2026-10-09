"""Offline clip evaluation. Input: CSV path,label,condition,speaker_id (labels 0 real / 1 fake)."""
import argparse
import csv
import hashlib
import json
import os
import platform
import sys
import time
import wave
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from sentinel.audio import Detector
from sentinel.hf_detector import HuggingFaceDetector

def read_wav(path):
    with wave.open(str(path),'rb') as f:
        if f.getframerate()!=16000 or f.getnchannels()!=1 or f.getsampwidth()!=2:
            raise ValueError('Use mono, 16 kHz, PCM16 WAV inputs')
        samples=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float32)/32768
    if len(samples)<32000:raise ValueError('Each evaluation clip must contain at least 2 seconds')
    return samples

def metrics(rows,threshold):
    tp=sum(r['label']==1 and r['score']>=threshold for r in rows)
    tn=sum(r['label']==0 and r['score']<threshold for r in rows)
    fp=sum(r['label']==0 and r['score']>=threshold for r in rows)
    fn=sum(r['label']==1 and r['score']<threshold for r in rows)
    return {'n':len(rows),'tp':tp,'tn':tn,'fp':fp,'fn':fn,'accuracy':(tp+tn)/len(rows),
            'false_positive_rate':fp/(fp+tn) if fp+tn else None,
            'miss_rate':fn/(fn+tp) if fn+tp else None}

def main():
    p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('--output',default='evaluation/results.json');p.add_argument('--threshold',type=float,default=.8);args=p.parse_args()
    if not 0<=args.threshold<=1:p.error('Threshold must be between zero and one')
    detector=HuggingFaceDetector(os.environ['SENTINEL_HF_MODEL_PATH']) if os.getenv('SENTINEL_HF_MODEL_PATH') else Detector()
    if not detector.available:raise SystemExit('No model available. Set a model path first.')
    manifest=Path(args.manifest);rows=[];latencies=[]
    for row in csv.DictReader(manifest.open()):
        label=int(row['label'])
        if label not in (0,1):raise ValueError('Label must be 0 or 1')
        samples=read_wav(manifest.parent/row['path']);scores=[]
        for offset in range(0,len(samples)-31999,32000):
            score,ms=detector.predict(samples[offset:offset+32000]);scores.append(score);latencies.append(ms)
        rows.append({'label':label,'score':float(np.mean(scores)),'condition':row.get('condition','unspecified')})
    if not rows:raise SystemExit('Manifest contains no samples')
    if {r['label'] for r in rows}!={0,1}:raise SystemExit('Both real and fake samples are required')
    result={'created_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'threshold':args.threshold,
            'protocol':'Mean score across complete nonoverlapping 2-second windows; no EWMA. Trailing incomplete window discarded.',
            'manifest_sha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'hardware':platform.platform(),
            'overall':metrics(rows,args.threshold),'by_condition':{c:metrics([r for r in rows if r['condition']==c],args.threshold) for c in sorted({r['condition'] for r in rows})},
            'inference_ms':{'median':float(np.median(latencies)),'p95':float(np.percentile(latencies,95))},
            'limitations':['Independent split integrity and dataset rights must be checked by the evaluator.','These are clip metrics, not streaming time-to-alert metrics.']}
    Path(args.output).write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
if __name__=='__main__':main()
