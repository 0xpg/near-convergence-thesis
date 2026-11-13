import base64,hashlib,json,re,struct
from pathlib import Path
from datetime import datetime,timezone
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
BASE=Path(__file__).resolve().parent
load=lambda f:json.loads((BASE/f).read_text(encoding='utf-8-sig'))
ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
def b58decode(text):
 n=0
 for c in text:n=n*58+ALPHABET.index(c)
 return b'\0'*(len(text)-len(text.lstrip('1')))+(n.to_bytes((n.bit_length()+7)//8,'big') if n else b'')
def b58encode(data):
 n=int.from_bytes(data,'big');out=''
 while n:n,r=divmod(n,58);out=ALPHABET[r]+out
 return '1'*(len(data)-len(data.lstrip(b'\0')))+out
def string(s):
 b=s.encode();return struct.pack('<I',len(b))+b
def prehash(payload):
 callback=payload.get('callbackUrl')
 data=struct.pack('<I',2147484061)+string(payload['message'])+base64.b64decode(payload['nonce'])+string(payload['recipient'])
 data+=b'\0' if callback is None else b'\1'+string(callback)
 return hashlib.sha256(data).digest()
def i128_nonzero(text):
 if not isinstance(text,str) or not re.fullmatch(r'-?(0|[1-9][0-9]*)',text) or text in ('0','-0'):return False
 digits=text.removeprefix('-');bound='170141183460469231731687303715884105728' if text.startswith('-') else '170141183460469231731687303715884105727'
 return len(digits)<39 or len(digits)==39 and digits<=bound
assert i128_nonzero(str(2**127-1)) and i128_nonzero(str(-2**127))
assert not i128_nonzero(str(2**127)) and not i128_nonzero(str(-2**127-1))
assert not any(map(i128_nonzero,['0','-0','01','+1',None,'1.0']))
assert i128_nonzero('100000000000000000000000000000000000000')
meta=load('current-source-metadata-rpc.json')['result'];decoded_meta=json.loads(bytes(meta['result']))
assert decoded_meta['version']=='0.4.5' and decoded_meta['build_info']['source_code_snapshot'].endswith('16d04f6ec4401263f8914638710260da50bb46b0')
receipt=load('receipt-sample-archival-rpc.json')['result'];receipt_id=receipt['receipt_id'];assert receipt['receiver_id']=='intents.near'
action=receipt['receipt']['Action']['actions'][0]['FunctionCall'];assert action['method_name']=='execute_intents'
args=json.loads(base64.b64decode(action['args']));signed=args['signed']
verified={}
for row in signed:
 assert row['standard']=='nep413';message=json.loads(row['payload']['message']);digest=prehash(row['payload'])
 Ed25519PublicKey.from_public_bytes(b58decode(row['public_key'].split(':',1)[1])).verify(b58decode(row['signature'].split(':',1)[1]),digest)
 verified[b58encode(digest)]=message
status=load('sample-tx-status-rpc.json')['result'];assert 'SuccessValue' in status['status']
outcome=next(r for r in status['receipts_outcome'] if r['id']==receipt_id);assert 'SuccessValue' in outcome['outcome']['status']
logs=[json.loads(log.removeprefix('EVENT_JSON:')) for log in outcome['outcome']['logs'] if log.startswith('EVENT_JSON:')]
sample=json.loads((BASE.parent/'intents-flywheel/public-event-sample.json').read_text());headers=sample['rows'][0]
dune=[dict(zip(headers,r)) for r in sample['rows'][1:] if r[2]==receipt_id]
assert len(dune)==4
for row in dune:
 event=json.loads(row['event']);position=int(row['index_in_execution_outcome_logs']);assert event==logs[position]
 for item in event['data']:
  message=verified[item['intent_hash']];assert message['signer_id']==item['account_id']
  assert any(intent.get('intent')=='token_diff' and intent['diff']==item['diff'] for intent in message['intents'])
block=load('sample-block-rpc.json')['result']['header'];assert block['hash']==outcome['block_hash']
time=datetime.fromtimestamp(int(block['timestamp_nanosec'])/1e9,timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
assert all(row['block_time']==time for row in dune)
# The exact source contract passes one payload hash into every statement; repeated hashes must not be treated as log duplicates.
engine=(BASE/'raw-contract/contracts__defuse__core__src__engine__mod.rs').read_text()
intents=(BASE/'raw-contract/contracts__defuse__core__src__intents__mod.rs').read_text()
assert 'let hash = signed.hash();' in engine and 'intents.execute_intent(&signer_id, self, hash)?;' in engine
assert 'for intent in self.intents' in intents and 'intent.execute_intent(signer_id, engine, intent_hash)?;' in intents
prefix=(BASE/'canonical-prefix.sql').read_text()
assert "raw_key_versions=1 AND event_version='0.4.3'" in prefix and 'intent_hash_rows=1' not in prefix
for filename,delimiter in [('02_public_account_intents_canonical.sql','\nSELECT day,block_time'),('03_public_account_intents_daily.sql',', raw_audit AS ('),('04_public_representation_pair_counts.sql',', asset_registry('),('05_public_reverse_pattern_daily.sql','\n, parameters(')]:
 text=(BASE.parent/'intents-flywheel'/filename).read_text();assert text.split(delimiter)[0]==prefix
report={'independentSource':'Official archival NEAR RPC; not the Dune dataset','receiptId':receipt_id,'transactionHash':status['transaction']['hash'],'finalStatus':'SuccessValue','blockHeight':block['height'],'blockTimeUtc':time+'Z','matchedDuneEvents':len(dune),'verifiedSignedPayloadHashes':len(verified),'ed25519SignaturesVerified':len(verified),'sourceCommit':decoded_meta['build_info']['source_code_snapshot'],'checks':['exact RPC log payload equality at log indices','NEP-413 Borsh+SHA256 intent hash reproduction','independent Ed25519 signature verification','signed input deltas and signer equal emitted event','finalized transaction and receipt success','block timestamp equality','signed-i128 lexical boundary tests','same canonical SQL prefix across four queries'],'scope':'One purposive successful receipt; validates decoding and key semantics, not whole-dataset completeness or contract WASM reproducibility'}
(BASE/'rpc-reconciliation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(report))
