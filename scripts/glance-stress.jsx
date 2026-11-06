import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import DuneGlance from '../src/DuneGlance.jsx';
import evidence from '../data/glance-insights.json';
import '../styles.css';
import '../fonts.css';

const worst=Object.fromEntries(Object.entries(evidence.insights).map(([id,item],index)=>[id,{
  ...item,value:index%2?'0 NEAR':'1,310,884,624.973014749817910636802365 NEAR',
  headline:'Tracked cross-chain execution and settlement activity across the full available reporting period.',
  limitation:item.limitation+' Reference: https://example.com/research/near-protocol/cross-chain-execution-and-settlement-methodology',
}]));
function StressCheck(){
  const [mode,setMode]=useState(new URLSearchParams(location.search).get('data')||'demo');
  return <><div className="thesis-page"><DuneGlance insights={mode==='worst'?worst:mode==='empty'?{}:evidence.insights}/></div>
    <div style={{position:'fixed',bottom:12,left:'50%',transform:'translateX(-50%)',zIndex:100,display:'flex',gap:4,padding:4,background:'#e5e7e5',borderRadius:8}}>
      {['demo','worst','empty'].map(value=><button key={value} aria-pressed={mode===value} onClick={()=>{history.replaceState(null,'','?data='+value);setMode(value);}}>{value==='demo'?'Demo data':value==='worst'?'Worst case':'Missing insights'}</button>)}
    </div></>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')).render(<StressCheck/>);
