import React,{useLayoutEffect,useRef} from 'react';
import OverviewScene from './OverviewScene.jsx';
import InvestmentFramework from './InvestmentFramework.jsx';
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
      <section className="thesis-proposition" aria-labelledby="thesis-proposition-title">
        <h2 id="thesis-proposition-title" className="tidal-sr">The convergence thesis</h2>
        <p>AI can decide what to do. Acting on those decisions is a different problem.</p>
        <p>NEAR’s proposition is to connect machine intent with execution across blockchain networks.</p>
        <p>The thesis starts with that connection. The investment case depends on whether it creates lasting demand for NEAR.</p>
      </section>
      <section id="network" className="thesis-network" aria-label="NEAR infrastructure map"><OverviewScene/></section>
      <InvestmentFramework/>
      <section className="thesis-data" aria-labelledby="thesis-data-title">
        <header><h2 id="thesis-data-title">NEAR at a glance</h2><p>Awaiting supplied data.</p></header>
        <div className="thesis-data-grid" aria-hidden="true"><div/><div/><div/><div/></div>
      </section>
    </main>
  </div>;
}
