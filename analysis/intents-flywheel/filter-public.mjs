// Public token_diff account-side events only; these are not completed user swaps or solver identities.
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=value=>typeof value==='string'&&/^-?\d+$/.test(value)&&BigInt(value)>=-(2n**127n)&&BigInt(value)<2n**127n;
const canonical=value=>Array.isArray(value)?value.map(canonical):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const payloadKey=value=>JSON.stringify(canonical(value));
export function filterPublicIntents(rows,{lookbackMinutes=60,returnToleranceBps=500}={}){
  if(!Array.isArray(rows)||!Number.isFinite(lookbackMinutes)||lookbackMinutes<=0||lookbackMinutes>1440||!Number.isInteger(returnToleranceBps)||returnToleranceBps<0||returnToleranceBps>1000)throw new Error('Invalid public-intent filter input');
  const groups=new Map(),events=[],excluded=[],quarantined=[];
  for(const row of rows){
    if(!plain(row)||typeof row.receipt_id!=='string'||!row.receipt_id||!Number.isSafeInteger(row.index_in_execution_outcome_logs)||row.index_in_execution_outcome_logs<0){quarantined.push({reason:'INVALID_LOG_KEY'});continue;}
    const key=JSON.stringify([row.receipt_id,row.index_in_execution_outcome_logs]);
    const list=groups.get(key)||[];list.push(row);groups.set(key,list);
  }
  for(const [logKey,list] of groups){
    if(list.some(row=>payloadKey(row)!==payloadKey(list[0]))){quarantined.push({logKey,reason:'CONFLICTING_LOG_VERSIONS',rows:list.length});continue;}
    const row=list[0];
    if(list.length>1)excluded.push({logKey,reason:'EXACT_INGESTION_DUPLICATE',rows:list.length-1});
    if(row.executor_account_id!=='intents.near'||typeof row.execution_status!=='string'||!row.execution_status.startsWith('SUCCESS')){excluded.push({logKey,reason:'OUT_OF_SCOPE_OR_UNSUCCESSFUL'});continue;}
    let envelope;try{envelope=typeof row.event==='string'?JSON.parse(row.event):row.event;}catch{quarantined.push({logKey,reason:'INVALID_EVENT_JSON'});continue;}
    if(!plain(envelope)||envelope.standard!=='dip4'||envelope.event!=='token_diff'){excluded.push({logKey,reason:'NOT_PUBLIC_TOKEN_DIFF'});continue;}
    if(!Array.isArray(envelope.data)||envelope.data.length===0){quarantined.push({logKey,reason:'INVALID_EVENT_DATA'});continue;}
    const time=typeof row.block_time==='string'&&/Z$|[+-]\d{2}:\d{2}$/.test(row.block_time)?Date.parse(row.block_time):NaN;
    for(const [ordinal,data] of envelope.data.entries()){
      const key=JSON.stringify([row.receipt_id,row.index_in_execution_outcome_logs,ordinal]);
      if(!plain(data)||typeof data.account_id!=='string'||!data.account_id||typeof data.intent_hash!=='string'||!data.intent_hash||!plain(data.diff)||Object.keys(data.diff).length===0||Object.entries(data.diff).some(([token,delta])=>!token||!integer(delta)||BigInt(delta)===0n)){quarantined.push({key,reason:'INVALID_TOKEN_DIFF'});continue;}
      const deltas=Object.entries(data.diff),negative=deltas.filter(([,value])=>BigInt(value)<0n),positive=deltas.filter(([,value])=>BigInt(value)>0n);
      const pair=deltas.length===2&&negative.length===1&&positive.length===1?{inputToken:negative[0][0],inputRaw:(-BigInt(negative[0][1])).toString(),outputToken:positive[0][0],outputRaw:positive[0][1]}:null;
      const fees=plain(data.fees_collected)&&Object.entries(data.fees_collected).every(([token,amount])=>token&&integer(amount)&&BigInt(amount)>=0n)?data.fees_collected:null;
      events.push({key,logKey,eventVersion:typeof envelope.version==='string'?envelope.version:null,accountId:data.account_id,intentHash:data.intent_hash,diff:data.diff,feesCollected:fees,referral:typeof data.referral==='string'?data.referral:null,time:Number.isFinite(time)?time:null,pair,flags:[],behaviorAssessable:!!pair&&Number.isFinite(time)});
    }
  }
  events.sort((a,b)=>(a.time??Infinity)-(b.time??Infinity)||a.key.localeCompare(b.key));
  const unmatched=new Map();
  for(const event of events){
    if(!event.behaviorAssessable)continue;
    const {inputToken,outputToken,outputRaw}=event.pair;
    const reverse=JSON.stringify([event.accountId,outputToken,inputToken]);
    const previous=unmatched.get(reverse);
    if(previous&&event.time>previous.time&&event.time-previous.time<=lookbackMinutes*60000){
      const original=BigInt(previous.pair.inputRaw),returned=BigInt(outputRaw),difference=original>returned?original-returned:returned-original;
      if(difference*10000n<=original*BigInt(returnToleranceBps)){
        for(const candidate of [previous,event])candidate.flags.push('REVERSE_PUBLIC_ACCOUNT_PATTERN');
        unmatched.delete(reverse);continue;
      }
    }
    // shortcut: retains only the latest unmatched exact route per account; use bounded queues for exhaustive sequence diagnostics.
    unmatched.set(JSON.stringify([event.accountId,inputToken,outputToken]),event);
  }
  return {grain:'Public successful token_diff account-side event; not user swap',events,excluded,quarantined,summary:{inputRows:rows.length,acceptedPublicEvents:events.length,flaggedPublicEvents:events.filter(event=>event.flags.length>0).length,unassessablePublicEvents:events.filter(event=>!event.behaviorAssessable).length,behavioralExclusions:0},parameters:{lookbackMinutes,returnToleranceBps}};
}
