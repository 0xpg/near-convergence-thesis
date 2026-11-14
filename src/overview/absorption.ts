import {clamp01 as clamp} from '../format.ts';
const TAU=Math.PI*2;
const colors=['#4c5947','#a07839','#86607a','#536f79','#9c754c','#4a6890','#8e6252','#746a9b','#6c6454','#66774e'];
const SECTOR_TILES=162,TRAIL_START=131,ARC=8/10;
const CATEGORY_COUNT=colors.length;
const smooth=value=>value*value*(3-2*value);
function modeCheck(mode){if(!Number.isInteger(mode)||mode<0||mode>2)throw new RangeError('Unknown absorption direction');}

export type Particle={id:number,sector:number,a:number,r:number,phase:number,speed:number,size:number,color:string,shade:number,stream:boolean,core:boolean};

export function createParticles(mode=0){
  modeCheck(mode);
  let seed=94817;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const particles:Particle[]=[];
  for(let sector=0;sector<CATEGORY_COUNT;sector++){
    const center=-Math.PI/2+sector*TAU/CATEGORY_COUNT;
    const ring=204+random()*23;
    for(let index=0;index<SECTOR_TILES;index++){
      const trail=index>=TRAIL_START;
      const spread=(random()+random()+random()-1.5);
      const a=center+spread*(trail?.24:.22)*ARC;
      const r=(trail?35+random()*160:ring+(random()+random()-1)*32)*(mode===1?1.12:1);
      particles.push({id:particles.length,sector,a,r,phase:random(),speed:.8+random()*.4,size:trail?1.7+random()*2.2:3+random()*3.4,color:colors[sector],shade:random(),stream:trail||index%4===0,core:false});
    }
  }
  for(let index=0;index<180;index++)particles.push({id:particles.length,sector:index%CATEGORY_COUNT,a:random()*TAU,r:Math.sqrt(random())*26,phase:random(),speed:.8+random()*.4,size:2.3+random()*3.7,color:colors[index%CATEGORY_COUNT],shade:random(),stream:false,core:true});
  return particles;
}

export function particleAt(p,time,mode=0,selected=-1){
  const active=selected;
  if(p.core)return {x:320+Math.cos(p.a)*p.r,y:320+Math.sin(p.a)*p.r,alpha:.10+p.shade*.08,size:p.size};
  const focused=p.sector===active;
  let radius=p.r,angle=p.a,alpha=focused?1:(mode===2?.15:.68);
  const flowing=p.stream&&(mode===1||focused);
  if(flowing){
    const cycle=mode===1?8:6.8;
    const phase=(time*p.speed/cycle+p.phase)%1;
    const rest=mode===1?.12:.24;
    const progress=smooth(clamp((phase-rest)/(1-rest)));
    radius=p.r*(1-progress)+8*progress;
    angle+=Math.sin(progress*Math.PI)*(mode===1?.34:.07);
    alpha*=Math.min(1,phase*9,(1-phase)*12);
  }
  return {x:320+Math.cos(angle)*radius,y:320+Math.sin(angle)*radius,alpha,size:p.size};
}

export function startAbsorption(canvas:HTMLCanvasElement,mode=1,onSelect?:(index:number)=>void){
  modeCheck(mode);
  const initialMode=mode;
  const context=canvas.getContext('2d');if(!context)return {destroy(){},select(_index:number,_pin?:boolean){}};
  const ctx:CanvasRenderingContext2D=context;
  const particles=createParticles(mode),positions=particles.map(p=>particleAt(p,0,mode));
  let visible=true;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,time=0,last=0,width=0,height=0,selected=-1,pinned=false,stopped=false;
  function draw(dt=0){
    ctx.clearRect(0,0,width,height);
    const scale=Math.min(width,height)/640;
    ctx.save();ctx.translate((width-scale*640)/2,(height-scale*640)/2);ctx.scale(scale,scale);
    const mix=dt?1-Math.exp(-dt*9):1;
    for(let index=0;index<particles.length;index++){
      const p=particles[index],target=particleAt(p,motion.matches?0:time,mode,selected),position=positions[index];
      position.x+=(target.x-position.x)*mix;position.y+=(target.y-position.y)*mix;position.alpha+=(target.alpha-position.alpha)*mix;
      ctx.globalAlpha=position.alpha;ctx.fillStyle=p.color;
      const x=position.x,y=position.y,s=target.size;
      ctx.fillRect(x,y,s,s);
      ctx.globalAlpha=position.alpha*.43;ctx.fillStyle=p.shade>.5?'#f4f0dd':'#263b32';
      ctx.fillRect(x+s*.12,y+s*.12,s*.38,s*.36);
      if(p.shade>.35)ctx.fillRect(x+s*.6,y+s*.58,s*.28,s*.30);
    }
    ctx.restore();ctx.globalAlpha=1;
    canvas.dataset.animationTime=time.toFixed(3);canvas.dataset.direction=String(mode);canvas.dataset.selected=String(selected);
  }
  function tick(now){
    if(stopped||!visible||document.hidden||motion.matches){frame=0;return;}
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;time+=dt;draw(dt);frame=requestAnimationFrame(tick);
  }
  function sync(){if(stopped)return;cancelAnimationFrame(frame);frame=0;last=0;draw();if(visible&&!document.hidden&&!motion.matches)frame=requestAnimationFrame(tick);}
  function resize(){
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  }
  function sectorAt(event){
    const rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width,rect.height)/640;
    const x=(event.clientX-rect.left-rect.width/2)/scale,y=(event.clientY-rect.top-rect.height/2)/scale;
    if(Math.hypot(x,y)<48||Math.hypot(x,y)>300)return -1;
    return Math.round((Math.atan2(y,x)+Math.PI/2+TAU)/TAU*CATEGORY_COUNT)%CATEGORY_COUNT;
  }
  function select(index,pin=false){if(!Number.isInteger(index)||index< -1||index>=CATEGORY_COUNT)throw new RangeError('Unknown category');if(pinned&&!pin)return;selected=index;pinned=pin&&index>=0;mode=index>=0?2:initialMode;onSelect?.(index);if(motion.matches)draw();}
  function move(event){select(sectorAt(event));}
  function press(event){select(sectorAt(event),true);}
  function leave(){select(-1);}
  function release(event){if(event.pointerType!=='mouse')leave();}
  function key(event){if(!['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;event.preventDefault();select(event.key==='Escape'?-1:((selected<0?0:selected)+(event.key==='ArrowLeft'?CATEGORY_COUNT-1:1))%CATEGORY_COUNT,true);}
  const events={pointermove:move,pointerdown:press,pointerleave:leave,pointerup:release,pointercancel:leave,keydown:key};
  for(const [name,handler] of Object.entries(events))canvas.addEventListener(name,handler);
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});visibility.observe(canvas);
  motion.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);sync();
  return {select,destroy(){stopped=true;cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();motion.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);for(const [name,handler] of Object.entries(events))canvas.removeEventListener(name,handler);}};
}
