import ResearchCard from './ResearchCard.tsx';
import fade from '../../data/multiple-fade.json' with {type:'json'};
import rigor from '../../data/lab-rigor.json' with {type:'json'};
import {buildValuationCases,runValuation,type Starting} from './valuation.ts';
import {DitherCanvas,ditherLine,text,rule,INK,GREEN,RED,AMBER,BLUE} from './dither.tsx';
import {formatPrice as price} from '../format.ts';

type Pen=CanvasRenderingContext2D;
type CaseId='bear'|'base'|'bull'|'maximum';
const COLORS:Record<CaseId,string>={bear:RED,base:GREEN,bull:BLUE,maximum:AMBER};
const near=rigor.peers.nearSpecific,M0=near.multipleOnCapturedRevenue;
const years=(from:string,to:string)=>(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000/365;
export const fadedMultiple=(id:CaseId,t:number)=>{const c=fade.cases[id];return Math.exp(Math.log(c.longRun)+(Math.log(M0)-Math.log(c.longRun))*c.phi**t);};
const times=(v:number)=>`${v>=100?Math.round(v):v.toFixed(1)}×`;
const pct=(v:number)=>`${Math.round(v*100)}%`;

function drawFade(asOf:string,horizon:number,fixed:Record<CaseId,number>){
  return (pen:Pen,w:number,h:number)=>{
    const left=46,right=w-70,top=14,bottom=h-26,lo=Math.log(8),hi=Math.log(320);
    const x=(t:number)=>left+t/horizon*(right-left),y=(m:number)=>bottom-(Math.log(m)-lo)/(hi-lo)*(bottom-top);
    [10,25,50,100,200].forEach(m=>{rule(pen,left,y(m),right,y(m));text(pen,`${m}×`,0,y(m)+4,{size:10});});
    for(let year=Number(asOf.slice(0,4));;year++){const t=years(asOf,`${year}-12-31`);if(t>horizon+1e-9)break;if(t>=0)text(pen,`End ${year}`,x(t),bottom+16,{align:'center',size:9});}
    (Object.keys(COLORS) as CaseId[]).forEach(id=>{
      rule(pen,left,y(fixed[id]),right,y(fixed[id]),COLORS[id]+'66',[4,4]);
      const steps=Array.from({length:41},(_,i)=>horizon*i/40);
      ditherLine(pen,steps.map(t=>[x(t),y(fadedMultiple(id,t))]),COLORS[id],1.6);
      const end=fadedMultiple(id,horizon);
      text(pen,times(end),right+6,y(end)+3,{size:10,color:COLORS[id]});
    });
    text(pen,`NEAR today ${times(M0)}`,left+4,y(M0)-6,{size:9,color:INK});
  };
}

export default function MultipleFade({starting,exitDate}:{starting:Starting,exitDate:string}){
  const cases=buildValuationCases(starting,exitDate),horizon=years(starting.asOf,exitDate);
  const fixed=Object.fromEntries(cases.map(c=>[c.id,c.inputs.multiple])) as Record<CaseId,number>;
  const rows=cases.map(c=>{const id=c.id as CaseId,m=fadedMultiple(id,horizon),faded=runValuation({...c.inputs,multiple:m},starting).terminal;
    return {id,label:c.label.split(' · ')[0],fixed:c.inputs.multiple,faded:m,fixedPrice:c.result.terminal.futurePriceUsd,fadedPrice:faded.futurePriceUsd,fixedToday:c.result.terminal.presentPriceUsd,fadedToday:faded.presentPriceUsd};});
  const p=fade.ar1.protocols,[p1]=fade.above100.protocols,[c1]=fade.above100.chains,cs=fade.crossSection,con=fade.consistency;
  return <ResearchCard title="Extreme multiples have not lasted." takeaway="Inspect how a fading multiple changes each case’s value." wide><div className="lab-framework-copy">
    <p>The cases hold a fixed exit multiple: {fixed.bear}× in Bear, {fixed.base}× in Base and {fixed.bull}× in Bull and Maximum. Across {fade.panel.protocols.entities} crypto protocols on DefiLlama since 2020, revenue multiples moved back toward the pack: the gap to the long-run level halved every {p.halfLifeYears.toFixed(1)} years (95% interval {p.halfLifeCi95[0].toFixed(1)}–{p.halfLifeCi95[1].toFixed(1)}). A year after trading above 100×, the median protocol traded at {times(p1.median)} and only {pct(p1.shareAbove100)} were still above 100× ({p1.outcomes} outcomes from {p1.outcomeEntities} protocols). Layer-1 chains behaved differently: a year later the median stayed at {times(c1.median)}, because their DefiLlama revenue counts burned fees, not receipts.</p>
    <div className="lab-card-chart"><DitherCanvas draw={drawFade(starting.asOf,horizon,fixed)} height={260} label="Exit multiple paths from NEAR's current multiple when each case fades at the rate observed across crypto protocols, against the fixed case multiples."/><ul className="lab-legend">{rows.map(r=><li key={r.id} style={{color:COLORS[r.id]}}>{r.label}: fades to {times(r.faded)} · dashed line is the fixed {r.fixed}×</li>)}</ul></div>
    <div className="lab-frontier-table"><table><caption>Each case at {exitDate} with its fixed multiple and with the multiple faded at the observed rate · all other inputs unchanged</caption><thead><tr><th scope="col">Case</th><th scope="col">Fixed multiple</th><th scope="col">Faded multiple</th><th scope="col">Value at exit, fixed</th><th scope="col">Value at exit, faded</th><th scope="col">Value today, fixed</th><th scope="col">Value today, faded</th></tr></thead>
      <tbody>{rows.map(r=><tr key={r.id}><th scope="row">{r.label}</th><td>{r.fixed}×</td><td>{times(r.faded)}</td><td>{price(r.fixedPrice)}</td><td>{price(r.fadedPrice)}</td><td>{price(r.fixedToday)}</td><td>{price(r.fadedToday)}</td></tr>)}</tbody></table></div>
    <p>Each fade starts from NEAR’s {times(M0)} and heads toward a level the data supports. Bear and Base head to the protocol long-run mean and today’s protocol median ({times(fade.cases.bear.longRun)} and {times(fade.cases.base.longRun)}). Bull heads to the protocol upper quartile ({times(cs.protocols.q3)}). Maximum uses the same level with the slowest fade the data cannot reject. The fade rules and exclusions were fixed before the analysis ran.</p>
    <p>Two more checks point the same way. First, NEAR’s {times(M0)} divides market cap by the annualized 30-day run rate of receipts, while peers divide by trailing-year revenue. On that basis NEAR stands at {times(near.trailingRevenue.multiple)}. Second, a multiple is a claim about growth after the exit. With every receipt paid out and 3% stable growth, {fixed.base}× implies a required return of about {(con.impliedRequiredReturn['200']*100).toFixed(1)}% forever. At a 15% mature return it needs receipts to grow 30% a year for {con.yearsOfGrowthAfterExit['200']} years after the exit, against {con.yearsOfGrowthAfterExit['25']} years for 25×. <a href={fade.sources[1].url}>Chan, Karceski and Lakonishok</a> find no persistence in long-term growth beyond chance (p.643), and <a href={fade.sources[0].url}>Damodaran</a> warns that terminal multiples borrowed from comparables mix relative and cash-flow valuation (p.3).</p>
    <p>The cases keep their fixed multiples, so results stay comparable and every edition can be rerun both ways. Read Base and Bull as requiring NEAR to hold a multiple that protocols have not historically held, or to earn a premium as a layer-1 chain that receipts alone do not explain. The panel covers about one and a half crypto cycles, and its three-year outcomes rest on few protocols.</p>
  </div></ResearchCard>;
}
