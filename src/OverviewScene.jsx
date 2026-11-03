import React,{useEffect,useRef,useState} from 'react';
import {categories} from './overview/taxonomy.mjs';

const sectorCache=new Map();
function sectors(count){
  if(sectorCache.has(count))return sectorCache.get(count);
  const result=Array.from({length:count},(_,index)=>{
    const layers=['','',''];
    const center=-Math.PI/2+index*Math.PI*2/count,half=Math.PI/count*.76;
    for(let y=-232;y<=232;y+=4)for(let x=-232;x<=232;x+=4){
      const radius=Math.hypot(x,y),angle=Math.atan2(y,x);
      const distance=Math.abs(Math.atan2(Math.sin(angle-center),Math.cos(angle-center)));
      const noise=Math.sin(x*12.9898+y*78.233+index*37.719)*43758.5453;
      const random=noise-Math.floor(noise);
      const rim=214+Math.sin(angle*11+index)*10;
      if(radius<44||radius>rim||distance>half)continue;
      const density=radius>144?.68:.08+radius/1100;
      if(random>density)continue;
      const size=radius>144?1.6+random*3:1.2+random*1.5;
      const layer=Math.min(2,Math.floor(random*4.4));
      layers[layer]+=`M${x+320},${y+320}h${size.toFixed(1)}v${size.toFixed(1)}h-${size.toFixed(1)}z`;
    }
    return layers;
  });
  sectorCache.set(count,result);return result;
}
function sectorHit(index,count){
  const center=-Math.PI/2+index*Math.PI*2/count,half=Math.PI/count*.76;
  const point=(radius,angle)=>`${320+Math.cos(angle)*radius},${320+Math.sin(angle)*radius}`;
  return `M${point(40,center-half)}L${point(236,center-half)}A236,236 0 0 1 ${point(236,center+half)}L${point(40,center+half)}A40,40 0 0 0 ${point(40,center-half)}Z`;
}
function RadialMap({items,selected,onChoose,center,resetKey}){
  const [hovered,setHovered]=useState(null);
  useEffect(()=>setHovered(null),[resetKey]);
  const focus=hovered??items.findIndex(item=>item.id===selected),paths=sectors(items.length);
  return <div className="atlas-map" data-level={resetKey}>
    <svg className="atlas-particles" viewBox="0 0 640 640" aria-hidden="true">
      <g key={resetKey} className="atlas-reform">{items.map((item,index)=><g key={item.id} className="atlas-sector" style={{opacity:focus<0||focus===index?1:.12}} fill={item.color} onClick={()=>onChoose(item)} onPointerEnter={event=>{if(event.pointerType!=='touch')setHovered(index);}} onPointerLeave={()=>setHovered(null)}>
        <path className="atlas-sector-hit" d={sectorHit(index,items.length)} fill="transparent"/>
        {paths[index].map((path,layer)=><path pointerEvents="none" key={layer} d={path} opacity={[.3,.6,.94][layer]}/>)}
      </g>)}</g>
    </svg>
    <div className="atlas-core" aria-hidden="true"><span>NEAR</span><small>{center}</small></div>
    <div className="atlas-map-labels" aria-label={center+' topics'}>{items.map((item,index)=>{
      const angle=-Math.PI/2+index*Math.PI*2/items.length;
      const x=Math.max(16,Math.min(84,50+Math.cos(angle)*43));
      const y=50+Math.sin(angle)*43;
      return <button key={item.id} className={'atlas-map-label '+(focus===index?'is-focused':'')} style={{left:x+'%',top:y+'%','--topic-color':item.color}} aria-pressed={selected===item.id} onClick={()=>onChoose(item)} onPointerEnter={event=>{if(event.pointerType!=='touch')setHovered(index);}} onPointerLeave={()=>setHovered(null)} onFocus={()=>setHovered(index)} onBlur={()=>setHovered(null)}><span className="atlas-topic-dot" aria-hidden="true"/><span>{item.title}</span></button>;
    })}</div>
  </div>;
}
export default function OverviewScene(){
  const [categoryId,setCategoryId]=useState(null),[groupId,setGroupId]=useState(null),[metricId,setMetricId]=useState(null),[detail,setDetail]=useState('Definition');
  const heading=useRef(),firstRender=useRef(true);
  const category=categories.find(item=>item.id===categoryId),group=category?.groups.find(item=>item.id===groupId),metric=group?.metrics.find(item=>item.id===metricId);
  const level=metric?'metric':group?'group':category?'category':'overview';
  const currentKey=[categoryId,groupId,metricId].join('/');
  function reset(){setCategoryId(null);setGroupId(null);setMetricId(null);}
  function back(){if(metric)setMetricId(null);else if(group)setGroupId(null);else reset();}
  useEffect(()=>{if(firstRender.current){firstRender.current=false;return;}heading.current?.focus({preventScroll:true});},[currentKey]);
  useEffect(()=>{function escape(event){if(event.key==='Escape'&&categoryId){event.preventDefault();back();}}document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);});
  const options=category?(group?group.metrics:category.groups):categories;
  const items=options.map(item=>({...item,color:item.color||category.color}));
  function choose(item){if(!category){setCategoryId(item.id);setGroupId(null);setMetricId(null);}else if(!group){setGroupId(item.id);setMetricId(null);}else{setMetricId(item.id);setDetail('Definition');}}
  const title=metric?.title||group?.title||category?.title||'The foundations of an AI economy';
  const question=group?.question||category?.question||'If AI is to act, it needs rails for value. Explore NEAR’s network, capital and cross-chain services before testing that investment case.';
  return <div className={'atlas atlas-level-'+level}>
    <a className="atlas-skip" href="#atlas-main">Skip to overview</a>
    <header className="atlas-header"><a className="atlas-wordmark" href="index.html" aria-label="NEAR research home">NEAR</a><nav aria-label="Main navigation"><a href="thesis.html" aria-current="page">Thesis</a><a href="lab.html">Scenario lab</a><a href="report.html">Report</a></nav><a className="atlas-close" href="index.html">Close</a></header>
    <main id="atlas-main" className="atlas-main">
      <section className="atlas-editorial" aria-label="Overview context">
        <nav className="atlas-breadcrumbs" aria-label="Overview hierarchy"><button onClick={reset} aria-current={!category?'page':undefined}>Overview</button>{category&&<><span aria-hidden="true">/</span><button onClick={()=>{setGroupId(null);setMetricId(null);}} aria-current={!group?'page':undefined}>{category.title}</button></>}{group&&<><span aria-hidden="true">/</span><button onClick={()=>setMetricId(null)} aria-current={!metric?'page':undefined}>{group.title}</button></>}</nav>
        <div className="atlas-copy"><p className="atlas-eyebrow">{metric?'Metric':group?'Metric group':category?'Category':'NEAR overview'}</p><h1 ref={heading} tabIndex="-1">{title}</h1>
          {!metric?<p className="atlas-intro">{question}</p>:<div className="atlas-metric-detail">
            <div className="atlas-detail-tabs" role="group" aria-label="Metric detail">{['Definition','Caveat','Source'].map(tab=><button key={tab} aria-pressed={detail===tab} onClick={()=>setDetail(tab)}>{tab}</button>)}</div>
            <div className="atlas-detail-copy" aria-live="polite">{detail==='Definition'?<p>{metric.definition}</p>:detail==='Caveat'?<p>{metric.caveat}</p>:<><p>Planned reference</p><a href={metric.url} target="_blank" rel="noopener noreferrer">{metric.source}</a><small>Dune query and embedded chart are not connected yet.</small></>}</div>
          </div>}
        </div>
        <div className="atlas-prompt">{category&&<button className="atlas-back" onClick={back}>Back</button>}<p>{metric?'Choose another metric to compare its definition.':group?'Choose a metric to inspect its definition.':category?'Choose a subcategory to see its metrics.':'Choose a category to open its structure.'}</p></div>
      </section>
      <section className="atlas-visual" aria-label="Interactive NEAR overview map"><RadialMap items={items} selected={metricId} onChoose={choose} center={group?'Metrics':category?'Subcategories':'Overview'} resetKey={[categoryId,groupId].join('/')}/></section>
    </main>
    <footer className="atlas-footer"><span>Topic map · not to scale · metrics not connected</span><span>Structure preview · sector size does not represent data</span></footer>
  </div>;
}
