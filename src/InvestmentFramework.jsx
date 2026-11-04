import React,{useRef,useState} from 'react';

export const frameworkSources={
  velocity:{title:'Multicoin · Understanding Token Velocity',url:'https://multicoin.capital/2017/12/08/understanding-token-velocity/'},
  routing:{title:'a16z · App-token cash flows',url:'https://a16zcrypto.com/posts/article/application-tokens-economic-model-cash-flows/'},
  near:{title:'NEAR · Evolving Tokenomics',url:'https://www.near.org/blog/evolving-near-tokenomics'},
  hype:{title:'Hyperliquid · Fee mechanics',url:'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees'}
};
export const frameworkItems=[
  {id:'premium',title:'Monetary premium',x:-.72,y:.78,z:-.2,claim:'Value can depend on an asset’s perceived monetary role and willingness to hold it, rather than a claim on revenue.',mechanism:'Demand to hold the asset.',test:'Does demand persist when incentives and speculative turnover decline?',sources:['velocity']},
  {id:'network',title:'Network effects',x:-.74,y:.48,z:-.3,claim:'A useful network can create substantial value without its token retaining that value.',mechanism:'Utility and distribution; the token link must be shown separately.',test:'Does usage create persistent token demand, or only brief pass-through purchases?',sources:['velocity']},
  {id:'collateral',title:'Holding demand',x:-.58,y:.22,z:.3,claim:'Holding and locking can matter more than transaction counts. Temporary ownership is not equivalent to a durable monetary premium.',mechanism:'Demand for balances and committed capital.',test:'Do users retain balances without subsidy?',sources:['velocity']},
  {id:'ai',title:'AI optionality',x:-.63,y:-.43,z:-.4,claim:'The AI convergence thesis is exposure to future adoption, not evidence of current tokenholder income.',mechanism:'Prospective paid demand for execution and infrastructure.',test:'Can agent-originated activity be attributed to recurring, unsubsidised payments?',sources:['near','velocity']},
  {id:'adoption',title:'Future adoption',x:-.72,y:-.8,z:.4,claim:'Future markets may expand a network’s opportunity. The size of that opportunity does not establish who captures its economics.',mechanism:'An adoption hypothesis, not a cash-flow entitlement.',test:'Do forecasts translate into retained users and net economic receipts?',sources:['routing','velocity']},
  {id:'fees',title:'Protocol fees',x:.52,y:.78,z:-.65,claim:'Fee generation is the start of the underwriting chain. Gross fees can be shared with suppliers, partners and other recipients.',mechanism:'User payments before recipient allocation.',test:'Can gross fees be reconciled to net protocol receipts and their recipients?',sources:['routing','hype']},
  {id:'routing',title:'Fee routing',x:.72,y:.26,z:-.3,claim:'Who receives the money matters. Protocol receipts, supplier revenue and tokenholder economics are different quantities.',mechanism:'Trace fees from payer to recipient before attributing value.',test:'Do routing contracts and receipts support the claimed allocation?',sources:['routing','near']},
  {id:'buybacks',title:'Token purchases',x:.48,y:-.4,z:.6,claim:'Purchases create demand at execution. Their duration, funding, governance and final token disposition determine the stronger investment claim.',mechanism:'Buybacks, staking and burns have different supply effects.',test:'Are purchases completed and sustained? Are tokens burned, held, staked or redeployed?',sources:['near','hype']},
  {id:'treasury',title:'Treasury discretion',x:.77,y:-.77,z:-.4,claim:'NEAR’s tokenomics description allows governance to retain or redeploy receipts. It does not guarantee a specific supply-management mechanism.',mechanism:'Reinvestment or discretionary token-directed action.',test:'Do governance decisions and executed transactions establish durable token demand?',sources:['near']},
  {id:'near',title:'NEAR',x:0,y:0,z:0,claim:'Network optionality meets emerging revenue linkage. NEAR is centred as the hypothesis under examination, not a measured midpoint.',mechanism:'AI and cross-chain adoption plus potential routes from product usage to token demand.',test:'The revenue-linked argument weakens if paid usage fails to produce durable token demand after partner payouts and issuance.',sources:['near','velocity','routing']}
];

export default function InvestmentFramework(){
  const [selected,setSelected]=useState('near'),[angle,setAngle]=useState(0);
  const drag=useRef(null),item=frameworkItems.find(item=>item.id===selected);
  function turn(value){setAngle(Math.max(-65,Math.min(65,value)));}
  return <section className="investment-framework" aria-labelledby="framework-title">
    <header className="framework-heading"><p>Investment framework</p><h2 id="framework-title">Between network premium<br/>and token economics.</h2><p>NEAR sits at the intersection of two investment arguments. The link between them is what needs underwriting.</p></header>
    <div className="framework-layout">
      <div>
        <div className="framework-stage" tabIndex="0" role="group" aria-label="Three-dimensional investment framework" aria-describedby="framework-help" onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();turn(angle+(event.key==='ArrowRight'?10:-10));}if(event.key==='Home'){event.preventDefault();turn(0);}}} onPointerDown={event=>{if(event.target.closest('button'))return;drag.current={x:event.clientX,angle};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(drag.current&&Math.abs(event.clientX-drag.current.x)>4)turn(drag.current.angle+(event.clientX-drag.current.x)*.24);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
          <div className="framework-world" style={{transform:`rotateX(${Math.min(14,Math.abs(angle)*.35)}deg) rotateY(${angle}deg)`}}>
            <div className="framework-axis axis-x"/><div className="framework-axis axis-y"/><div className="framework-axis axis-z"/>
            <span className="framework-end end-left">Network premium</span><span className="framework-end end-right">Token economics</span><span className="framework-end end-top">Existing mechanisms</span><span className="framework-end end-bottom">Future expectations</span><span className="framework-end end-back">Protocol value</span><span className="framework-end end-front">Token capture</span>
            {frameworkItems.map(point=><button key={point.id} className={'framework-term '+(point.id==='near'?'framework-near':'')} aria-expanded={selected===point.id} aria-controls="framework-detail" onClick={()=>{setSelected(point.id);}} style={{left:`${50+point.x*42}%`,top:`${50-point.y*42}%`,transform:`translate(-50%,-50%) translateZ(${point.z*100}px)`}}>{point.title}</button>)}
          </div>
        </div>
        <p id="framework-help" className="tidal-sr">Illustrative positioning, not a score. Drag sideways to turn. Select a term to inspect it. Keyboard: left/right to turn, Home for front view.</p>
      </div>
      <aside className="framework-detail" id="framework-detail" aria-live="polite"><p className="framework-kicker">The underwriting question</p><h3>{item.title}</h3><p>{item.claim}</p><dl><dt>Economic link</dt><dd>{item.mechanism}</dd><dt>Challenge it</dt><dd>{item.test}</dd></dl></aside>
    </div>
  </section>;
}
