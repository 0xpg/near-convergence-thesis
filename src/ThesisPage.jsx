import React,{useLayoutEffect,useRef} from 'react';
import OverviewScene from './OverviewScene.jsx';
import InvestmentFramework from './InvestmentFramework.jsx';
import DuneGlance from './DuneGlance.jsx';
import KineticStatement from './KineticStatement.jsx';
import {startTypeDither} from './overview/type-dither.mjs';
import {startIntroField} from './overview/intro-field.mjs';

export default function ThesisPage(){
  const heading=useRef(),canvas=useRef(),field=useRef(),closing=useRef(),closingCanvas=useRef();
  useLayoutEffect(()=>startTypeDither(canvas.current,heading.current),[]);
  useLayoutEffect(()=>startIntroField(field.current),[]);
  useLayoutEffect(()=>startTypeDither(closingCanvas.current,closing.current),[]);
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
      <section className="thesis-proposition thesis-convergence" aria-labelledby="thesis-proposition-title">
        <h2 id="thesis-proposition-title" className="tidal-sr">The convergence thesis</h2>
        <p>AI can decide what to do. Acting on those decisions is a different problem.</p>
        <p>NEAR’s proposition is to connect machine intent with execution across blockchain networks.</p>
        <p>The thesis starts with that connection. The investment case depends on whether it creates lasting demand for NEAR.</p>
      </section>
      <InvestmentFramework/>
      <section className="thesis-proposition thesis-approach" aria-labelledby="approach-title">
        <h2 id="approach-title">From expectations to mechanisms</h2>
        <KineticStatement text="Crypto prices expectations. We look for the mechanisms behind durable token demand."/>
        <KineticStatement text="Start with NEAR’s architecture: its layers, its users, and the path value takes."/>
      </section>
      <section id="network" className="thesis-network" aria-label="NEAR infrastructure map"><OverviewScene/></section>
      <DuneGlance/>
      <section className="thesis-finale" aria-labelledby="finale-title">
        <div className="thesis-finale-type"><div className="thesis-resolve"><canvas ref={closingCanvas} aria-hidden="true"/><h2 id="finale-title" ref={closing}><span>Convergence</span></h2></div></div>
        <div className="thesis-finale-action"><a href="report.html">Read the full report</a></div>
      </section>
    </main>
  </div>;
}
