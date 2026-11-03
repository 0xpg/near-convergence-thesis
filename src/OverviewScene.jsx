import React,{useLayoutEffect,useRef,useState} from 'react';
import {startAbsorption} from './overview/absorption.mjs';
import nearWordmark from '../assets/identity/near.svg';

export const topics=[
  {title:'Revenue',children:['Fees generated','Protocol revenue','Revenue vs emissions','Wallet breakdown']},
  {title:'Ecosystem',children:['NEAR Intents','Base-chain activity','Token overview','Protocol']},
  {title:'Products',children:['Blockchain','Near.com','NEAR Intents','NEAR AI','House of Stake']}
];
export default function OverviewScene(){
  const canvas=useRef(),field=useRef(),animation=useRef();
  const [size,setSize]=useState({width:640,height:640}),[selected,setSelected]=useState(-1);
  useLayoutEffect(()=>{const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(field.current);return()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{const scene=startAbsorption(canvas.current,1,setSelected);animation.current=scene;return()=>{animation.current=null;scene.destroy();};},[]);
  function choose(index,pin=false){animation.current?.select(index,pin);}
  return <div className={'tidal-page '+(selected>=0?'is-focused':'')} onKeyDown={event=>{if(event.key==='Escape'&&!event.defaultPrevented)choose(-1,true);}}>
    <a className="tidal-skip" href="#tidal-main">Skip to overview</a>
    <header className="tidal-header"><a className="tidal-brand" href="index.html" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="thesis.html" aria-current="page">Thesis</a><a href="lab.html">Scenario lab</a><a href="report.html">Report</a></nav><a className="tidal-close" href="index.html">Close</a></header>
    <main id="tidal-main" className="tidal-main"><h1 className="tidal-sr">NEAR overview</h1><div className="tidal-field" ref={field}>
      <canvas ref={canvas} tabIndex="0" aria-label="Animated NEAR category map. Hover to preview a category. Click or tap to keep it open. Left and right keys select categories; Escape restores the overview."/>
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
      {selected>=0&&<aside className="tidal-subtopics" aria-label={topics[selected].title+' subcategories'} aria-live="polite"><h2>{topics[selected].title}</h2><ul>{topics[selected].children.map(title=><li key={title}>{title}</li>)}</ul></aside>}
    </div></main>
    <footer className="tidal-footer"><span aria-live="polite">{selected>=0?topics[selected].title+' · Focus':'Hover or touch a category'}</span>{selected>=0?<button onClick={()=>choose(-1,true)}>All categories</button>:<span>Topic map · not to scale</span>}</footer>
  </div>;
}
