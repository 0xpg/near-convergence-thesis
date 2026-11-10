import {useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {MOCK,DEFAULTS,LIMITS,PRESETS,TRADING_DAYS,run,sanitize,compressionIndex,coverageGrid,supplyPath,flywheel,type Inputs,type InputKey} from './engine.ts';

type Result=ReturnType<typeof run>;
type Update=(patch:Partial<Inputs>)=>void;
type ModelProps={result:Result,inputs:Inputs,update:Update};
type Point=[number,number];
import {startScenarioField} from './scenario-field.ts';
import {startTypeDither} from '../overview/type-dither.ts';
import {DitherCanvas,ditherRect,ditherArea,ditherLine,text,rule,handle,clamp,logScale,INK,MUTED,RULE,GREEN,SOFT,RED,AMBER,BLUE} from './dither.tsx';

const money=value=>!Number.isFinite(value)?'Not reachable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:value>=1e9?2:1}).format(value);
const number=value=>!Number.isFinite(value)?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
const pct=(value,digits=1)=>`${Number.isFinite(value)?value.toFixed(digits):'—'}%`;
const times=(value,digits=1)=>!Number.isFinite(value)?'∞':`${value.toFixed(digits)}x`;
const nice=value=>{if(!(value>0))return value;const magnitude=10**Math.floor(Math.log10(value));return Math.round(value/magnitude*10)/10*magnitude;};

const FORMAT:Record<InputKey,(value:number)=>string>={
  volumeMultiple:value=>times(value),compression:value=>value.toFixed(2),
  shareStable:pct,shareMajors:pct,bpsStable:value=>`${value} bps`,bpsMajors:value=>`${value} bps`,bpsLong:value=>`${value} bps`,
  partnerPayout:pct,costs:value=>pct(value,0),buybackAllocation:value=>pct(value,0),burnShare:value=>pct(value,0),
  price:value=>`$${value.toFixed(2)}`,issuancePct:pct,
  desks:value=>`${value}`,ordersPerDesk:value=>`${value} / day`,orderSize:money,incrementalShare:value=>pct(value,0),institutionalBps:value=>`${value} bps`,
  agents:number,intentsPerAgent:value=>`${value} / day`,agentNotional:money,eligibleShare:value=>pct(value,0),agentBps:value=>`${value} bps`,
  targetMultiple:value=>times(value,0),
  solverElasticity:value=>value.toFixed(2),qualityElasticity:value=>value.toFixed(2),responsiveness:value=>value.toFixed(2),distributionGrowth:value=>pct(value)
};
const LABEL:Partial<Record<InputKey,string>>={
  volumeMultiple:'Crypto-native volume',compression:'Fee compression elasticity',
  bpsStable:'Stablecoin route fee',bpsMajors:'Majors route fee',bpsLong:'Long-tail route fee',
  partnerPayout:'Partner payout share',costs:'Other costs',buybackAllocation:'Buyback allocation',burnShare:'Share of buybacks burned',
  price:'NEAR price',issuancePct:'Annual issuance',
  ordersPerDesk:'Orders per desk',orderSize:'Average order size',incrementalShare:'Incremental, not displaced',institutionalBps:'Institutional fee',
  intentsPerAgent:'Intents per agent',agentNotional:'Average agent notional',eligibleShare:'Routed through Intents',agentBps:'Agent fee',
  targetMultiple:'Target revenue multiple',
  solverElasticity:'Solver response to flow',qualityElasticity:'Execution gain per solver',responsiveness:'Flow response to quality',distributionGrowth:'Distribution growth per round'
};

function readHash(){
  try{const match=location.hash.match(/^#s=(.+)$/);return match?sanitize(JSON.parse(decodeURIComponent(match[1]))):null;}catch{return null;}
}

function Slider({name,value,onChange}:{name:InputKey,value:number,onChange:Update}){
  const [min,max,step]=LIMITS[name],log=step==='log';
  const stepValue=typeof step==='number'?step:1;
  const position=log?Math.log(value/min)/Math.log(max/min)*1000:value;
  const fill=(log?position/1000:(value-min)/(max-min))*100;
  return <label className="lab-slider">
    <span className="lab-slider-head"><span>{LABEL[name]}</span><output>{FORMAT[name](value)}</output></span>
    <input type="range" min={log?0:min} max={log?1000:max} step={log?1:stepValue} value={position} aria-valuetext={FORMAT[name](value)} style={{'--fill':`${fill}%`} as CSSProperties}
      onChange={event=>{const raw=Number(event.target.value);onChange({[name]:log?nice(min*(max/min)**(raw/1000)):raw});}}/>
  </label>;
}

type CardProps={wide?:boolean,category:string,title:string,value:ReactNode,headline:ReactNode,legend?:[string,string][],caption:ReactNode,table:ReactNode[][],sliders?:InputKey[],inputs:Inputs,update:Update,actions?:ReactNode,children?:ReactNode};

function Card({wide,category,title,value,headline,legend,caption,table,sliders,inputs,update,actions,children}:CardProps){
  return <figure className={'lab-card'+(wide?' is-wide':'')}>
    <div className="lab-card-head">
      <div className="lab-card-meta"><span>{category}</span><span className="lab-mock">Mock data</span></div>
      <h3>{title}</h3>
      <p className="lab-card-headline"><strong>{value}</strong><span>{headline}</span></p>
    </div>
    <div className="lab-card-chart">{children}{legend&&<ul className="lab-legend">{legend.map(([name,color])=><li key={name}><i style={{color}}/>{name}</li>)}</ul>}</div>
    {(sliders?.length||actions)&&<div className="lab-card-controls">{sliders?.map(name=><Slider key={name} name={name} value={inputs[name]} onChange={update}/>)}{actions}</div>}
    <figcaption>{caption}</figcaption>
    <table className="tidal-sr"><caption>{title}</caption><tbody>{table.map(row=><tr key={String(row[0])}>{row.map((cell,index)=>index?<td key={index}>{cell}</td>:<th key={index} scope="row">{cell}</th>)}</tr>)}</tbody></table>
  </figure>;
}

function RouteMix({result,update,inputs}:ModelProps){
  const target=useRef(0);
  const colors={stable:BLUE,majors:GREEN,long:AMBER};
  const feeShare=(route:Result['routes'][number])=>result.cryptoFees?route.fees/result.cryptoFees*100:0;
  const long=result.routes[2],blended=result.cryptoVolume?result.cryptoFees/result.cryptoVolume*10000:0;
  const draw=(pen,width)=>{
    const left=54,bar=width-left,rows:[string,(route:Result['routes'][number])=>number,number][]=[['Volume',route=>route.sharePct,22],['Fees',feeShare,128]];
    const edges=rows.map(([,share])=>{let x=left;return result.routes.map(route=>{const start=x;x+=bar*share(route)/100;return [start,x];});});
    for(let index=0;index<3;index++){
      const [a0,a1]=edges[0][index],[b0,b1]=edges[1][index];
      pen.save();pen.fillStyle=colors[result.routes[index].id]+'14';pen.beginPath();pen.moveTo(a0,58);pen.lineTo(a1,58);pen.lineTo(b1,128);pen.lineTo(b0,128);pen.closePath();pen.fill();pen.restore();
    }
    rows.forEach(([label,,y],row)=>{
      text(pen,label,0,y+21,{size:11,color:INK});
      result.routes.forEach((route,index)=>{const [x0,x1]=edges[row][index];ditherRect(pen,x0,y,x1-x0-2,36,.86,colors[route.id]);
        if(x1-x0>34)text(pen,pct(row?feeShare(route):route.sharePct,0),x0+4,row?y+52:y-6,{size:10,color:colors[route.id],weight:500});});
    });
    edges[0].slice(0,2).forEach(([,x])=>{rule(pen,x,16,x,64,INK);handle(pen,x,40);});
    result.routes.forEach((route,index)=>{const [x0,x1]=edges[1][index];if(x1-x0>60)text(pen,`${route.name} · ${route.bps.toFixed(1)} bps`,x0,198,{size:10});});
  };
  const onDrag=(x,y,width,height,phase)=>{
    const left=54,share=clamp((x-left)/(width-left)*100,0,100),first=left+(width-left)*inputs.shareStable/100,second=left+(width-left)*(inputs.shareStable+inputs.shareMajors)/100;
    if(phase==='start')target.current=Math.abs(x-first)<=Math.abs(x-second)?0:1;
    if(target.current===0){const total=inputs.shareStable+inputs.shareMajors,stable=Math.round(clamp(share,0,total));update({shareStable:stable,shareMajors:total-stable});}
    else update({shareMajors:Math.round(clamp(share-inputs.shareStable,0,100-inputs.shareStable))});
  };
  return <Card category="Execution economics" title="Route mix sets the fee rate" value={`${blended.toFixed(1)} bps`} headline={`blended crypto-native fee. Long-tail routes are ${pct(long.sharePct,0)} of volume but ${pct(feeShare(long),0)} of fees.`}
    legend={[['Stablecoin routes',BLUE],['Majors',GREEN],['Long-tail',AMBER],['Drag the dividers',INK]]}
    caption="Fee revenue depends on which routes carry the volume, not only on how much volume there is. A shift toward cheap stablecoin routes can grow volume while shrinking fees."
    table={result.routes.map(route=>[route.name,pct(route.sharePct,0)+' of volume',`${route.bps.toFixed(1)} bps`,money(route.fees)])}
    sliders={['bpsStable','bpsMajors','bpsLong']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={210} onDrag={onDrag} label={`Route mix: blended ${blended.toFixed(1)} basis points; long-tail routes carry ${pct(feeShare(long),0)} of fees.`}/>
  </Card>;
}

function Waterfall({result,update,inputs}:ModelProps){
  const steps:[string,number,'total'|'loss',string][]=[
    ['Gross\nfees',result.grossFees,'total',GREEN],['Partner\npayouts',result.payouts,'loss',RED],['Other\ncosts',result.otherCosts,'loss',RED],
    ['Retained\nrevenue',result.retained,'total',INK],['Not used\nfor buybacks',result.retained-result.buybackUsd,'loss',RED],['Buybacks',result.buybackUsd,'total',GREEN],['Burned',result.tokensBurned*inputs.price,'total',AMBER]
  ];
  const geometry=(width,height)=>({top:24,bottom:height-38,column:width/steps.length});
  const draw=(pen,width,height)=>{
    const {top,bottom,column}=geometry(width,height),plot=bottom-top,bar=Math.min(48,column*.6),scale=value=>result.grossFees?value/result.grossFees*plot:0;
    rule(pen,0,bottom,width,bottom);let level=result.grossFees;
    steps.forEach(([label,value,kind,color],index)=>{
      const x=index*column+(column-bar)/2;let y0,y1;
      if(kind==='total'){y0=bottom-scale(value);y1=bottom;level=value;}else{y0=bottom-scale(level);y1=bottom-scale(level-value);level-=value;}
      ditherRect(pen,x,y0,bar,Math.max(y1-y0,value>0?2:0),kind==='total'?.92:.42,color);
      if(index<steps.length-1)rule(pen,x+bar,kind==='total'?y0:y1,x+column,kind==='total'?y0:y1,'#293b3240',[2,3]);
      text(pen,(kind==='loss'&&value>0?'−':'')+money(value),x+bar/2,y0-7,{align:'center',size:10,color:kind==='loss'?RED:INK});
      label.split('\n').forEach((line,lineIndex)=>text(pen,line,x+bar/2,bottom+15+lineIndex*11,{align:'center',size:9.5}));
      if(index===1)handle(pen,x+bar/2,y1,RED);
    });
  };
  const onDrag=(x,y,width,height)=>{const {top,bottom}=geometry(width,height),level=clamp((bottom-y)/(bottom-top),0,1);update({partnerPayout:Math.round((1-level)*1000)/10});};
  return <Card category="Value transmission" title="Where the fee dollar goes" value={money(result.retainedPerMillion)} headline={`retained per $1m of volume. ${pct(inputs.partnerPayout)} of gross fees go to partners first.`}
    legend={[['Totals',GREEN],['Leakage',RED],['Drag the payout handle',INK]]}
    caption="Gross fees are not protocol revenue. Distribution partners, costs and the buyback policy each take a cut before anything reaches the token."
    table={steps.map(([label,value])=>[label.replace('\n',' '),money(value)])} sliders={['partnerPayout','costs','buybackAllocation']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={260} onDrag={onDrag} label={`Fee waterfall: ${money(result.grossFees)} gross fees, ${money(result.retained)} retained, ${money(result.buybackUsd)} buybacks.`}/>
  </Card>;
}

function Compression({inputs,update}:{inputs:Inputs,update:Update}){
  const target=useRef('end');const e=inputs.compression;
  const frame=(width,height)=>({left:30,right:width-14,top:12,bottom:height-30});
  const draw=(pen,width,height)=>{
    const {left,right,top,bottom}=frame(width,height),x=m=>left+(m-1)/9*(right-left),y=v=>bottom-v/10*(bottom-top);
    for(const tick of [1,5,10]){rule(pen,left,y(tick),right,y(tick),RULE,[2,3]);text(pen,`${tick}x`,0,y(tick)+4,{size:10});}
    const samples=Array.from({length:46},(_,index)=>1+index*.2);
    ditherArea(pen,samples.map(m=>[x(m),y(compressionIndex(m,e))]),bottom,.5,INK);
    ditherLine(pen,samples.map(m=>[x(m),y(m)]),SOFT,1.2);
    ditherLine(pen,samples.map(m=>[x(m),y(1)]),RED,1);
    ditherLine(pen,samples.map(m=>[x(m),y(compressionIndex(m,e))]),INK,1.5);
    [1,2,5,10].forEach(m=>text(pen,`${m}x`,x(m),bottom+16,{align:'center',size:10}));
    text(pen,'Volume',x(10)-4,y(10)+14,{align:'right',size:10,color:GREEN});text(pen,'Proportional compression',x(10)-4,y(1)-6,{align:'right',size:10,color:RED});
    const m=clamp(inputs.volumeMultiple,1,10);rule(pen,x(m),top,x(m),bottom,'#a5556180',[3,3]);handle(pen,x(m),bottom,RED);
    handle(pen,x(10),y(compressionIndex(10,e)),INK);
  };
  const onDrag=(px,py,width,height,phase)=>{
    const {left,right,top,bottom}=frame(width,height);
    if(phase==='start')target.current=px>right-36&&py<bottom-12?'end':'multiple';
    if(target.current==='end'){const index=clamp((bottom-py)/(bottom-top)*10,1,10);update({compression:Math.round((1-Math.log(index)/Math.log(10))*100)/100});}
    else update({volumeMultiple:Math.round(clamp(1+(px-left)/(right-left)*9,1,10)*10)/10});
  };
  return <Card category="Fee compression" title="More volume is not more value" value={times(compressionIndex(10,e))} headline={`retained revenue at 10x volume when fees compress with elasticity ${e.toFixed(2)}.`}
    legend={[['Volume',SOFT],['Retained revenue',INK],['Drag the end point or the volume marker',RED]]}
    caption="Competition for order flow pushes fee rates down as volume grows. At elasticity 1, ten times the volume earns exactly the same revenue."
    table={[1,2,5,10].map(m=>[`${m}x volume`,times(compressionIndex(m,e),2)+' retained revenue'])} sliders={['compression','volumeMultiple']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={250} onDrag={onDrag} label={`At 10x volume, retained revenue is ${times(compressionIndex(10,e))} today.`}/>
  </Card>;
}

const GRID_MULTIPLES=[.5,1,2,3,5,7,10],GRID_PAYOUTS=[95,85,75,65,55,45];
function CoverageGrid({inputs,update}:{inputs:Inputs,update:Update}){
  const cells=useMemo(()=>coverageGrid(inputs,GRID_MULTIPLES,GRID_PAYOUTS),[inputs]);
  const covered=cells.flat().filter(value=>value>=100).length;
  const layout=(width,height)=>{const left=40,bottom=height-30,gap=3;return {left,bottom,gap,cellW:(width-left-gap*6)/7,cellH:(bottom-gap*5)/6};};
  const position=(width,height)=>{
    const {left,gap,cellW,cellH}=layout(width,height),m=clamp(inputs.volumeMultiple,.5,10);
    let column=0;while(column<5&&GRID_MULTIPLES[column+1]<m)column++;
    const t=Math.log(m/GRID_MULTIPLES[column])/Math.log(GRID_MULTIPLES[column+1]/GRID_MULTIPLES[column]);
    const x=left+(column+t)*(cellW+gap)+cellW/2,y=(95-clamp(inputs.partnerPayout,45,95))/10*(cellH+gap)+cellH/2;
    return [x,y];
  };
  const draw=(pen,width,height)=>{
    const {left,bottom,gap,cellW,cellH}=layout(width,height);
    GRID_PAYOUTS.forEach((payout,row)=>{
      const y=row*(cellH+gap);text(pen,`${payout}%`,0,y+cellH/2+4,{size:10});
      GRID_MULTIPLES.forEach((multiple,column)=>{
        const x=left+column*(cellW+gap),value=cells[row][column];
        pen.fillStyle='#f3f4f1';pen.fillRect(x,y,cellW,cellH);
        ditherRect(pen,x,y,cellW,cellH,.05+.9*clamp(value/100,0,1)**.7,value>=100?INK:GREEN);
        if(value>=100){pen.strokeStyle=INK;pen.strokeRect(Math.round(x)+.5,Math.round(y)+.5,Math.round(cellW)-1,Math.round(cellH)-1);}
        if(row===5)text(pen,`${multiple}x`,x+cellW/2,bottom+15,{align:'center',size:10});
      });
    });
    text(pen,'Crypto-native volume →',width,bottom+28,{align:'right',size:10,color:INK});
    const [x,y]=position(width,height);handle(pen,x,y,RED);
  };
  const onDrag=(px,py,width,height)=>{
    const {left,gap,cellW,cellH}=layout(width,height),columnFloat=clamp((px-left-cellW/2)/(cellW+gap),0,6),column=Math.min(5,Math.floor(columnFloat)),t=columnFloat-column;
    const multiple=GRID_MULTIPLES[column]*(GRID_MULTIPLES[column+1]/GRID_MULTIPLES[column])**t,payout=clamp(95-(py-cellH/2)/(cellH+gap)*10,45,95);
    update({volumeMultiple:Math.round(multiple*10)/10,partnerPayout:Math.round(payout*10)/10});
  };
  return <Card category="Token capture" title="When buybacks outpace issuance" value={`${covered} of 42`} headline="volume and payout combinations buy back all newly issued NEAR."
    legend={[['Denser, more coverage',GREEN],['Outlined, covers issuance',INK],['Drag your scenario',RED]]}
    caption="Each cell reruns the full model at a different crypto-native volume and partner payout share, holding every other assumption fixed. Rows are payout share."
    table={GRID_PAYOUTS.map((payout,row)=>[`${payout}% payout`,...GRID_MULTIPLES.map((multiple,column)=>`${multiple}x: ${pct(cells[row][column],0)}`)])} sliders={['issuancePct','price']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={270} onDrag={onDrag} label={`${covered} of 42 combinations cover annual issuance with buybacks.`}/>
  </Card>;
}

function DemandFrontier({result,inputs,update}:ModelProps){
  const target=useRef(1),scale=logScale(1e7,1e12);
  const bars:[string,number,string,number][]=[['Crypto-native',result.cryptoVolume,GREEN,result.cryptoFees],['Institutional',result.institutionalVolume,AMBER,result.institutionalFees],['Agents',result.agentVolume,RED,result.agentFees]];
  const newShare=result.volume?(result.institutionalVolume+result.agentVolume)/result.volume*100:0,newFees=result.grossFees?(result.institutionalFees+result.agentFees)/result.grossFees*100:0;
  const frame=(width,height)=>({left:44,bottom:height-34,top:16,column:(width-44)/3});
  const draw=(pen,width,height)=>{
    const {left,bottom,top,column}=frame(width,height),plot=bottom-top,y=value=>bottom-scale.to(clamp(value,1e7,1e12),plot),bar=Math.min(64,column*.5);
    for(const tick of [1e7,1e8,1e9,1e10,1e11,1e12]){rule(pen,left,y(tick),width,y(tick),RULE,[2,3]);text(pen,money(tick).replace('.0',''),0,y(tick)+4,{size:9.5});}
    bars.forEach(([label,value,color,fees],index)=>{
      const x=left+index*column+(column-bar)/2;
      if(index===1&&result.displacedVolume>0){pen.strokeStyle=AMBER;pen.setLineDash([2,3]);pen.strokeRect(x+.5,y(result.institutionalGross)+.5,bar-1,y(value)-y(result.institutionalGross));pen.setLineDash([]);text(pen,'displaced',x+bar+4,y(result.institutionalGross)+10,{size:9,color:AMBER});}
      ditherRect(pen,x,y(value),bar,bottom-y(value),.88,color);
      text(pen,money(value),x+bar/2,y(Math.max(value,index===1?result.institutionalGross:value))-7,{align:'center',size:10,color:INK});
      text(pen,label,x+bar/2,bottom+15,{align:'center',size:10,color:INK});text(pen,`${pct(result.grossFees?fees/result.grossFees*100:0,0)} of fees`,x+bar/2,bottom+28,{align:'center',size:9.5});
      if(index)handle(pen,x+bar/2,y(index===1?result.institutionalGross:value),color);
    });
  };
  const onDrag=(px,py,width,height,phase)=>{
    const {left,bottom,top,column}=frame(width,height),value=scale.from(bottom-py,bottom-top);
    if(phase==='start')target.current=px<left+2*column?1:2;
    if(target.current===1){const perDesk=inputs.ordersPerDesk*inputs.orderSize*TRADING_DAYS;if(perDesk>0)update({desks:Math.round(clamp(value/perDesk,0,200))});}
    else{const perAgent=inputs.intentsPerAgent*inputs.agentNotional*365*inputs.eligibleShare/100;if(perAgent>0)update({agents:nice(clamp(value/perAgent,100,1e6))});}
  };
  return <Card category="Demand frontier" title="Who brings the volume" value={pct(newShare,0)} headline={`of volume from institutions and agents, earning ${pct(newFees,0)} of fees at their lower fee rates.`}
    legend={[['Crypto-native',GREEN],['Institutional desks',AMBER],['Agents',RED],['Drag the bar tops',INK]]}
    caption={`Institutional flow is ${inputs.desks} desks × ${inputs.ordersPerDesk} orders a day × ${money(inputs.orderSize)} × ${TRADING_DAYS} days. Only the incremental share adds volume; the rest displaces flow that already existed.`}
    table={bars.map(([label,value,,fees])=>[label,money(value),money(fees)+' fees'])} sliders={['ordersPerDesk','orderSize','incrementalShare','institutionalBps']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={270} onDrag={onDrag} label={`Demand frontier: institutions and agents provide ${pct(newShare,0)} of volume and ${pct(newFees,0)} of fees.`}/>
  </Card>;
}

function AgentFlow({result,inputs,update}:ModelProps){
  const xScale=logScale(100,1e6),yScale=logScale(1e4,1e12);
  const perAgent=inputs.intentsPerAgent*inputs.agentNotional*365*inputs.eligibleShare/100;
  const others=result.cryptoVolume+result.institutionalVolume,goal=others/9,needed=perAgent>0?goal/perAgent:Infinity;
  const frame=(width,height)=>({left:44,right:width-10,top:10,bottom:height-30});
  const draw=(pen,width,height)=>{
    const {left,right,top,bottom}=frame(width,height),x=n=>left+xScale.to(n,right-left),y=v=>bottom-yScale.to(clamp(v,1e4,1e12),bottom-top);
    for(const tick of [1e4,1e6,1e8,1e10,1e12]){rule(pen,left,y(tick),right,y(tick),RULE,[2,3]);text(pen,money(tick).replace('.0',''),0,y(tick)+4,{size:9.5});}
    for(const tick of [100,1e3,1e4,1e5,1e6])text(pen,number(tick),x(tick),bottom+16,{align:'center',size:10});
    const line=[100,1e3,1e4,1e5,1e6].map((n):Point=>[x(n),y(n*perAgent)]);
    ditherArea(pen,line,bottom,.32,RED);ditherLine(pen,line,RED,1.5);
    rule(pen,left,y(goal),right,y(goal),INK,[4,3]);text(pen,`10% of total volume · ${money(goal)}`,left+4,y(goal)-6,{size:10,color:INK});
    if(needed>=100&&needed<=1e6){rule(pen,x(needed),y(goal),x(needed),bottom,INK,[2,3]);pen.fillStyle=INK;pen.beginPath();pen.arc(x(needed),y(goal),4,0,Math.PI*2);pen.fill();}
    handle(pen,x(inputs.agents),y(inputs.agents*perAgent),RED);
    text(pen,'Transacting agents →',right,bottom+28,{align:'right',size:10,color:INK});
  };
  const onDrag=(px,py,width,height)=>{const {left,right}=frame(width,height);update({agents:nice(xScale.from(px-left,right-left))});};
  return <Card category="Agent economy" title="How many agents it takes" value={needed>1e6?'> 1M':number(needed)} headline="transacting agents needed before agents carry 10% of total volume."
    legend={[['Annual agent volume',RED],['10% threshold',INK],['Drag the agent count',RED]]}
    caption={`Each agent submits ${inputs.intentsPerAgent} intents a day at ${money(inputs.agentNotional)} average notional, with ${pct(inputs.eligibleShare,0)} routed through Intents. Agent activity is not yet attributable in public data.`}
    table={[['Agents',number(inputs.agents)],['Agent volume',money(result.agentVolume)],['Agents for 10% of volume',number(needed)]]} sliders={['intentsPerAgent','agentNotional','eligibleShare','agentBps']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={250} onDrag={onDrag} label={`About ${number(needed)} agents would be needed for agents to carry 10% of volume.`}/>
  </Card>;
}

function TokenCapture({result,inputs,update}:ModelProps){
  const draw=(pen,width,height)=>{
    const max=Math.max(result.issuanceTokens,result.tokensBought,1),side=Math.min(height-46,width/2-36),size=tokens=>side*Math.sqrt(tokens/max);
    const blocks=[[result.issuanceTokens,width*.27],[result.tokensBought,width*.73]],base=height-40;
    const [issued,ix]=blocks[0],is=size(issued);ditherRect(pen,ix-is/2,base-is,is,is,.5,SOFT);
    const [bought,bx]=blocks[1],bs=size(bought),burnedHeight=bs*inputs.burnShare/100;
    ditherRect(pen,bx-bs/2,base-bs,bs,bs-burnedHeight,.82,INK);ditherRect(pen,bx-bs/2,base-burnedHeight,bs,burnedHeight,.9,AMBER);
    if(bs>6)handle(pen,bx,base-burnedHeight,AMBER);
    text(pen,`${number(issued)} NEAR issued`,ix,base+16,{align:'center',size:11,color:INK});text(pen,'per year',ix,base+29,{align:'center',size:10});
    text(pen,`${number(bought)} NEAR bought`,bx,base+16,{align:'center',size:11,color:INK});text(pen,`${number(result.tokensBurned)} burned`,bx,base+29,{align:'center',size:10,color:AMBER});
  };
  const onDrag=(px,py,width,height)=>{
    const max=Math.max(result.issuanceTokens,result.tokensBought,1),side=Math.min(height-46,width/2-36),bs=side*Math.sqrt(result.tokensBought/max),base=height-40;
    if(bs>0)update({burnShare:Math.round(clamp((base-py)/bs*100,0,100))});
  };
  return <Card category="Token capture" title="Bought back versus newly issued" value={pct(result.coveragePct)} headline={`of annual issuance bought back. ${pct(result.issuanceTokens?result.tokensBurned/result.issuanceTokens*100:0)} is permanently retired.`}
    legend={[['Annual issuance',SOFT],['Bought and held',INK],['Bought and burned',AMBER],['Drag the burn line',INK]]}
    caption="Areas are proportional to tokens. Buybacks held in a treasury can be distributed later; only burned tokens reduce supply."
    table={[['Issued per year',number(result.issuanceTokens)+' NEAR'],['Bought',number(result.tokensBought)+' NEAR'],['Burned',number(result.tokensBurned)+' NEAR']]} sliders={['buybackAllocation','burnShare','price']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={250} onDrag={onDrag} label={`Buybacks cover ${pct(result.coveragePct)} of annual issuance.`}/>
  </Card>;
}

function SupplyPath({inputs,update}:{inputs:Inputs,update:Update}){
  const rows=useMemo(()=>supplyPath(inputs),[inputs]);
  const last=rows[rows.length-1],growth=(last.withBurn/rows[0].withBurn-1)*100;
  const frame=(width,height)=>{const values=rows.flatMap(row=>[row.withBurn,row.issuanceOnly]),spread=Math.max(...values)-Math.min(...values),min=Math.min(...values)-spread*.12-1e6,max=Math.max(...values)+spread*.12+1e6;return {left:46,right:width-12,top:10,bottom:height-28,min,max};};
  const draw=(pen,width,height)=>{
    const {left,right,top,bottom,min,max}=frame(width,height),x=year=>left+year/5*(right-left),y=v=>bottom-(v-min)/(max-min)*(bottom-top);
    for(const tick of [min,(min+max)/2,max]){rule(pen,left,y(tick),right,y(tick),RULE,[2,3]);text(pen,number(tick),0,y(tick)+4,{size:9.5});}
    rows.forEach(row=>text(pen,`Y${row.year}`,x(row.year),bottom+16,{align:'center',size:10}));
    const issuance=rows.map((row):Point=>[x(row.year),y(row.issuanceOnly)]),burn=rows.map((row):Point=>[x(row.year),y(row.withBurn)]);
    ditherArea(pen,burn,bottom,.22,GREEN);ditherLine(pen,issuance,SOFT,1.2);ditherLine(pen,burn,INK,1.6);
    handle(pen,x(5),y(last.issuanceOnly),SOFT);
  };
  const onDrag=(px,py,width,height)=>{const {top,bottom,min,max}=frame(width,height),value=min+(bottom-py)/(bottom-top)*(max-min);update({issuancePct:Math.round(clamp(((value/MOCK.supply)**(1/5)-1)*100,0,8)*10)/10});};
  return <Card category="Supply" title="Five-year supply path" value={`${growth>=0?'+':''}${pct(growth)}`} headline={`net supply over five years with ${pct(inputs.burnShare,0)} of buybacks burned.`}
    legend={[['Issuance only',SOFT],['After burns',INK],['Drag year five to set issuance',SOFT]]}
    caption="Issuance compounds on the growing supply. Burns subtract a fixed token amount each year at the current buyback level; held buybacks do not change supply."
    table={rows.map(row=>[`Year ${row.year}`,number(row.issuanceOnly),number(row.withBurn)])} sliders={['issuancePct','burnShare']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={240} onDrag={onDrag} label={`Supply grows ${pct(growth)} over five years.`}/>
  </Card>;
}

function ReverseValuation({result,inputs,update}:ModelProps){
  const target=useRef('cap'),xScale=logScale(2,150);
  const range=()=>{const low=Math.min(result.retained*2||1e6,result.marketCap)/2,high=Math.max(result.retained*150,result.marketCap)*2;return logScale(low,high);};
  const frame=(width,height)=>({left:46,right:width-10,top:10,bottom:height-30});
  const draw=(pen,width,height)=>{
    const {left,right,top,bottom}=frame(width,height),yScale=range(),x=m=>left+xScale.to(m,right-left),y=v=>bottom-yScale.to(v,bottom-top);
    for(const tick of [2,10,30,100])text(pen,`${tick}x`,x(tick),bottom+16,{align:'center',size:10});
    const line=[2,5,10,30,60,150].map((m):Point=>[x(m),y(Math.max(result.retained*m,1))]);
    ditherArea(pen,line,bottom,.28,GREEN);ditherLine(pen,line,GREEN,1.5);
    rule(pen,left,y(result.marketCap),right,y(result.marketCap),INK,[4,3]);text(pen,`Market cap ${money(result.marketCap)}`,left+4,y(result.marketCap)-6,{size:10,color:INK});
    if(result.impliedMultiple>=2&&result.impliedMultiple<=150){pen.fillStyle=RED;pen.beginPath();pen.arc(x(result.impliedMultiple),y(result.marketCap),4.5,0,Math.PI*2);pen.fill();}
    const tx=x(inputs.targetMultiple);rule(pen,tx,top,tx,bottom,'#9a742890',[3,3]);handle(pen,tx,bottom,AMBER);handle(pen,right-14,y(result.marketCap),INK);
    text(pen,'Revenue multiple →',right,bottom+28,{align:'right',size:10,color:INK});
  };
  const onDrag=(px,py,width,height,phase)=>{
    const {left,right,top,bottom}=frame(width,height);
    if(phase==='start')target.current=py>bottom-16?'multiple':'cap';
    if(target.current==='multiple')update({targetMultiple:Math.round(xScale.from(px-left,right-left))});
    else{const cap=range().from(bottom-py,bottom-top);update({price:Math.round(clamp(cap/MOCK.supply,.5,20)*100)/100});}
  };
  return <Card wide category="Reverse underwriting" title="What the price already assumes" value={times(result.impliedMultiple,0)} headline={`retained revenue is priced in at $${inputs.price.toFixed(2)} per NEAR.`}
    legend={[['Value at each multiple',GREEN],['Drag market cap',INK],['Drag target multiple',AMBER]]}
    caption={`At a ${times(inputs.targetMultiple,0)} multiple, today's market cap needs ${money(result.requiredRevenue)} of retained revenue, or ${money(result.requiredVolume)} of annual volume at ${result.retainedBps.toFixed(2)} retained bps, ${times(result.requiredVolume/result.volume)} today's modeled volume.`}
    table={[['Market cap',money(result.marketCap)],['Implied multiple',times(result.impliedMultiple,0)],['Required revenue',money(result.requiredRevenue)],['Required volume',money(result.requiredVolume)]]} sliders={['targetMultiple','price']} inputs={inputs} update={update}>
    <DitherCanvas draw={draw} height={250} onDrag={onDrag} label={`The market prices ${times(result.impliedMultiple,0)} retained revenue.`}/>
  </Card>;
}

function Flywheel({inputs,update}:{inputs:Inputs,update:Update}){
  const rows=useMemo(()=>flywheel(inputs),[inputs]);
  const [progress,setProgress]=useState(12);const animation=useRef(0);
  useEffect(()=>()=>cancelAnimationFrame(animation.current),[]);
  const replay=()=>{cancelAnimationFrame(animation.current);if(matchMedia('(prefers-reduced-motion: reduce)').matches){setProgress(12);return;}const start=performance.now();const step=now=>{const value=Math.min(12,(now-start)/2400*12);setProgress(value);if(value<12)animation.current=requestAnimationFrame(step);};animation.current=requestAnimationFrame(step);};
  const last=rows[rows.length-1];
  const frame=(width,height)=>({left:30,right:width-12,top:12,bottom:height-28});
  const draw=(pen,width,height)=>{
    const {left,right,top,bottom}=frame(width,height),max=Math.max(2,...rows.flatMap(row=>[row.flow,row.solvers/MOCK.solvers,row.retainedIndex]))*1.08;
    const x=round=>left+round/12*(right-left),y=v=>bottom-v/max*(bottom-top);
    for(const tick of [0,1,Math.round(max)]){rule(pen,left,y(tick),right,y(tick),tick===1?'#293b3240':RULE,[2,3]);text(pen,`${tick}x`,0,y(tick)+4,{size:10});}
    [0,3,6,9,12].forEach(round=>text(pen,`R${round}`,x(round),bottom+16,{align:'center',size:10}));
    const visible=rows.filter(row=>row.round<=progress);
    const series=(key:'flow'|'solvers'|'retainedIndex',transform=(value:number)=>value)=>visible.map((row):Point=>[x(row.round),y(transform(row[key]))]);
    ditherArea(pen,series('flow'),bottom,.4,GREEN);ditherLine(pen,series('flow'),GREEN,1.6);
    ditherLine(pen,series('solvers',value=>value/MOCK.solvers),BLUE,1.3);ditherLine(pen,series('retainedIndex'),INK,1.8);
    const head=visible.at(-1);if(head)handle(pen,x(head.round),y(head.flow),GREEN);
  };
  const onDrag=(px,py,width)=>{const {left,right}=frame(width,0);cancelAnimationFrame(animation.current);setProgress(clamp((px-left)/(right-left)*12,0,12));};
  const shown=rows[Math.floor(progress)];
  return <Card wide category="Intents flywheel" title="Does the loop compound?" value={times(shown.flow,2)} headline={`order flow after ${Math.floor(progress)} rounds, with ${number(shown.solvers)} solvers quoting ${shown.spreadBps.toFixed(1)} bps spreads. Retained revenue: ${times(shown.retainedIndex,2)}.`}
    legend={[['Order flow',GREEN],['Active solvers',BLUE],['Retained revenue',INK],['Drag to scrub rounds',GREEN]]}
    caption="Hypothesis, not evidence: more flow attracts solvers, more solvers tighten execution, better execution attracts more flow. Each link is an assumption you can weaken; fee compression means revenue can lag the loop."
    table={rows.map(row=>[`Round ${row.round}`,times(row.flow,2)+' flow',number(row.solvers)+' solvers',times(row.retainedIndex,2)+' revenue'])}
    sliders={['solverElasticity','qualityElasticity','responsiveness','distributionGrowth']} inputs={inputs} update={update}
    actions={<button type="button" className="lab-run" onClick={replay}>Run the loop</button>}>
    <DitherCanvas draw={draw} height={260} onDrag={onDrag} label={`After 12 rounds, order flow is ${times(last.flow,2)} and retained revenue ${times(last.retainedIndex,2)}.`}/>
  </Card>;
}

function LabHero({result}:{result:Result}){
  const field=useRef<HTMLCanvasElement>(null),heading=useRef<HTMLHeadingElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>startScenarioField(field.current),[]);
  useLayoutEffect(()=>canvas.current&&heading.current?startTypeDither(canvas.current,heading.current):undefined,[]);
  return <section className="lab-hero" aria-labelledby="lab-title">
    <div className="lab-hero-copy">
      <div className="thesis-resolve"><canvas ref={canvas} aria-hidden="true"/><h1 id="lab-title" ref={heading}><span>Test the</span><span>token economics.</span></h1></div>
      <p className="lab-deck">Ten connected models trace how volume becomes fees, fees become retained revenue, and revenue becomes, or fails to become, demand for NEAR. Every chart reruns as you drag.</p>
      <dl className="lab-hero-stats">
        <div><dt>Retained revenue</dt><dd>{money(result.retained)}</dd></div>
        <div><dt>Issuance covered</dt><dd>{pct(result.coveragePct)}</dd></div>
        <div><dt>Priced-in multiple</dt><dd>{times(result.impliedMultiple,0)}</dd></div>
      </dl>
    </div>
    <figure className="lab-hero-field">
      <canvas ref={field} aria-hidden="true"/>
    </figure>
  </section>;
}

export default function LabExperience(){
  const [inputs,setInputs]=useState<Inputs>(()=>readHash()||{...DEFAULTS});
  const [preset,setPreset]=useState(()=>readHash()?'':'base');
  const [copied,setCopied]=useState(false);
  const result=useMemo(()=>run(inputs),[inputs]);
  const update:Update=patch=>{setInputs(previous=>sanitize({...previous,...patch}));setPreset('');};
  const choose=name=>{setInputs(sanitize({...DEFAULTS,...PRESETS[name].inputs}));setPreset(name);};
  useEffect(()=>{
    const changed=Object.fromEntries(Object.entries(inputs).filter(([key,value])=>value!==DEFAULTS[key]));
    const hash=Object.keys(changed).length?'#s='+encodeURIComponent(JSON.stringify(changed)):'';
    if(location.hash!==hash&&(hash||location.hash.startsWith('#s=')))history.replaceState(null,'',location.pathname+location.search+hash);
  },[inputs]);
  const share=async()=>{try{await navigator.clipboard.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}};
  const exportScenario=()=>{
    const output={exportedAt:new Date().toISOString(),status:MOCK.status,inputs,outputs:Object.fromEntries(Object.entries(result).filter(([,value])=>typeof value==='number'))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='near-scenario-mock.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const props={result,inputs,update};
  return <>
    <LabHero result={result}/>
    <section id="lab" className="lab-console" aria-label="Scenario console">
      <div className="lab-console-controls">
        <div className="lab-presets" role="group" aria-label="Assumption sets">{Object.entries(PRESETS).map(([name,option])=><button key={name} type="button" aria-pressed={preset===name} onClick={()=>choose(name)}>{option.label}</button>)}</div>
        <div className="lab-console-sliders">{(['volumeMultiple','compression','partnerPayout','buybackAllocation','burnShare','price','issuancePct','targetMultiple'] as InputKey[]).map(name=><Slider key={name} name={name} value={inputs[name]} onChange={update}/>)}</div>
        <div className="lab-console-actions"><button type="button" onClick={()=>choose('base')}>Reset</button><button type="button" onClick={exportScenario}>Export JSON</button><button type="button" onClick={share}>{copied?'Link copied':'Copy scenario link'}</button></div>
      </div>
      <div className="lab-console-results" aria-live="polite">
        <p className="lab-console-label">Annual run rate · mock baseline</p>
        <p className="lab-console-big"><span>Retained revenue</span><strong>{money(result.retained)}</strong></p>
        <dl>
          <div><dt>Total volume</dt><dd>{money(result.volume)}</dd></div>
          <div><dt>Gross fees</dt><dd>{money(result.grossFees)} · {result.grossBps.toFixed(1)} bps</dd></div>
          <div><dt>Retained per $1m</dt><dd>{money(result.retainedPerMillion)}</dd></div>
          <div><dt>NEAR bought per year</dt><dd>{number(result.tokensBought)}</dd></div>
          <div><dt>Issuance covered</dt><dd>{pct(result.coveragePct)}</dd></div>
          <div><dt>Market cap / retained revenue</dt><dd>{times(result.impliedMultiple,0)}</dd></div>
        </dl>
        <p className="lab-console-note">Hypothetical. 10x volume is a sensitivity, not a forecast, and never implies 10x token demand.</p>
      </div>
    </section>
    <section className="lab-models" aria-labelledby="lab-models-title">
      <header><h2 id="lab-models-title">Ten models, one set of assumptions</h2><p>Drag a handle or a slider in any chart. Every model reruns from the same inputs.</p></header>
      <div className="lab-grid">
        <RouteMix {...props}/><Waterfall {...props}/>
        <Compression {...props}/><CoverageGrid {...props}/>
        <DemandFrontier {...props}/><AgentFlow {...props}/>
        <TokenCapture {...props}/><SupplyPath {...props}/>
        <ReverseValuation {...props}/>
        <Flywheel {...props}/>
      </div>
      <details className="lab-method">
        <summary>Formulas and model boundaries</summary>
        <dl>
          <dt>Route fees</dt><dd>route volume × route fee bps × compression factor / 10,000</dd>
          <dt>Compression factor</dt><dd>(total volume / baseline volume)^−elasticity, applied only above baseline</dd>
          <dt>Institutional flow</dt><dd>desks × orders per day × average order × {TRADING_DAYS} days × incremental share</dd>
          <dt>Agent flow</dt><dd>agents × intents per day × average notional × 365 × share routed through Intents</dd>
          <dt>Retained revenue</dt><dd>gross fees × (1 − partner payout) × (1 − other costs)</dd>
          <dt>Tokens bought</dt><dd>retained revenue × buyback allocation / NEAR price; only the burned share reduces supply</dd>
          <dt>Reverse underwriting</dt><dd>required revenue = market cap / target multiple; required volume = required revenue / retained bps</dd>
        </dl>
        <p>{MOCK.status} The baseline uses a 30-day crypto-native volume of {money(MOCK.cryptoVolume30d)}, a {number(MOCK.supply)} NEAR supply and {MOCK.solvers} active solvers. Replace these with reconciled source data before drawing conclusions.</p>
      </details>
    </section>
  </>;
}
