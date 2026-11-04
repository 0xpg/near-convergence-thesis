import React,{useLayoutEffect,useRef} from 'react';
import OverviewScene from './OverviewScene.jsx';
import {startTypeDither} from './overview/type-dither.mjs';
import {convergenceArt} from './overview/convergence-art.mjs';

const art=convergenceArt();

export default function ThesisPage(){
  const heading=useRef(),canvas=useRef();
  useLayoutEffect(()=>startTypeDither(canvas.current,heading.current),[]);
  return <div className="thesis-page">
    <a className="tidal-skip" href="#network">Skip introduction</a>
    <header className="tidal-header thesis-header"><a className="tidal-brand" href="index.html" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="thesis.html" aria-current="page">Thesis</a><a href="lab.html">Scenario lab</a><a href="report.html">Report</a></nav><a className="tidal-close" href="index.html">Close</a></header>
    <main>
      <section className="thesis-intro" aria-labelledby="thesis-title">
        <svg className="thesis-dither-art" viewBox="0 0 800 340" aria-hidden="true" focusable="false">
          <g className="thesis-dither-weave">
            {art.map((path,index)=><path key={index} d={path} fill={index<3?'#3d6856':'#627b87'} opacity={[.28,.65,.95][index%3]}/>)}
          </g>
        </svg>
        <div className="thesis-intro-copy">
          <p>NEAR is building a path from machine intent to economic action.</p>
          <div className="thesis-resolve"><canvas ref={canvas} aria-hidden="true"/><h1 id="thesis-title" ref={heading}><span>Intelligence</span><span>meets execution.</span></h1></div>
        </div>
      </section>
      <section id="network" className="thesis-network" aria-label="NEAR network and evidence map"><OverviewScene/></section>
    </main>
  </div>;
}
