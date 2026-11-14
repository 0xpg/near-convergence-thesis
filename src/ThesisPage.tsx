import {useLayoutEffect,useRef} from 'react';
import OverviewScene from './OverviewScene.tsx';
import InvestmentFramework from './InvestmentFramework.tsx';
import DuneGlance from './DuneGlance.tsx';
import KineticStatement from './KineticStatement.tsx';
import {startTypeDither} from './overview/type-dither.ts';
import {startIntroField} from './overview/intro-field.ts';
import {startDitherEmphasis} from './overview/dither-emphasis.ts';

export default function ThesisPage(){
  const heading=useRef<HTMLHeadingElement>(null),canvas=useRef<HTMLCanvasElement>(null),field=useRef<HTMLCanvasElement>(null),closing=useRef<HTMLHeadingElement>(null),closingCanvas=useRef<HTMLCanvasElement>(null),reading=useRef<HTMLElement>(null);
  useLayoutEffect(()=>canvas.current&&heading.current?startTypeDither(canvas.current,heading.current):undefined,[]);
  useLayoutEffect(()=>field.current?startIntroField(field.current):undefined,[]);
  useLayoutEffect(()=>closingCanvas.current&&closing.current?startTypeDither(closingCanvas.current,closing.current):undefined,[]);
  useLayoutEffect(()=>reading.current?startDitherEmphasis(reading.current):undefined,[]);
  return <div className="thesis-page">
    <a className="tidal-skip" href="#network">Skip introduction</a>
    <header className="tidal-header thesis-header"><a className="tidal-brand" href="/" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="/thesis" aria-current="page">Thesis</a><a href="/scenario-labs">Scenario lab</a></nav><a className="tidal-close" href="/">Home</a></header>
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
        <p>AI is a tool that helps augment human work, a co-creator that helps shape and respond to inquiries and takes on aspects of human work. The full potential of generative AI is still unfolding as offerings improve and become integrated into ever more aspects of daily life. In parallel, institutional capital is moving onchain as tokenized assets and stablecoins become integrated into existing trading workflows.</p>
        <p>As its influence grows, the importance of AI as an investment driver is undeniable. To capture the AI growth opportunity today, most investors buy shares of AI-aligned companies and related verticals, while institutional exposure to digital assets still runs largely through ETFs and custodial wrappers. <strong>We believe the asymmetric opportunity sits in the infrastructure that settles activity between machines, and between institutions moving onchain.</strong></p>
        <p>Enabling these machine-to-machine transactions requires secure, autonomous, verifiable, and high-throughput record-keeping. We believe blockchains and crypto technologies are likely to become the foundational delivery layer for these transactions based on the following attributes:</p>
        <ul>
          <li>Autonomous Contract Creation / Fulfillment</li>
          <li>Verifiable Identity &amp; Compliance</li>
          <li>Auditability</li>
          <li>Access to Decentralized Computing &amp; Data</li>
          <li>Fast, Final Settlement</li>
        </ul>
        <p><strong>Given these attributes, blockchain will be pivotal in allowing institutional capital moving onchain and generative AI to realize its potential for consumer transactions—the “killer” use case that drives blockchain adoption.</strong></p>
      </section>
      <InvestmentFramework/>
      <section className="thesis-proposition thesis-approach" aria-labelledby="approach-title">
        <h2 id="approach-title" className="tidal-sr">Research approach</h2>
        <KineticStatement text="Crypto prices expectations. We look for the mechanisms behind durable token demand."/>
        <KineticStatement text="To understand what may endure, follow the systems that turn intention into economic activity."/>
      </section>
      <section id="network" className="thesis-network" aria-label="NEAR infrastructure map"><OverviewScene/></section>
      <div className="thesis-chapter-divider" aria-hidden="true"/>
      <DuneGlance/>
      <section className="thesis-finale" aria-labelledby="finale-title">
        <div className="thesis-finale-type"><div className="thesis-resolve"><canvas ref={closingCanvas} aria-hidden="true"/><h2 id="finale-title" ref={closing}><span>Convergence</span></h2></div></div>
        <div className="thesis-finale-action"><a href="/scenario-labs">Open the Scenario Lab</a></div>
      </section>
    </main>
  </div>;
}
