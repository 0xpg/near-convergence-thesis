import React,{useLayoutEffect,useRef} from 'react';
import {startTypeDither} from './type-dither.mjs';
export default function Resolve(){const heading=useRef(),canvas=useRef();useLayoutEffect(()=>startTypeDither(canvas.current,heading.current),[]);return <div className="opening-resolve">
  <p className="opening-kicker">A different kind of network user</p>
  <div className="resolve-type"><canvas ref={canvas} aria-hidden="true"/><h1 ref={heading}><span>When intelligence</span><span>starts to transact.</span></h1></div>
  <div className="resolve-bottom"><p className="opening-deck">NEAR’s thesis begins where AI decisions meet blockchain execution.</p><p className="opening-note">Explore the network before judging the investment case.</p></div>
</div>;}
