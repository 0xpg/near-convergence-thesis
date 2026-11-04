import React from 'react';
import wordmark from '../../assets/identity/near.svg';
export default function Converge(){return <div className="opening-converge">
  <p className="opening-kicker">AI × blockchain</p>
  <div className="converge-stage">
    <svg className="converge-traces" viewBox="0 0 960 400" aria-hidden="true"><defs><pattern id="converge-grain" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#82998a"/></pattern></defs><path d="M20 74C230 74 260 320 480 320S730 74 940 74" fill="none" stroke="url(#converge-grain)" strokeWidth="24"/><path d="M20 326C230 326 260 80 480 80S730 326 940 326" fill="none" stroke="url(#converge-grain)" strokeWidth="24"/></svg>
    <h1><span className="converge-intent">Intelligence</span><span className="converge-execution">meets execution.</span></h1>
    <div className="converge-caption"><span>AI can choose.</span><img src={wordmark} alt="NEAR" width="80" height="20"/><span>Blockchains can settle.</span></div>
  </div>
  <p className="opening-deck converge-deck">NEAR is building a path from machine intent to economic action.</p>
</div>;}
