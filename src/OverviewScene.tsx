import {useLayoutEffect,useRef,useState} from 'react';
import {startAbsorption} from './overview/absorption.ts';
import nearWordmark from '../assets/identity/near.svg';

export const topics=[
  {title:'Settlement'},
  {title:'Intents'},
  {title:'Solver competition'},
  {title:'Chain Signatures'},
  {title:'Accounts & access'},
  {title:'Institutional execution'},
  {title:'AI infrastructure'},
  {title:'Applications'},
  {title:'Developer tooling'},
  {title:'Security & governance'}
];
export default function OverviewScene(){
  const canvas=useRef<HTMLCanvasElement>(null),field=useRef<HTMLDivElement>(null),animation=useRef<ReturnType<typeof startAbsorption>|null>(null);
  const [size,setSize]=useState({width:640,height:640}),[selected,setSelected]=useState(-1);
  useLayoutEffect(()=>{const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));if(field.current)observer.observe(field.current);return()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{if(!canvas.current)return;const scene=startAbsorption(canvas.current,1,setSelected);animation.current=scene;return()=>{animation.current=null;scene.destroy();};},[]);
  function choose(index:number,pin=false){animation.current?.select(index,pin);}
  return <div className={'tidal-page '+(selected>=0?'is-focused':'')} onKeyDown={event=>{if(event.key==='Escape'&&!event.defaultPrevented)choose(-1,true);}}>
    <header className="tidal-header"><a className="tidal-brand" href="/" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="/thesis" aria-current="page">Thesis</a><a href="/scenario-labs">Scenario lab</a></nav><a className="tidal-close" href="/">Home</a></header>
    <div className="tidal-editorial tidal-editorial-start"><h2>The systems <br/>behind the promise.</h2><p>Execution, coordination, liquidity and settlement shape how NEAR could serve autonomous agents and institutional markets alike.</p></div>
    <section id="tidal-main" className="tidal-main"><h2 className="tidal-sr">NEAR overview</h2><div className="tidal-field" ref={field}>
      <canvas ref={canvas} tabIndex={0} aria-label="Animated NEAR category map. Hover to preview a category. Click or tap to keep it open. Left and right keys select categories; Escape restores the overview."/>
      <section className="tidal-premise" aria-label="Blockchain and AI convergence">
        <img src={nearWordmark} alt="NEAR" width="64" height="16"/>
        <svg className="tidal-convergence" viewBox="0 0 224 112" role="img" aria-label="Blockchain and AI converge in a shared intersection">
          <defs>
            <pattern id="blockchain-dither" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="1.5" height="1.5" fill="#567967"/><rect x="3" y="3" width="1" height="1" fill="#567967" opacity=".45"/></pattern>
            <pattern id="ai-dither" width="5" height="5" patternUnits="userSpaceOnUse"><rect x="2" width="1.5" height="1.5" fill="#7a7895"/><rect y="3" width="1" height="1" fill="#7a7895" opacity=".45"/></pattern>
            <pattern id="convergence-dither" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#365c49"/><rect x="2" y="2" width="1" height="1" fill="#365c49"/></pattern>
            <clipPath id="convergence-overlap"><circle cx="88" cy="44" r="40"/></clipPath>
          </defs>
          <circle cx="88" cy="44" r="40" fill="url(#blockchain-dither)"/>
          <circle cx="136" cy="44" r="40" fill="url(#ai-dither)"/>
          <circle cx="136" cy="44" r="40" clipPath="url(#convergence-overlap)" fill="url(#convergence-dither)"/>
          <text x="70" y="106" textAnchor="middle">Blockchain</text><text x="154" y="106" textAnchor="middle">AI</text>
        </svg>
      </section>
      <div className="tidal-topics" aria-label="NEAR overview categories">{topics.map((topic,index)=>{const angle=-Math.PI/2+index*Math.PI*2/topics.length,radius=Math.min(size.width,size.height)*.465;return <button key={topic.title} aria-pressed={selected===index} onPointerEnter={event=>{if(event.pointerType!=='touch')choose(index);}} onPointerDown={()=>choose(index,true)} onPointerLeave={()=>choose(-1)} onPointerUp={event=>{if(event.pointerType!=='mouse')choose(-1);}} onPointerCancel={()=>choose(-1)} onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))choose(index);}} onBlur={()=>choose(-1)} onClick={()=>choose(index,true)} style={{left:Math.max(64,Math.min(size.width-64,size.width/2+Math.cos(angle)*radius)),top:size.height/2+Math.sin(angle)*radius}}>{topic.title}</button>;})}</div>
    </div></section>
    <div className="tidal-editorial tidal-editorial-end"><h2>A proposition <br/>to be tested.</h2><p>The next step is to ask whether these capabilities attract sustained use, committed capital and revenue.</p></div>
  </div>;
}
