import React,{useState} from 'react';
export const beats=[
  {title:'A decision is not a transaction.',copy:'AI can interpret intent. Economic action still needs execution.',stage:'Intent'},
  {title:'Intent needs a path to execution.',copy:'NEAR Intents is one attempt to connect the two.',stage:'Coordination'},
  {title:'Why should NEAR matter to that shift?',copy:'Begin with the products, activity and economics behind the proposition.',stage:'Evidence'}
];
export default function Sequence(){const [step,setStep]=useState(0),beat=beats[step];return <div className="opening-sequence">
  <div className="sequence-top"><p className="opening-kicker">{beat.stage}</p><div className="sequence-progress" aria-label={`Statement ${step+1} of ${beats.length}`}>{beats.map((item,index)=><span key={item.stage} className={index<=step?'seen':''}/>)}</div></div>
  <div className="sequence-reading" key={step} aria-live="polite"><h1>{beat.title}</h1><p className="opening-deck">{beat.copy}</p></div>
  <div className="sequence-bottom"><div className="sequence-rail" aria-hidden="true"><i/><span/><i/><span/><i/></div>{step<beats.length-1?<button className="opening-action" onClick={()=>setStep(step+1)}>Continue</button>:<a className="opening-action" href="#evidence">Examine NEAR</a>}</div>
</div>;}
