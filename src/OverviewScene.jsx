import React,{useLayoutEffect,useRef,useState} from 'react';
import {startAbsorption} from './overview/absorption.mjs';
import nearWordmark from '../assets/identity/near.svg';

const topics=['Network activity','Accounts & users','Capital & liquidity','DeFi markets','Applications','Intents','AI & agents','Developers','Validators','Token economics'];
export default function OverviewScene(){
  const canvas=useRef(),field=useRef(),animation=useRef();
  const [size,setSize]=useState({width:640,height:640}),[selected,setSelected]=useState(-1);
  useLayoutEffect(()=>{const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(field.current);return()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{const scene=startAbsorption(canvas.current,1,setSelected);animation.current=scene;return()=>{animation.current=null;scene.destroy();};},[]);
  function choose(index){animation.current?.select(index);}
  return <div className={'tidal-page '+(selected>=0?'is-focused':'')} onKeyDown={event=>{if(event.key==='Escape'&&!event.defaultPrevented)choose(-1);}}>
    <a className="tidal-skip" href="#tidal-main">Skip to overview</a>
    <header className="tidal-header"><a className="tidal-brand" href="index.html" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="thesis.html" aria-current="page">Thesis</a><a href="lab.html">Scenario lab</a><a href="report.html">Report</a></nav><a className="tidal-close" href="index.html">Close</a></header>
    <main id="tidal-main" className="tidal-main"><h1 className="tidal-sr">NEAR overview</h1><div className="tidal-field" ref={field}>
      <canvas ref={canvas} tabIndex="0" aria-label="Animated NEAR category map. Hover over or touch a cluster to focus. Left and right keys select categories; Escape restores the overview."/>
      <section className="tidal-premise" aria-label="Investment premise">
        <img src={nearWordmark} alt="NEAR" width="80" height="20"/>
        <h2>AI agents need<br/>economic rails.</h2>
        <p>The investment case for NEAR.</p>
        <ol className="tidal-progression" aria-label="From search to answers to action">
          <li><span>Search</span><strong>Google</strong></li>
          <li><span>Answers</span><strong>LLMs</strong></li>
          <li><span>Action</span><strong>AI agents</strong></li>
        </ol>
      </section>
      <div className="tidal-topics" aria-label="NEAR overview categories">{topics.map((topic,index)=>{const angle=-Math.PI/2+index*Math.PI/5,radius=Math.min(size.width,size.height)*.465;return <button key={topic} aria-pressed={selected===index} onPointerEnter={event=>{if(event.pointerType!=='touch')choose(index);}} onPointerDown={()=>choose(index)} onPointerLeave={()=>choose(-1)} onPointerUp={event=>{if(event.pointerType!=='mouse')choose(-1);}} onPointerCancel={()=>choose(-1)} onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))choose(index);}} onBlur={()=>choose(-1)} onClick={event=>{if(event.detail===0)choose(index);}} style={{left:Math.max(64,Math.min(size.width-64,size.width/2+Math.cos(angle)*radius)),top:size.height/2+Math.sin(angle)*radius}}>{topic}</button>;})}</div>
    </div></main>
    <footer className="tidal-footer"><span aria-live="polite">{selected>=0?topics[selected]+' · Focus':'Hover or touch a category'}</span><span>Topic map · not to scale</span></footer>
  </div>;
}
