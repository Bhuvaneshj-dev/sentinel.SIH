import concurrent.futures
import time
import pytest
from fastapi.testclient import TestClient
from sentinel.app import app, database

OP = {'Authorization':'Bearer ' + 'o' * 40}
AP = {'Authorization':'Bearer ' + 'a' * 40}

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('SENTINEL_DB', str(tmp_path / 'test.db'))
    monkeypatch.setenv('SENTINEL_OPERATOR_TOKEN', 'o' * 40)
    monkeypatch.setenv('SENTINEL_APPROVER_TOKEN', 'a' * 40)
    return TestClient(app)

def transfer(client):
    c = client.post('/api/calls', headers=OP, json={'label':'Test call'}).json()
    r = client.post('/api/transfers', headers=OP, json={'call_id':c['id'], 'beneficiary':'Demo Supplier', 'amount_paise':80000000})
    assert r.status_code == 201
    return r.json()

def test_full_flow_and_replay(client):
    t = transfer(client)
    url = '/api/transfers/' + t['id']
    assert client.post(url+'/execute',headers=OP).status_code == 409
    assert client.post(url+'/decision',headers=AP,json={'digest':t['digest'],'approve':True}).status_code == 200
    assert client.post(url+'/execute',headers=OP).json()['status'] == 'executed'
    assert client.post(url+'/execute',headers=OP).status_code == 409
    log=client.get('/api/audit',headers=OP).json()
    assert log['chain_valid']
    assert log['events'][-1]['event']=='transfer.executed_sandbox'

def test_roles_and_tampering(client):
    t=transfer(client);url='/api/transfers/'+t['id']
    body={'digest':t['digest'],'approve':True}
    assert client.post(url+'/decision',headers=OP,json=body).status_code == 403
    assert client.post(url+'/execute',headers=AP).status_code == 403
    assert client.post(url+'/decision',headers=AP,json={**body,'digest':'0'*64}).status_code == 409
    assert client.post(url+'/decision',headers=AP,json={**body,'amount_paise':1}).status_code == 422
    assert client.patch(url,headers=OP,json={'amount_paise':1}).status_code in (404,405)
    assert client.get('/api/transfers').status_code == 401
    assert client.get('/api/transfers',headers={'Authorization':'Bearer invalid'}).status_code == 401

def test_expired_and_rejected(client):
    t=transfer(client);url='/api/transfers/'+t['id']
    with database() as db: db.execute('UPDATE transfers SET expires=? WHERE id=?',(time.time()-1,t['id']))
    assert client.post(url+'/decision',headers=AP,json={'digest':t['digest'],'approve':True}).status_code == 409
    assert client.post(url+'/execute',headers=OP).status_code == 409
    assert client.get('/api/transfers',headers=OP).json()[0]['status']=='expired'
    t=transfer(client);url='/api/transfers/'+t['id']
    client.post(url+'/decision',headers=AP,json={'digest':t['digest'],'approve':False})
    assert client.post(url+'/execute',headers=OP).status_code == 409

def test_concurrent_execution_once(client):
    t=transfer(client);url='/api/transfers/'+t['id']
    client.post(url+'/decision',headers=AP,json={'digest':t['digest'],'approve':True})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:client.post(url+'/execute',headers=OP).status_code,range(2)))
    assert sorted(results)==[200,409]

def test_fail_closed_configuration(client,monkeypatch):
    monkeypatch.setenv('SENTINEL_APPROVER_TOKEN','o'*40)
    assert client.get('/api/transfers',headers=OP).status_code==503

def test_invalid_amount_and_ended_call(client):
    c=client.post('/api/calls',headers=OP,json={'label':'Test'}).json()
    body={'call_id':c['id'],'beneficiary':'Demo','amount_paise':0}
    assert client.post('/api/transfers',headers=OP,json=body).status_code==422
    assert client.post('/api/transfers',headers=OP,json={**body,'amount_paise':1.2}).status_code==422
    client.post('/api/calls/'+c['id']+'/stop',headers=OP)
    assert client.post('/api/transfers',headers=OP,json={**body,'amount_paise':100}).status_code==409

def test_audit_tampering_detected(client):
    transfer(client)
    with database() as db: db.execute("UPDATE audit SET actor='intruder' WHERE seq=1")
    assert not client.get('/api/audit',headers=OP).json()['chain_valid']

def test_websocket_auth_and_real_audio(client):
    import numpy as np
    from sentinel.app import detector
    detector.session=None
    c=client.post('/api/calls',headers=OP,json={'label':'Audio'}).json()
    with client.websocket_connect('/api/audio/'+c['id']) as ws:
        ws.send_json({'token':'o'*40})
        assert ws.receive_json()['status']=='ready'
        for _ in range(10):
            ws.send_bytes(np.full(3200,.1,dtype='<f4').tobytes())
            result=ws.receive_json()
        assert result['status']=='model_unavailable'
        assert result['risk'] is None
