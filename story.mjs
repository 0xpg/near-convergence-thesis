import {frames} from './story-frames.mjs';

export function stepIndex(index,direction,count){
  if(!Number.isInteger(count)||count<0||!Number.isInteger(index)||![-1,1].includes(direction))throw new RangeError('Invalid story navigation');
  return count===0?null:Math.max(0,Math.min(count-1,index+direction));
}
export function sourceUrl(value){
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
}

if(typeof document!=='undefined'){
  const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const canvas=$('story-field'),ctx=canvas.getContext('2d');
  let current=0,detailOpener=null;
  function draw(){
    const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.font="10px 'Saans Mono',monospace";ctx.textAlign='center';
    const glyphs='.:+x';
    for(let y=12;y<height;y+=13)for(let x=10;x<width;x+=10){
      const u=(x-width*.69)/width,v=(y-height*.48)/height,r=Math.hypot(u*1.4,v),angle=Math.atan2(v,u);
      const wave=Math.sin(r*46+angle*2+current*.6)+Math.sin(u*21-v*17)*.22;
      const grain=((Math.sin(x*12.9898+y*78.233)*43758.5453)%1+1)%1;
      const density=Math.max(0,1-r*1.7)*Math.max(0,wave-.12);
      if(grain<density*.58){ctx.fillStyle=`rgba(173,204,157,${.15+density*.42})`;ctx.fillText(glyphs[Math.floor(grain*31)%glyphs.length],x,y);}
    }
  }
  function closePanel(id,opener){$(id).hidden=true;opener?.focus();}
  function dismissPanels(){for(const id of ['chapter-panel','source-panel','story-detail'])$(id).hidden=true;$('chapter-toggle').setAttribute('aria-expanded','false');}
  function render(){
    const available=frames.length>0;
    $('story-empty').hidden=available;$('story-frame').hidden=!available;$('chapter-empty').hidden=available;
    $('story-back').disabled=!available||current===0;$('story-next').disabled=!available||current===frames.length-1;
    if(!available){draw();return;}
    const frame=frames[current];
    $('frame-kicker').textContent=frame.kicker||'';$('frame-title').textContent=frame.title||'';$('frame-body').replaceChildren();
    for(const paragraph of frame.paragraphs||[]){const p=document.createElement('p');p.textContent=paragraph;$('frame-body').append(p);}
    $('frame-ascii').textContent=frame.ascii||'';$('frame-ascii').hidden=!frame.ascii;
    $('story-position').textContent=frame.kicker||'Visual thesis';$('story-content').scrollTop=0;
    $('story-hotspots').replaceChildren();
    for(const point of frame.hotspots||[]){
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
      const button=document.createElement('button');button.className='story-hotspot';button.type='button';button.textContent='+';button.setAttribute('aria-label',point.title||'Inspect evidence');button.style.left=`clamp(22px,${Math.max(0,Math.min(1,point.x))*100}%,calc(100% - 22px))`;button.style.top=`clamp(22px,${Math.max(0,Math.min(1,point.y))*100}%,calc(100% - 22px))`;
      button.addEventListener('click',()=>{dismissPanels();detailOpener=button;$('detail-title').textContent=point.title||'';$('detail-body').textContent=point.description||'';$('story-detail').hidden=false;$('detail-close').focus();});$('story-hotspots').append(button);
    }
    $('source-list').replaceChildren();
    for(const source of frame.sources||[]){const url=sourceUrl(source.url);if(!url)continue;const li=document.createElement('li'),a=document.createElement('a');a.href=url;a.textContent=source.label||url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('source-list').append(li);}
    $('story-sources').hidden=!$('source-list').children.length;
    $('chapter-list').querySelectorAll('button').forEach((button,index)=>{if(index===current)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
    draw();
    if(!reduced.matches)$('story-frame').animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:400,easing:'ease-out'});
  }
  function go(index){
    if(!frames.length)return;
    current=Math.max(0,Math.min(frames.length-1,index));
    history.replaceState(null,'','#'+frames[current].id);$('source-panel').hidden=true;$('story-detail').hidden=true;render();
  }
  frames.forEach((frame,index)=>{const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=frame.title||'Untitled scene';button.addEventListener('click',()=>{closePanel('chapter-panel',$('chapter-toggle'));$('chapter-toggle').setAttribute('aria-expanded','false');go(index);});li.append(button);$('chapter-list').append(li);});
  $('story-back').addEventListener('click',()=>go(stepIndex(current,-1,frames.length)));
  $('story-next').addEventListener('click',()=>go(stepIndex(current,1,frames.length)));
  $('chapter-toggle').addEventListener('click',()=>{const open=$('chapter-panel').hidden;dismissPanels();$('chapter-panel').hidden=!open;$('chapter-toggle').setAttribute('aria-expanded',String(open));if(open)$('chapter-close').focus();});
  $('chapter-close').addEventListener('click',()=>{closePanel('chapter-panel',$('chapter-toggle'));$('chapter-toggle').setAttribute('aria-expanded','false');});
  $('story-sources').addEventListener('click',()=>{dismissPanels();$('source-panel').hidden=false;$('sources-close').focus();});
  $('sources-close').addEventListener('click',()=>closePanel('source-panel',$('story-sources')));
  $('detail-close').addEventListener('click',()=>closePanel('story-detail',detailOpener));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(!$('chapter-panel').hidden){closePanel('chapter-panel',$('chapter-toggle'));$('chapter-toggle').setAttribute('aria-expanded','false');}
      if(!$('source-panel').hidden)closePanel('source-panel',$('story-sources'));
      if(!$('story-detail').hidden)closePanel('story-detail',detailOpener);
    }
    if(event.target.matches('input,textarea,select')||!$('chapter-panel').hidden||!$('source-panel').hidden||!$('story-detail').hidden)return;
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();go(stepIndex(current,event.key==='ArrowRight'?1:-1,frames.length));}
  });
  window.addEventListener('hashchange',()=>{const index=frames.findIndex(frame=>frame.id===location.hash.slice(1));if(index>=0)go(index);});
  new ResizeObserver(draw).observe(canvas);document.fonts.ready.then(draw);
  const initial=frames.findIndex(frame=>frame.id===location.hash.slice(1));current=Math.max(0,initial);render();
}
