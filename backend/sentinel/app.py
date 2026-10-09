"""SENTINEL research prototype. All transactions are sandbox records."""
import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict
from .audio import AudioWindow, Detector

app = FastAPI(title='SENTINEL Sandbox Gateway', version='0.1.0')
origins = os.getenv('SENTINEL_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000').split(',')
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET', 'POST'], allow_headers=['Authorization', 'Content-Type'])
if os.getenv('SENTINEL_HF_MODEL_PATH'):
    from .hf_detector import HuggingFaceDetector
    detector = HuggingFaceDetector(os.environ['SENTINEL_HF_MODEL_PATH'])
else:
    detector = Detector()
active_streams = set()
stream_lock = threading.Lock()


@contextmanager
def database():
    conn = sqlite3.connect(os.getenv('SENTINEL_DB', 'sentinel.db'), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.executescript('''
      CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY, label TEXT, state TEXT, created REAL);
      CREATE TABLE IF NOT EXISTS transfers(id TEXT PRIMARY KEY, call_id TEXT, beneficiary TEXT,
        amount_paise INTEGER, digest TEXT, status TEXT, created REAL, expires REAL, approved_by TEXT);
      CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY, timestamp REAL, actor TEXT,
        event TEXT, details TEXT, previous_hash TEXT, hash TEXT);
    ''')
    try:
        conn.execute('BEGIN IMMEDIATE')
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'))


def audit(db, actor, event, details):
    previous = db.execute('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').fetchone()
    previous = previous['hash'] if previous else '0' * 64
    timestamp = time.time()
    data = canonical(details)
    digest = hashlib.sha256(canonical([timestamp, actor, event, data, previous]).encode()).hexdigest()
    db.execute('INSERT INTO audit(timestamp,actor,event,details,previous_hash,hash) VALUES(?,?,?,?,?,?)',
               (timestamp, actor, event, data, previous, digest))


def role_for(token):
    operator = os.getenv('SENTINEL_OPERATOR_TOKEN', '')
    approver = os.getenv('SENTINEL_APPROVER_TOKEN', '')
    if len(operator) < 32 or len(approver) < 32 or operator == approver:
        raise HTTPException(503, 'Configure distinct operator and approver tokens of at least 32 characters')
    if hmac.compare_digest(token, operator):
        return 'operator'
    if hmac.compare_digest(token, approver):
        return 'approver'
    raise HTTPException(401, 'Invalid credentials')


def authorized(authorization: str = Header(default='')):
    if not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Bearer token required')
    return role_for(authorization[7:])


def require(actor, expected):
    if actor != expected:
        raise HTTPException(403, f'{expected} role required')


class CallInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    label: str = Field(min_length=1, max_length=80)


class TransferInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    call_id: str
    beneficiary: str = Field(min_length=2, max_length=100, pattern=r'^[\w .@/-]+$')
    amount_paise: int = Field(strict=True, gt=0, le=10000000000)


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    digest: str = Field(min_length=64, max_length=64)
    approve: bool


@app.get('/api/health')
def health():
    return dict(status='ok', sandbox=True, model_available=detector.available,
                model_error=detector.error, sample_rate=16000, window_ms=2000)


@app.get('/api/session')
def session(actor=Depends(authorized)):
    return {'role': actor}


@app.post('/api/calls', status_code=201)
def new_call(body: CallInput, actor=Depends(authorized)):
    require(actor, 'operator')
    item = dict(id=str(uuid.uuid4()), label=body.label, state='active', created=time.time())
    with database() as db:
        db.execute('INSERT INTO calls VALUES(:id,:label,:state,:created)', item)
        audit(db, actor, 'call.started', {'call_id': item['id']})
    return item


@app.post('/api/calls/{call_id}/stop')
def stop_call(call_id: str, actor=Depends(authorized)):
    require(actor, 'operator')
    with database() as db:
        if not db.execute("UPDATE calls SET state='ended' WHERE id=? AND state='active'", (call_id,)).rowcount:
            raise HTTPException(409, 'Call missing or already ended')
        audit(db, actor, 'call.ended', {'call_id': call_id})
    return {'status': 'ended'}


@app.get('/api/transfers')
def transfers(actor=Depends(authorized)):
    with database() as db:
        expire(db)
        return [dict(x) for x in db.execute('SELECT * FROM transfers ORDER BY created DESC LIMIT 100')]


def expire(db):
    for row in db.execute("SELECT id FROM transfers WHERE status IN ('pending','approved') AND expires<=?", (time.time(),)).fetchall():
        db.execute("UPDATE transfers SET status='expired' WHERE id=?", (row['id'],))
        audit(db, 'system', 'transfer.expired', {'transfer_id': row['id']})


@app.post('/api/transfers', status_code=201)
def create_transfer(body: TransferInput, actor=Depends(authorized)):
    require(actor, 'operator')
    ident = str(uuid.uuid4())
    created = time.time()
    digest = hashlib.sha256(canonical(dict(id=ident, **body.model_dump())).encode()).hexdigest()
    with database() as db:
        if not db.execute("SELECT id FROM calls WHERE id=? AND state='active'", (body.call_id,)).fetchone():
            raise HTTPException(409, 'An active call is required')
        db.execute('INSERT INTO transfers VALUES(?,?,?,?,?,?,?,?,?)',
            (ident, body.call_id, body.beneficiary, body.amount_paise, digest, 'pending', created, created + 300, None))
        audit(db, actor, 'transfer.requested', {'transfer_id': ident, 'digest': digest})
        return dict(db.execute('SELECT * FROM transfers WHERE id=?', (ident,)).fetchone())


@app.post('/api/transfers/{ident}/decision')
def decide(ident: str, body: DecisionInput, actor=Depends(authorized)):
    require(actor, 'approver')
    with database() as db:
        row = db.execute('SELECT * FROM transfers WHERE id=?', (ident,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Transfer not found')
        if row['expires'] <= time.time() or row['status'] != 'pending':
            raise HTTPException(409, 'Transfer is expired or already decided')
        if not hmac.compare_digest(row['digest'], body.digest):
            raise HTTPException(409, 'Transaction details do not match approval')
        state = 'approved' if body.approve else 'rejected'
        db.execute('UPDATE transfers SET status=?,approved_by=? WHERE id=?', (state, actor, ident))
        audit(db, actor, 'transfer.' + state, {'transfer_id': ident, 'digest': body.digest})
        return dict(db.execute('SELECT * FROM transfers WHERE id=?', (ident,)).fetchone())


@app.post('/api/transfers/{ident}/execute')
def execute(ident: str, actor=Depends(authorized)):
    require(actor, 'operator')
    with database() as db:
        row = db.execute('SELECT * FROM transfers WHERE id=?', (ident,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Transfer not found')
        if row['status'] != 'approved' or row['expires'] <= time.time():
            raise HTTPException(409, 'Independent, unexpired approval is required')
        db.execute("UPDATE transfers SET status='executed' WHERE id=?", (ident,))
        audit(db, actor, 'transfer.executed_sandbox', {'transfer_id': ident, 'digest': row['digest']})
        return dict(db.execute('SELECT * FROM transfers WHERE id=?', (ident,)).fetchone())


@app.get('/api/audit')
def audit_events(actor=Depends(authorized)):
    with database() as db:
        rows = [dict(x) for x in db.execute('SELECT * FROM audit ORDER BY seq')]
    previous = '0' * 64
    intact = True
    for row in rows:
        expected = hashlib.sha256(canonical([row['timestamp'], row['actor'], row['event'], row['details'], previous]).encode()).hexdigest()
        intact = intact and row['previous_hash'] == previous and row['hash'] == expected
        previous = row['hash']
        row['details'] = json.loads(row['details'])
    return {'chain_valid': intact, 'events': rows[-500:]}


@app.websocket('/api/audio/{call_id}')
async def audio_stream(ws: WebSocket, call_id: str):
    import asyncio
    if ws.headers.get('origin') and ws.headers['origin'] not in origins:
        await ws.close(code=1008)
        return
    await ws.accept()
    registered = False
    try:
        auth = await asyncio.wait_for(ws.receive_json(), timeout=5)
        if not isinstance(auth, dict) or not isinstance(auth.get('token'), str):
            raise ValueError('Invalid authentication message')
        require(role_for(auth['token']), 'operator')
        with database() as db:
            if not db.execute("SELECT id FROM calls WHERE id=? AND state='active'", (call_id,)).fetchone():
                raise ValueError('Active call required')
        with stream_lock:
            if call_id in active_streams or len(active_streams) >= 8:
                raise ValueError('Stream capacity reached')
            active_streams.add(call_id)
            registered = True
        window = AudioWindow(detector)
        await ws.send_json({'status': 'ready', 'model_available': detector.available})
        began = time.monotonic()
        samples_received = 0
        last_state = None
        while True:
            payload = await asyncio.wait_for(ws.receive_bytes(), timeout=30)
            samples_received += len(payload) // 4
            if samples_received / 16000 > time.monotonic() - began + 2:
                raise ValueError('Audio must be paced in real time')
            with database() as db:
                if not db.execute("SELECT id FROM calls WHERE id=? AND state='active'", (call_id,)).fetchone():
                    raise ValueError('Call ended')
            result = await asyncio.to_thread(window.feed, payload)
            if result['status'] == 'high_risk' and last_state != 'high_risk':
                with database() as db:
                    audit(db, 'detector', 'call.high_risk', {'call_id': call_id, 'risk': result['risk']})
            last_state = result['status']
            await ws.send_json(result)
    except WebSocketDisconnect:
        pass
    except (ValueError, HTTPException, asyncio.TimeoutError, TypeError, KeyError):
        await ws.close(code=1008)
    finally:
        if registered:
            with stream_lock:
                active_streams.discard(call_id)


dist = Path(__file__).resolve().parents[2] / 'frontend' / 'dist'
if dist.exists():
    app.mount('/', StaticFiles(directory=dist, html=True), name='frontend')
