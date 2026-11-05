import React,{useLayoutEffect,useRef} from 'react';
import OverviewScene from './OverviewScene.jsx';
import InvestmentFramework from './InvestmentFramework.jsx';
import DuneGlance from './DuneGlance.jsx';
import KineticStatement from './KineticStatement.jsx';
import {startTypeDither} from './overview/type-dither.mjs';
import {startIntroField} from './overview/intro-field.mjs';
import {startDitherEmphasis} from './overview/dither-emphasis.mjs';

export default function ThesisPage(){
  const heading=useRef(),canvas=useRef(),field=useRef(),closing=useRef(),closingCanvas=useRef(),reading=useRef();
  useLayoutEffect(()=>startTypeDither(canvas.current,heading.current),[]);
  useLayoutEffect(()=>startIntroField(field.current),[]);
  useLayoutEffect(()=>startTypeDither(closingCanvas.current,closing.current),[]);
  useLayoutEffect(()=>startDitherEmphasis(reading.current),[]);
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
      <section className="thesis-proposition thesis-convergence" ref={reading} aria-labelledby="thesis-proposition-title">
        <h2 id="thesis-proposition-title" className="tidal-sr">The convergence thesis</h2>
        <p>AI is a tool that helps augment human work, a co-creator that helps shape and respond to inquiries and takes on aspects of human work. The full potential of generative AI is still unfolding as offerings improve and become integrated into ever more aspects of daily life.</p>
        <p>As its influence grows, the importance of AI as an investment driver is undeniable. To capture the AI growth opportunity today, most investors buy shares of AI-aligned companies and related verticals. <strong>We believe there are asymmetric opportunities worth exploring in the digital asset realm, especially blockchain’s facilitation of machine-to-machine transactions.</strong></p>
        <p>Enabling these machine-to-machine transactions requires secure, autonomous, verifiable, and high-throughput record-keeping. We believe blockchains and crypto technologies are likely to become the foundational delivery layer for these transactions based on the following attributes:</p>
        <ul>
          <li>Autonomous Contract Creation / Fulfillment</li>
          <li>Decentralized Identity Verification</li>
          <li>Auditability</li>
          <li>Access to Decentralized Computing &amp; Data</li>
          <li>Speed and Fulfillment</li>
        </ul>
        <p><strong>Given these attributes, blockchain will be pivotal in allowing generative AI to realize its potential for consumer transactions, and the growth of agentic AI is likely to become the “killer” use case that drives blockchain adoption.</strong></p>
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
