import {Fragment,useEffect,useState} from 'react';
import {defaults,modelVersion,formulas,calculate} from '../analysis/model.mjs';
import {controls,presets,scenarioResult} from './widget-config.ts';

const money=value=>value===null?'Not computable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value);
const displayValue=value=>typeof value==='number'&&Number.isFinite(value)?String(Math.round(value*100)/100):value;

function useSavedJson<T=any>(path:string,validate?:(data:T)=>void) {
  const [state,setState]=useState<{data:T|null,error:boolean}>({data:null,error:false});
  useEffect(()=>{
    const controller=new AbortController();
    fetch(path,{signal:controller.signal}).then(response=>{
      if(!response.ok)throw new Error('Saved data unavailable');
      return response.json();
    }).then(data=>{
      validate?.(data);
      setState({data,error:false});
    }).catch(error=>{if(error.name!=='AbortError')setState({data:null,error:true});});
    return ()=>controller.abort();
  },[path,validate]);
  return state;
}

const validateSnapshot=data=>calculate({},data);
const validateMonthly=data=>{if(!Array.isArray(data.monthly)||!data.monthly.every(row=>typeof row.month==='string'&&[row.volume,row.grossFees,row.walletReceipts].every(Number.isFinite)))throw new Error('Invalid monthly snapshot');};
const validateCurrent=data=>{if(!Number.isFinite(data.priceUsd)||typeof data.priceUpdatedUtc!=='string')throw new Error('Invalid quote');};
const validateLedger=data=>{if(!Array.isArray(data.claims)||!Array.isArray(data.sources)||!data.claims.every(claim=>Array.isArray(claim.sources)))throw new Error('Invalid ledger');};

export function ScenarioExperience() {
  const saved=useSavedJson('data/inputs.json',validateSnapshot);
  type Result=ReturnType<typeof calculate>;
  const [scenario,setScenario]=useState<{values:Record<string,number|string>,result:Result|null,preset:string,error:string}>({values:{...defaults},result:null,preset:'unverified',error:''});
  useEffect(()=>{
    if(saved.data){const result=calculate({},saved.data);setScenario({values:result.inputs,result,preset:'unverified',error:''});}
  },[saved.data]);
  const snapshot=saved.data,result=scenario.result,disabled=!snapshot||saved.error;
  function rerun(values,preset='') {
    try{const result=scenarioResult(values,snapshot);setScenario({values,result,preset,error:''});}
    catch(error){setScenario(previous=>({...previous,values,preset,error:error instanceof Error?error.message:String(error)}));}
  }
  function selectPreset(name) {rerun({...calculate({},snapshot).inputs,...presets[name].inputs},name);}
  function exportResult() {
    if(!result||scenario.error)return;
    const output={exportedAt:new Date().toISOString(),note:'Hypothetical scenario, not a price target. Purchases and retention are not measured.',snapshot,...result};
    const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='near-scenario-'+modelVersion+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const status=saved.error?'The saved model inputs could not be loaded. Refresh this page from the local server; the report and source downloads remain available.':scenario.error||(result?'':'Loading documented snapshot and shared calculation engine…');
  return <>
    <div id="model-status" role="status" className={saved.error||scenario.error?'error':''}>{status}</div>
    <div className="lab-layout">
      <form id="scenario-form" onSubmit={event=>event.preventDefault()} onReset={event=>{event.preventDefault();if(snapshot)selectPreset('unverified');}}>
        <div className="presets" aria-label="Scenario presets">{Object.entries(presets).map(([name,preset])=><button key={name} type="button" data-preset={name} aria-pressed={scenario.preset===name} disabled={disabled} onClick={()=>selectPreset(name)}>{preset.label}</button>)}</div>
        <div id="model-controls">{controls.map(([key,label,help,min,max])=><div className="control" key={key}><label htmlFor={key}>{label}<small id={key+'-help'}>{help}</small></label><input id={key} name={key} type="number" required min={min} max={max} step="any" value={displayValue(scenario.values[key])} aria-describedby={key+'-help'} disabled={disabled} onChange={event=>rerun({...scenario.values,[key]:event.target.value})}/></div>)}</div>
        <div className="actions"><button type="reset" disabled={disabled}>Reset defaults</button><button type="button" id="export-model" disabled={disabled||!result||Boolean(scenario.error)} onClick={exportResult}>Export inputs &amp; results</button></div>
      </form>
      <div className="lab-results" aria-live="polite" aria-atomic="true">
        <div className="eyebrow">Hypothetical annual run rate</div>
        <div className="result-main"><span>Retained purchases</span><output id="retained">{result?money(result.retainedPurchases):'—'}</output><p id="purchase-note">{!result||result.inputs.purchaseSharePct===0?'Purchase share is unknown. This default credits no unverified purchases; it does not assert measured zero.':`Hypothetical allocation: ${result.inputs.purchaseSharePct}% of after-cost wallet receipts, with ${result.inputs.retentionSharePct}% retained. No holder entitlement is assumed.`}</p></div>
        <dl className="results">
          {[
            ['Annualized service volume','annual-volume',result&&money(result.volume)],
            ['Gross service fees','gross-fees',result&&money(result.grossFees)],
            ['Tracked wallet-receipt proxy','wallet-receipts',result&&money(result.walletReceipts)],
            ['Retained purchases / reference value','absorption',result&&result.absorptionPctOfValue.toFixed(3)+'%'],
            ['Volume required at chosen hurdle','required-volume',result&&(result.requiredVolume===null?'Undefined at zero capture':money(result.requiredVolume))],
            ['Annual maximum issuance','issuance',result&&new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(result.issuanceNear)+' NEAR']
          ].map(([label,id,value])=><div key={id??undefined}><dt>{label}</dt><dd id={id??undefined}>{value||'—'}</dd></div>)}
        </dl>
        <p className="small">Issuance is a ceiling, not forecast selling pressure. Purchases are not token burns. Actual net supply growth is uncomputed.</p>
        <p className="small" id="version-line">{snapshot?`Snapshot ${snapshot.snapshotVersion} · Model ${modelVersion} · Price reference 25 Oct 2026`:'Snapshot and model version load with inputs.'}</p>
      </div>
    </div>
    <details className="formula-block"><summary>Inspect formulas and model boundaries</summary><dl id="formulas">{Object.entries(formulas).map(([name,formula])=><Fragment key={name}><dt>{name}</dt><dd>{formula}</dd></Fragment>)}</dl><p>Additional costs apply only to costs not already reflected in receipts. A zero cost assumption is hypothetical, not measured profitability. Token purchase policy and retention are hypothetical. The 2% default absorption hurdle is an analyst-selected sensitivity, not a required investor return.</p><p>All website outputs and the report's baseline use the same calculation module. Changing source data requires a separate, dated refresh; moving these controls never fetches new data.</p><a href="analysis/model.mjs">Read the calculation engine</a> · <a href="data/inputs.json">Inspect default inputs</a></details>
  </>;
}

export function MonthlyRows() {
  const {data,error}=useSavedJson('data/outputs.json',validateMonthly);
  return <tbody id="monthly-table">{data?data.monthly.map(row=><tr key={row.month}>{[row.month,money(row.volume),money(row.grossFees),money(row.walletReceipts)].map((value,index)=><td key={index}>{value}</td>)}</tr>):<tr><td colSpan={4}>{error?'Saved table unavailable. Download the CSV directly from the link below.':'Loading saved data…'}</td></tr>}</tbody>;
}

export function CurrentObservation() {
  const {data,error}=useSavedJson('data/current.json',validateCurrent);
  return <p id="current-observation" className="small" role="status">{data?`Latest verified observation: $${data.priceUsd.toFixed(2)} · ${data.priceUpdatedUtc.replace('T',' ').replace('+00:00',' UTC')}. Cached, not streaming. The scenario baseline retains the $4.44 historical reference.`:error?'Latest quote unavailable. Historical research and model reference remain accessible.':'Loading separate latest verified observation…'}</p>;
}

export function ClaimLedger() {
  const {data,error}=useSavedJson('data/research.json',validateLedger);
  return <div id="claim-ledger">{data?data.claims.map((claim,index)=><article className="claim-record" key={claim.id||index}><h4>{claim.title}</h4>{[['Claim',claim.claim],['Method',claim.method],['Limitations',claim.limitations],['Potential falsifier',claim.falsifier]].map(([label,value])=><p key={label}><strong>{label}: </strong>{value}</p>)}<p>Sources: {claim.sources.map(id=>{const source=data.sources.find(item=>item.id===id);if(!source)return null;let href;try{const url=new URL(source.url,location.href);if(url.protocol==='https:')href=url.href;}catch{}return <Fragment key={id}><a href={href}>{source.title}</a>{' · '}</Fragment>;})}</p></article>):error?'The ledger could not be loaded. Open the research JSON directly using the download link.':'Loading saved claim definitions…'}</div>;
}

export function DuneExperience() {
  const [state,setState]=useState('idle');
  const messages={idle:'External dashboard not loaded. Saved data below works without Dune or API credentials.',loading:'Loading the external Intents daily-volume chart. It uses publisher definitions and a different cutoff. If blank, blocked or unavailable, use Open dashboard or the saved snapshots. Embedding cannot verify freshness or query success.',loaded:'External frame returned; its contents and last successful execution are controlled by Dune. If blank, blocked or stale, open the dashboard directly or use the saved data. Reported volume does not measure retained customers.',error:'External dashboard could not load. The saved CSV, figures and report remain available.'};
  return <><div className="explore-grid"><div><h3>NEAR Economic</h3><p>Capital, Intents activity and distribution views, with original Dune queries. Dune shows its last successful execution, which can differ from this report's cutoff.</p><div className="actions"><a className="button primary" href="https://dune.com/0xpanatagama/near-economic" target="_blank" rel="noopener noreferrer">Open dashboard</a><button id="load-dune" type="button" disabled={state!=='idle'} onClick={()=>setState('loading')}>Load embedded view</button></div><p id="dune-status" className="small" role="status">{messages[state]}</p></div><div className="data-note"><span className="eyebrow">Snapshot, not a streaming feed</span><dl><dt>Operating window</dt><dd>23 Sep–22 Oct 2026</dd><dt>Supply &amp; price</dt><dd>25 Oct 2026</dd><dt>Channel view</dt><dd>27 Sep–26 Oct 2026</dd><dt>Prepared</dt><dd>02 Nov 2026</dd></dl><a href="data/manifest.json">Inspect provenance manifest</a></div></div><CurrentObservation/><div id="dune-frame">{state!=='idle'&&<iframe title="External NEAR Economic on Dune" src="https://dune.com/embeds/9074920/13123827" loading="lazy" referrerPolicy="no-referrer" onLoad={()=>setState('loaded')} onError={()=>setState('error')}/>}</div></>;
}
