import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const workflow=readFileSync(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8');
const block=workflow.match(/          deploy_log=([\s\S]+?)\n      - name: Verify live routes/);
assert(block,'Deployment retry block missing');
const script='deploy_log='+block[1].replace(/^          /gm,'');
const stub=`calls=0
sleep(){ :; }
curl(){
 case "$*" in
  *--write-out*) case "$MODE" in missing|createfail) echo 404 ;; lookupfail) echo 503 ;; *) echo 200 ;; esac ;;
  *) echo '{"success":true}' ;;
 esac
}
jq(){ cat >/dev/null; [ "$MODE" != createfail ]; }
npx(){
 calls=$((calls + 1))
 echo ATTEMPT
 case "$MODE:$calls" in
  transient:1|exhausted:*) echo '503 Service Unavailable'; return 1 ;;
  auth:*) echo 'Authentication error'; return 1 ;;
  *) echo deployed; return 0 ;;
 esac
}
`;
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
for(const [mode,attempts,status] of [['success',1,0],['transient',2,0],['exhausted',3,1],['auth',1,1],['missing',1,0],['createfail',0,1],['lookupfail',0,1]]){
 const result=spawnSync(bash,['-eo','pipefail','-c',stub+script],{encoding:'utf8',env:{...process.env,MODE:mode}});
 assert.ifError(result.error);assert.equal(result.status,status,result.stderr);
 assert.equal((result.stdout.match(/^ATTEMPT$/gm)||[]).length,attempts,mode);
}
console.log('Deployment retry: success, upstream recovery, bounded exhaustion and immediate authentication failure passed; no network calls.');
