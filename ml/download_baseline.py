"""Download a revision-pinned third-party model. No remote Python code is executed."""
from huggingface_hub import snapshot_download
from pathlib import Path
import hashlib
import json
MODEL='mo-thecreator/Deepfake-audio-detection'
REVISION='e4d9874b493362149cec96ced85f00b00b1a04c0'
root=Path(__file__).resolve().parent/'checkpoints'/'baseline'
snapshot_download(repo_id=MODEL,revision=REVISION,local_dir=root,
                  allow_patterns=['config.json','preprocessor_config.json','model.safetensors','README.md','LICENSE*'])
files={}
for path in root.iterdir():
    if path.is_file():
        h=hashlib.sha256()
        with path.open('rb') as f:
            for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
        files[path.name]=h.hexdigest()
(root/'provenance.json').write_text(json.dumps({'model':MODEL,'revision':REVISION,'license_declared':'Apache-2.0','sha256':files},indent=2))
print('Downloaded pinned baseline into ml/checkpoints/baseline. See docs/MODEL_CARD.md for limitations.')
