import {runValuation,buildValuationCases,type Starting,type ValuationInputs} from './valuation.ts';
import baseline from '../../data/lab-baseline.json' with {type:'json'};

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const percent=(n:number)=>`${n.toFixed(2)}%`;
const number=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(n);

export default function ValuationFramework({inputs:a,result:r,starting:s}:{inputs:ValuationInputs,result:ReturnType<typeof runValuation>,starting:Starting}){
 const t=r.terminal,scale=t.volumeUsd/s.annualVolumeUsd;
 const annualGrowth=((1+a.growthPct/100)**12-1)*100;
 const withoutAi=runValuation({...a,aiTokenLinkPct:0},s).terminal.futurePriceUsd;
 const maximum=buildValuationCases(s,a.exitDate).find(c=>c.id==='maximum')!,mx=maximum.result.terminal,ma=maximum.inputs;
 const [short,long]=baseline.operating.windows;
 const variables=[
  ['V₀ · Starting volume',`${money(s.annualVolumeUsd)} / year`,'Observed 30-day volume annualized; a starting run rate, not a full-year observation.'],
  ['T · Forecast horizon',`${r.years.toFixed(3)} years`,'Calendar days from the dated supply snapshot to the exit, divided by 365.'],
  ['g · Monthly volume growth',percent(a.growthPct),`Case assumption; equivalent to ${percent(annualGrowth)} compounded annually.`],
  ['f₀, ε · Fee and compression',`${a.grossBps.toFixed(2)} bps; ${a.compression.toFixed(2)}`,'Starting fee is a case input; Base retains the observed aggregate fee. Elasticity controls fee compression above starting volume.'],
  ['c, k · Capture and costs',`${percent(a.capturePct)}; ${percent(a.costPct)}`,'Capture is receipts divided by gross fees; Base starts at the observed ratio. Future capture and cost haircuts are assumptions.'],
  ['U, fᵢ, cᵢ · Institutional routing',`${money(a.institutionalVolumeAnnualUsd)}; ${a.institutionalFeeBps.toFixed(2)} bps; ${percent(a.institutionalCapturePct)}`,'Incremental annual settlement volume, fee and capture. Excludes volume already in the existing Intents projection.'],
  ['B, m, λ · AI economics',`${money(a.aiRevenueAnnualUsd)}; ${percent(a.aiMarginPct)}; ${percent(a.aiTokenLinkPct)}`,'Annual service billing, cash margin and protocol allocation. Each is a scenario input, not an observed tokenholder entitlement.'],
  ['S₀, i · Supply and issuance',`${number(s.supplyNear)} NEAR; ${percent(a.issuancePct)}`,'Starting total supply comes from the dated RPC block. Future issuance compounds at the selected rate; no separate speculative burn is credited.'],
  ['M · Exit REV multiple',`${number(a.multiple)}×`,'Chosen capitalization per dollar of annual capturable REV; it is not a cash-flow discount rate.'],
  ['r · Required annual return',percent(a.discountPct),'Selected opportunity-cost hurdle. It is held separate from the exit multiple and is not an independently estimated crypto CAPM.']
 ];
 return <section className="lab-models lab-framework" aria-labelledby="lab-framework-title">
  <header><h2 id="lab-framework-title">The economics behind the price.</h2><p>A common accounting bridge connects operating activity to protocol-capturable revenue, dilution and token value. The equations below substitute the selected case’s inputs and rerun with every change.</p></header>
  <div className="lab-grid">
   <article className="lab-card is-wide"><div className="lab-card-head"><h3>Value accrual, before valuation.</h3></div>
    <div className="lab-framework-copy"><p>Transaction notional is not revenue. Gross fees are multiplied by the protocol capture share, then reduced by execution costs. AI contributes service cash after its own margin and protocol allocation. Only then is the combined annual run rate capitalized.</p>
     <div className="lab-accrual-map" aria-label="Selected case revenue connects to token value">
      <dl className="lab-accrual-streams">{[{name:'Intents',value:t.intentsUsd,shape:'disc'},{name:'Institutions',value:t.institutionalUsd,shape:'arch'},{name:'AI services',value:t.aiUsd,shape:'lens'}].map(stream=><div key={stream.name} className={'lab-accrual-stream is-'+stream.shape}><span className="lab-accrual-glyph" aria-hidden="true"/><dt>{stream.name}</dt><dd>{money(stream.value)}<small>annual capturable REV</small></dd></div>)}</dl>
      <div className="lab-accrual-junction" aria-hidden="true"><span>+</span><span>+</span></div>
      <dl className="lab-accrual-output"><div><dt>Combined annual REV</dt><dd>{money(t.totalUsd)}</dd></div><div className="lab-accrual-factor"><dt>Exit multiple</dt><dd>× {number(a.multiple)}</dd></div><div className="lab-accrual-factor"><dt>Future supply</dt><dd>÷ {money(t.supplyNear).replace('$','')}<small>NEAR</small></dd></div><div className="lab-accrual-price"><dt>Token value at exit</dt><dd>{price(t.futurePriceUsd)}</dd></div></dl>
     </div>
     <div className="lab-equation" role="math" aria-label="Annual capturable revenue equals Intents revenue plus incremental institutional revenue plus AI protocol cash"><var>REV</var><sub>T</sub> = <var>R</var><sub>Intents,T</sub> + <var>R</var><sub>Institutional,T</sub> + <var>R</var><sub>AI,T</sub></div>
     <p className="lab-equation-work">{money(t.totalUsd)} = {money(t.intentsUsd)} + {money(t.institutionalUsd)} + {money(t.aiUsd)} per year</p>
     <p className="lab-equation-units">Fees f are in basis points and divided by 10,000. Growth, capture, costs, margin, allocation and issuance are decimal fractions; 45% means 0.45. T uses actual calendar days / 365. Displayed substitutions are rounded; calculations use full precision.</p>
     <p>This is an exit run-rate revenue-multiple model. The displayed present value discounts that exit token value; it does not sum interim distributions as a full discounted cash-flow model would. ETF assets, investor subscriptions and monetary demand are not inserted as revenue.</p>
    </div>
   </article>
   <article className="lab-card"><div className="lab-card-head"><h3>Growth must survive fee compression.</h3></div><div className="lab-framework-copy">
    <div className="lab-equation" role="math" aria-label="Exit annual volume equals starting annual volume times one plus monthly growth to the power twelve times years"><var>V</var><sub>T</sub> = <var>V</var><sub>0</sub> (1 + <var>g</var>)<sup>12T</sup></div>
    <p className="lab-equation-work">{money(s.annualVolumeUsd)} × (1 + {percent(a.growthPct)})<sup>{(12*r.years).toFixed(3)}</sup> = {money(t.volumeUsd)} / year</p>
    <div className="lab-equation" role="math" aria-label="Effective fee equals starting fee times the maximum of volume scale and one to the power negative compression"><var>f</var><sub>T</sub> = <var>f</var><sub>0</sub> max(1, <var>V</var><sub>T</sub>/<var>V</var><sub>0</sub>)<sup>−ε</sup></div>
    <p className="lab-equation-work">{a.grossBps.toFixed(2)} bps × max(1, {scale.toFixed(3)})<sup>−{a.compression.toFixed(2)}</sup> = {t.effectiveGrossBps.toFixed(3)} bps</p>
    <div className="lab-equation" role="math" aria-label="Intents revenue equals annual volume times fee divided by ten thousand times capture times one minus costs"><var>R</var><sub>Intents,T</sub> = <var>V</var><sub>T</sub> × (<var>f</var><sub>T</sub>/10,000) × <var>c</var> × (1 − <var>k</var>)</div>
    <p className="lab-equation-work">{money(t.volumeUsd)} × {t.effectiveGrossBps.toFixed(3)} / 10,000 × {percent(a.capturePct)} × (1 − {percent(a.costPct)}) = {money(t.intentsUsd)}</p>
    <p>Compression applies only when volume exceeds its starting scale; shrinking volume does not automatically raise the fee. A positive elasticity makes revenue grow more slowly than volume. The same cost haircut is applied once, after fee capture.</p>
   </div></article>
   <article className="lab-card"><div className="lab-card-head"><h3>Capital becomes revenue only when it transacts.</h3></div><div className="lab-framework-copy">
    <div className="lab-equation" role="math" aria-label="Institutional revenue equals incremental annual volume times institutional fee divided by ten thousand times capture times one minus costs"><var>R</var><sub>Institutional,T</sub> = <var>U</var><sub>T</sub> × (<var>f</var><sub>i</sub>/10,000) × <var>c</var><sub>i</sub> × (1 − <var>k</var>)</div>
    <p className="lab-equation-work">{money(a.institutionalVolumeAnnualUsd)} × {a.institutionalFeeBps.toFixed(2)} / 10,000 × {percent(a.institutionalCapturePct)} × (1 − {percent(a.costPct)}) = {money(t.institutionalUsd)} / year</p>
    <p>Institutional demand is represented by incremental fee-paying settlement, not ETF inflows or assets under management. The case requires observable integrations to become sustained routing volume at the assumed net yield. Reclassifying existing Intents users as institutional would not justify adding their activity again.</p>
   </div></article>
   <article className="lab-card"><div className="lab-card-head"><h3>Billing needs a measurable route to the protocol.</h3></div><div className="lab-framework-copy">
    <div className="lab-equation" role="math" aria-label="AI protocol revenue equals annual billing times cash margin times protocol allocation"><var>R</var><sub>AI,T</sub> = <var>B</var><sub>T</sub> × <var>m</var> × <var>λ</var></div>
    <p className="lab-equation-work">{money(a.aiRevenueAnnualUsd)} × {percent(a.aiMarginPct)} × {percent(a.aiTokenLinkPct)} = {money(t.aiUsd)} / year</p>
    <p>The margin absorbs AI service costs; the execution cost haircut is not applied again. Agent counts alone cannot establish this revenue: paid usage, realized billing, service margin and the protocol’s actual allocation must reconcile. Setting allocation to zero leaves an exit token value of {price(withoutAi)}.</p>
    <p>Agent-driven settlement has three operating drivers: active agents, annual transactions per agent and average transaction value. Their product contributes to execution volume; it is not counted a second time as AI service billing. Aggregate notional does not identify how many agents generated it.</p>
    <p>Institutional and AI annual run rates ramp linearly from zero incremental contribution at the snapshot to their exit assumptions. This defines the chart’s intermediate path; it is not a fitted adoption curve.</p>
   </div></article>
   <article className="lab-card"><div className="lab-card-head"><h3>Capitalize revenue, then divide by future supply.</h3></div><div className="lab-framework-copy">
    <div className="lab-equation" role="math" aria-label="Exit supply equals starting supply times one plus issuance to the power years"><var>S</var><sub>T</sub> = <var>S</var><sub>0</sub> (1 + <var>i</var>)<sup>T</sup></div>
    <p className="lab-equation-work">{number(s.supplyNear)} × (1 + {percent(a.issuancePct)})<sup>{r.years.toFixed(3)}</sup> = {number(t.supplyNear)} NEAR</p>
    <div className="lab-equation" role="math" aria-label="Exit token price equals annual capturable revenue times multiple divided by exit supply"><var>P</var><sub>T</sub> = (<var>REV</var><sub>T</sub> × <var>M</var>) / <var>S</var><sub>T</sub></div>
    <p className="lab-equation-work">{money(t.totalUsd)} × {number(a.multiple)} / {number(t.supplyNear)} = {price(t.futurePriceUsd)}</p>
    <div className="lab-equation" role="math" aria-label="Present reference price equals exit price divided by one plus required return to the power years"><var>P</var><sub>0</sub> = <var>P</var><sub>T</sub> / (1 + <var>r</var>)<sup>T</sup></div>
    <p className="lab-equation-work">{price(t.futurePriceUsd)} / (1 + {percent(a.discountPct)})<sup>{r.years.toFixed(3)}</sup> = {price(t.presentPriceUsd)}</p>
    <p>Total supply keeps locked and newly issued tokens in the denominator. A revenue multiple prices future durability, growth and risk together; it does not establish that protocol receipts are legally distributable tokenholder cash flow.</p>
   </div></article>
   <article className="lab-card is-wide"><div className="lab-card-head"><h3>What is measured, and what the case asks to become true.</h3></div><div className="lab-frontier-table lab-case-table"><table><caption>Selected-case variables and evidence status</caption><thead><tr><th scope="col">Variable</th><th scope="col">Selected value</th><th scope="col">Definition and basis</th></tr></thead><tbody>{variables.map(([name,value,basis])=><tr key={name}><th scope="row">{name}</th><td>{value}</td><td>{basis}</td></tr>)}</tbody></table></div>
    <div className="lab-framework-copy"><p><strong>The cases test different economic outcomes.</strong> Bear contracts execution activity and capture, with no incremental institutional or AI contribution. Base preserves the observed aggregate starting fee and capture while requiring continued growth and new services. Bull and Maximum combine faster adoption with fee compression, improved capture and larger incremental services; the upside therefore depends on revenue quality as well as scale.</p>
     <p><strong>The $400 case is a reverse valuation.</strong> After fixing growth, fee economics, institutional routing, supply and the multiple, the model solves the AI billing needed for $400 at exit. This makes the operational hurdle inspectable; it does not turn the target into independent evidence. Other cases and custom inputs calculate their resulting prices directly.</p>
     <div className="lab-equation" role="math" aria-label="For the Maximum case, required AI billing equals the maximum of zero and four hundred dollars times exit supply divided by multiple minus Intents revenue minus institutional revenue, divided by AI margin times protocol allocation"><var>B</var><sub>required</sub> = max(0, 400<var>S</var><sub>T</sub>/<var>M</var> − <var>R</var><sub>Intents,T</sub> − <var>R</var><sub>Institutional,T</sub>) / (<var>m</var> × <var>λ</var>)</div>
     <p className="lab-equation-work">Maximum reference at {a.exitDate}: max(0, $400 × {number(mx.supplyNear)} / {ma.multiple} − {money(mx.intentsUsd)} − {money(mx.institutionalUsd)}) / ({percent(ma.aiMarginPct)} × {percent(ma.aiTokenLinkPct)}) = {money(maximum.calibration!.requiredAiRevenueAnnualUsd)} annual AI billing.</p>
     <p><strong>Multiple discipline.</strong> The reference cases use 100×, 200× and 250×. These are scenario choices, not statistically estimated terminal multiples or validated peer medians. Their reciprocal annual REV yields are 1.00%, 0.50% and 0.40%; the selected {number(a.multiple)}× implies {(100/a.multiple).toFixed(2)}% before any tokenholder distribution. A high multiple must be supported by durable future expansion beyond this exit run rate.</p>
    </div>
   </article>
   <article className="lab-card is-wide"><div className="lab-card-head"><h3>Anchor the baseline. Test the expansion.</h3></div><div className="lab-framework-copy">
    <p>The matched {short.days}-day window ({short.start}–{short.end}) contains {money(short.volumeUsd)} of volume, {money(short.grossFeesUsd)} of gross fees and {money(short.capturedUsd)} of receipts. Ratios use sums over the same window, rather than averages of daily percentages. <a href={baseline.market.url}>Inspect the executed Dune source</a>.</p>
    <div className="lab-equation" role="math" aria-label="Observed blended fee equals total fees divided by total volume times ten thousand; capture equals receipts divided by fees">f₀ = 10,000 × Σ fees / Σ volume; c₀ = Σ receipts / Σ fees</div>
    <div className="lab-frontier-table lab-baseline-table"><table><caption>30D / 90D operating cross-check · same archived source</caption><thead><tr><th scope="col">Window</th><th scope="col">Gross fee</th><th scope="col">Capture</th><th scope="col">Net receipt yield</th><th scope="col">Annualized receipts</th></tr></thead><tbody>{[short,long].map(w=><tr key={w.days}><th scope="row">{w.days} days</th><td>{w.grossBps.toFixed(3)} bps</td><td>{percent(w.cashCapturePct)}</td><td>{w.capturedBps.toFixed(3)} bps</td><td>{money(w.annualizedCapturedUsd)}</td></tr>)}</tbody></table></div>
    <p>The shorter window’s annualized receipts are {percent((short.annualizedCapturedUsd/long.annualizedCapturedUsd-1)*100)} above the 90-day anchor. This is a window-sensitivity check, not independent confirmation of wallet attribution. The model preserves the snapshot; new observations require refreshing and validating the source baseline.</p>
    <dl className="lab-research-basis">
     <dt>Adoption to economics</dt><dd><a href="https://bitwiseinvestments.eu/blog/special-reports/the-investment-case-for-near/pdf/Near_investment_case_ENG.pdf">Bitwise’s NEAR report, pp. 25–29</a> decomposes agent demand into population, frequency, ticket size and fees. We retain that driver discipline; its 50× multiple does not establish this model’s 100–250× assumptions.</dd>
     <dt>Revenue quality before a multiple</dt><dd>The <a href="https://app.blockworks.com/report/near-priced-for-intents-built-for-ai">Blockworks valuation framework</a> in the supplied October 2026 excerpt separates Intents fee capture, incremental services, dilution and discounting. We use that accounting sequence with this model’s own dated inputs and horizon; its historical multiples are not a refreshed peer valuation.</dd>
     <dt>Fees to receipts</dt><dd><a href="https://docs.near-intents.org/resources/fees">The official fee schedule</a> distinguishes verifier, distribution, API and quote-improvement fees. Route pricing and partner agreements support using realized blended economics rather than a universal 0.3% charge.</dd>
     <dt>AI billing to cash</dt><dd><a href="https://docs.near.ai/cloud/models">NEAR AI’s model catalog</a> establishes pay-per-use pricing. Aggregate billing, margin and protocol allocation need separate evidence; a listed service price cannot establish all three.</dd>
     <dt>Utility and capital demand</dt><dd><a href="https://arxiv.org/abs/2606.07445">Perepelitsa (2026)</a> separates accumulation from transactional utility in an ETH-specific model. <a href="https://arxiv.org/abs/2403.04914">Kampakis et al. (2024)</a> examines velocity assumptions in exchange-equation valuation. We apply those boundaries by excluding ETF purchases from REV and avoiding direct notional-to-market-cap conversion; neither paper calibrates NEAR’s price.</dd>
     <dt>What would validate the cases</dt><dd>Comparable-window paid volume, reconciled collection receipts, durable realized fee capture, incremental institutional routing without overlap, and AI billing reconciled through costs to protocol allocations. <a href="https://near.com/terms">NEAR’s terms</a> allow discretionary uses of captured revenue; collection alone is not a guaranteed tokenholder distribution.</dd>
    </dl>
   </div></article>
  </div>
 </section>;
}
