import React,{useLayoutEffect,useRef} from 'react';
import OverviewScene from './OverviewScene.jsx';
import {startTypeDither} from './overview/type-dither.mjs';

export default function ThesisPage(){
  const heading=useRef(),canvas=useRef();
  useLayoutEffect(()=>startTypeDither(canvas.current,heading.current),[]);
  return <div className="thesis-page">
    <a className="tidal-skip" href="#network">Skip introduction</a>
    <header className="tidal-header thesis-header"><a className="tidal-brand" href="index.html" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="thesis.html" aria-current="page">Thesis</a><a href="lab.html">Scenario lab</a><a href="report.html">Report</a></nav><a className="tidal-close" href="index.html">Close</a></header>
    <main>
      <section className="thesis-intro" aria-labelledby="thesis-title">
        <svg className="thesis-dither-art" viewBox="0 0 800 320" aria-hidden="true" focusable="false">
          <defs>
            <pattern id="intro-stipple" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#597463"/><rect x="3" y="3" width="1" height="1" fill="#597463"/></pattern>
            <linearGradient id="intro-density" x1="0" y1="0" x2="1" y2="1"><stop stopColor="white" stopOpacity="0"/><stop offset=".3" stopColor="white"/><stop offset=".7" stopColor="white" stopOpacity=".65"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
            <mask id="intro-fade"><rect width="800" height="320" fill="url(#intro-density)"/></mask>
          </defs>
          <g fill="url(#intro-stipple)" mask="url(#intro-fade)">
            <path d="M60 222C145 24 309 3 441 130S665 301 770 91L746 81C640 244 562 226 455 113S191-27 60 222Z"/>
            <path opacity=".55" d="M72 114C240 303 355 301 469 135S666 5 781 194L765 212C661 54 583 30 488 151S258 338 72 114Z"/>
            <path opacity=".3" d="M98 251C218 61 331 53 451 163S652 276 736 121L726 117C625 251 554 230 464 145S228 10 98 251Z"/>
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
