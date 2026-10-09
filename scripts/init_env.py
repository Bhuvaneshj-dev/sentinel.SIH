"""Create a local secret file without printing its contents or overwriting it."""
from pathlib import Path
import secrets
p=Path('.env')
if p.exists():
    raise SystemExit('.env already exists. It was not changed.')
with p.open('x') as f:
    f.write('SENTINEL_OPERATOR_TOKEN='+secrets.token_urlsafe(32)+'\n')
    f.write('SENTINEL_APPROVER_TOKEN='+secrets.token_urlsafe(32)+'\n')
    f.write('SENTINEL_DB=sentinel.db\nSENTINEL_MODEL_PATH=\n')
p.chmod(0o600)
print('Created .env with separate credentials. Read it locally; never commit or share it.')
