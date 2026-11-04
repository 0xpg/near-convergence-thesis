import React,{useLayoutEffect,useRef} from 'react';
import OverviewScene from './OverviewScene.jsx';
import InvestmentFramework from './InvestmentFramework.jsx';
import DuneGlance from './DuneGlance.jsx';
import {startTypeDither} from './overview/type-dither.mjs';
import {startIntroField} from './overview/intro-field.mjs';

export default function ThesisPage(){
  const heading=useRef(),canvas=useRef(),field=useRef();
  useLayoutEffect(()=>startTypeDither(canvas.current,heading.current),[]);
  useLayoutEffect(()=>startIntroField(field.current),[]);
  return <div className="thesis-page">
    <a className="tidal-skip" href="#network">Skip introduction</a>
    <header className="tidal-header thesis-header"><a className="tidal-brand" href="index.html" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="thesis.html" aria-current="page">Thesis</a><a href="lab.html">Scenario lab</a><a href="report.html">Report</a></nav><a className="tidal-close" href="index.html">Close</a></header>
    <main>
      <section className="thesis-intro" aria-labelledby="thesis-title">
        <canvas className="thesis-intro-field" ref={field} aria-hidden="true"/>
        <div className="thesis-intro-copy">
          <p>NEAR is building a path from machine intent to economic action.</p>
          <div className="thesis-resolve"><canvas ref={canvas} aria-hidden="true"/><h1 id="thesis-title" ref={heading}><span>Intelligence</span><span>meets execution.</span></h1></div>
        </div>
      </section>
      <div className="thesis-green-chapter">
      <section className="thesis-proposition" aria-labelledby="thesis-proposition-title">
        <h2 id="thesis-proposition-title" className="tidal-sr">The convergence thesis</h2>
        <p>AI can decide what to do. Acting on those decisions is a different problem.</p>
        <p>NEAR’s proposition is to connect machine intent with execution across blockchain networks.</p>
        <p>The thesis starts with that connection. The investment case depends on whether it creates lasting demand for NEAR.</p>
      </section>
      <InvestmentFramework/>
      <section className="thesis-proposition thesis-approach" aria-labelledby="approach-title">
        <h2 id="approach-title">From expectations to mechanisms</h2>
        <p>Crypto markets price expectations. We look for the mechanisms that could turn those expectations into durable token demand.</p>
        <p>For NEAR, that means starting with the architecture: what each layer does, who uses it, and where value can flow.</p>
      </section>
      </div>
      <section id="network" className="thesis-network" aria-label="NEAR infrastructure map"><OverviewScene/></section>
      <DuneGlance/>
    </main>
  </div>;
}
