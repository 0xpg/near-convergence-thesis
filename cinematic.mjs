export function walkingPose(frame) { const phase=(frame%16)/16*Math.PI*2; return {swing:Math.sin(phase),lift:Math.cos(phase)}; }

export function bodyShape(){return {width:1,height:1,weight:1};}

export function ditherAt(x,y,variant,frame) {
  const seed=.5,{swing,lift}=walkingPose(frame);
  const build=bodyShape(variant);
  const center=38;
  const breadth=5,hip=2;
  const segment=(ax,ay,bx,by,r)=>{
    r*=build.weight;
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-ax-t*dx,y-ay-t*dy)/r;
  };
  const bob=Math.abs(lift)*1.2;
  const body=Math.hypot((x-center-1)/(7*build.weight),(y-58-bob)/19);
  const head=Math.hypot((x-center-2)/(5.8+seed),(y-27-bob)/7.2);
  let distance=Math.min(body,head,segment(center+1,33+bob,center,43+bob,3));
  distance=Math.min(distance,segment(center+6,26+bob,center+8,28+bob,1.8));
  for(const side of [-1,1]){
    const step=swing*side,flight=Math.max(0,lift*side);
    const foot=center+side*hip+step*12,footY=116-flight*7;
    const knee=center+side*hip+step*5+flight*5;
    const elbow=center+side*breadth-step*6+2,hand=center+side*breadth-step*9+4;
    distance=Math.min(distance,
      segment(center+side*hip,74+bob,knee,96,4),segment(knee,96,foot,footY,3.1),segment(foot,footY,foot+5,footY,2.5),
      segment(center+side*breadth,45+bob,elbow,62+bob,3),segment(elbow,62+bob,hand,76+bob-flight*2,2.5));
  }
  const density=distance<1?Math.min(.97,.55+(1-distance)*.45):0;
  const threshold=((Math.sin(x*127.1+y*311.7+variant*74.7)*43758.5453)%1+1)%1;
  return threshold<density;
}

export function depthBlur(depth){return Math.max(0,Math.abs(depth-.5)-.08)*19;}

export function labelAnchor(x,width) { return Math.max(6,Math.min(width-106,x*width-10)); }

export function focusBox(node,width,height){
  const size=(.29+node.z*.62)*(width<600?.62:1);
  const boxHeight=104*size;
  const x=Math.max(6,Math.min(width-106,node.x*width-15*size*node.profile));
  const y=Math.max(6,Math.min(height-boxHeight-38,node.y*height-52*size-17));
  return {x,y,boxY:y+17,boxWidth:30*size*node.profile,boxHeight};
}

export function motionTime(seconds) {
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Time must be finite and nonnegative');
  return Math.floor(seconds/7)*4.8+Math.min(seconds%7,4.8);
}
export function selectPeople(nodes,random=Math.random,previous=[]) {
  return [[.12,.34],[.38,.62],[.66,.86]].map(([left,right],group)=>{
    const candidates=nodes.map((node,index)=>({node,index})).filter(({node,index})=>index!==previous[group]&&node.x>=left&&node.x<=right&&node.z>.25&&node.z<.72);
    const pool=candidates.length?candidates:nodes.map((node,index)=>({node,index})).filter(({index})=>index!==previous[group]);
    return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))].index;
  });
}
export function drift(start,velocity,time){
  const t=((start+velocity*time)%2+2)%2;
  return t<=1?t:2-t;
}

export function fieldAt(seconds,selected=[6,17,27]) {
  motionTime(seconds);
  const motion=seconds;
  const nodes=Array.from({length:48},(_,i)=>{
    const seed=(i*.61803398875)%1,depth=(i*.41421356237+.07)%1;
    const individuality=(i*.754877666)%1,cadence=(.005+individuality*.003)*640;
    const velocity=(.005+individuality*.003)*(i%2?1:-1);
    const dx=.88*(drift(seed,velocity,motion+.05)-drift(seed,velocity,motion))/.05;
    return {x:.06+.88*drift(seed,(.005+individuality*.003)*(i%2?1:-1),motion),y:.18+.60*drift(depth,(i%5===0?.003:0)*(i%3?1:-1),motion),z:depth,variant:i,gait:(motion*cadence+i*2.718281828)%16,cadence,direction:dx<0?-1:1,profile:.9};
  });
  return {nodes,focus:selected.map(index=>nodes[index]),attention:Math.floor(seconds/5)%3};
}

if(typeof document!=='undefined') {
  const canvas=document.getElementById('activity-field'), stage=document.getElementById('field-stage');
  const ctx=canvas?.getContext('2d');
  if(ctx&&stage) {
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const labels=[...stage.querySelectorAll('[data-focus]')];
    const colors=['#367b63','#a55561','#466d9f'];
    let labelCenters=[16,16,16];
    let width=0,height=0,time=0,last=0,request=0,playing=!preference.matches,visible=true,fieldFocused=false;
    let selected=selectPeople(fieldAt(0).nodes),nextSwitch=[1.4,2.1,2.8];
    const sprites=Array.from({length:48},(_,variant)=>Array.from({length:16},(_,pose)=>{
      const sprite=document.createElement('canvas');sprite.width=76;sprite.height=140;
      const pen=sprite.getContext('2d');
      pen.fillStyle='#2e4838';
      for(let y=6;y<134;y+=2)for(let x=5;x<72;x+=2){
        if(ditherAt(x,y,variant,pose))pen.fillRect(x,y,1.5,1.5);
      }
      return sprite;
    }));
    const highlights=colors.map((color,index)=>{
      const surface=document.createElement('canvas');surface.width=76;surface.height=140;
      const pen=surface.getContext('2d'),gradient=pen.createLinearGradient(18,18,58,124);
      gradient.addColorStop(0,color);gradient.addColorStop(.48,['#21b879','#ee687c','#517cde'][index]);gradient.addColorStop(1,['#d6e97a','#f5be80','#a4dce6'][index]);
      return {surface,pen,gradient};
    });
    const restingNodes=fieldAt(0).nodes;
    const edges=restingNodes.flatMap((origin,i)=>restingNodes.map((node,index)=>({index,distance:Math.hypot(node.x-origin.x,node.y-origin.y)})).filter(item=>item.index>i&&item.distance<.20).sort((a,b)=>a.distance-b.distance).slice(0,3).map(item=>[i,item.index]));
    function draw(){
      stage.dataset.animationTime=time.toFixed(2);stage.dataset.renderer="canvas-2d";
      const initial=fieldAt(time);
      if(playing&&!fieldFocused)for(let i=0;i<3;i++)if(time>=nextSwitch[i]){
        const options=selectPeople(initial.nodes,Math.random,selected);selected[i]=options[i];nextSwitch[i]=time+2+Math.random()*1.2;
        labels[i].querySelector('span').animate([{transform:'translateX(-2px)',opacity:.45,textShadow:'2px 0 #a55561,-2px 0 #466d9f'},{transform:'translateX(2px)',opacity:1},{transform:'translateX(0)',opacity:1,textShadow:'none'}],{duration:260,easing:'steps(3,end)'});
      }
      const {nodes,focus,attention}=fieldAt(time,selected);
      ctx.clearRect(0,0,width,height);
      const scale=width<600?.62:1;
      for(const node of [...nodes].sort((a,b)=>a.z-b.z)) {
        const build=bodyShape(node.variant),size=(.29+node.z*.62)*scale;
        ctx.globalAlpha=.43+(.5-Math.abs(node.z-.5))*.95;
        ctx.filter=`blur(${depthBlur(node.z)}px)`;
        const pose=Math.floor(node.gait);
        ctx.save();ctx.translate(node.x*width,node.y*height);ctx.scale(node.direction*node.profile*build.width,build.height);
        let sprite=sprites[node.variant][pose];
        const label=selected.indexOf(node.variant);
        if(label!==-1){
          const {surface,pen,gradient}=highlights[label];
          pen.clearRect(0,0,76,140);pen.drawImage(sprite,0,0);
          pen.globalCompositeOperation='source-in';pen.fillStyle=gradient;pen.fillRect(0,0,76,140);pen.globalCompositeOperation='source-over';
          sprite=surface;ctx.globalAlpha=Math.max(ctx.globalAlpha,.92);
        }
        ctx.drawImage(sprite,-38*size,-70*size,76*size,140*size);ctx.restore();
      }
      ctx.filter='none';ctx.globalAlpha=1;
      const beat=time%7;
      const lineStrength=beat<4.4?Math.min(1,beat/.4):Math.max(0,1-(beat-4.4)/.4);
      ctx.strokeStyle='#566b5d';ctx.lineWidth=.45;ctx.globalAlpha=.04*lineStrength;
      for(const [a,b]of edges){ctx.beginPath();ctx.moveTo(nodes[a].x*width,nodes[a].y*height);ctx.lineTo(nodes[b].x*width,nodes[b].y*height);ctx.stroke();}
      ctx.globalAlpha=1;
      const boxes=focus.map(node=>focusBox(node,width,height));
      for(let i=0;i<3;i++) {
        const a=focus[i],box=boxes[i],next=boxes[(i+1)%3];
        ctx.globalAlpha=1;ctx.strokeStyle=colors[i];ctx.lineWidth=.75;
        ctx.beginPath();ctx.moveTo(box.x+labelCenters[i],box.y+7);ctx.lineTo(next.x+labelCenters[(i+1)%3],next.y+7);ctx.stroke();
        ctx.strokeStyle=colors[i];ctx.lineWidth=attention===i?1.2:.6;ctx.strokeRect(box.x,box.boxY,box.boxWidth,box.boxHeight);
        labels[i].style.transform=`translate(${box.x}px,${box.y}px)`;
        labels[i].querySelector('small').style.marginTop=(box.boxHeight+6)+'px';
        labels[i].style.opacity='1';labels[i].dataset.person=String(selected[i]);
      }
    }
    function tick(stamp){
      request=0;
      if(!playing||!visible||document.hidden||fieldFocused)return;
      if(!last)last=stamp;
      if(stamp-last>=50){time+=Math.min((stamp-last)/1000,.1);last=stamp;draw();}
      request=requestAnimationFrame(tick);
    }
    function sync(){cancelAnimationFrame(request);request=0;last=0;if(playing&&visible&&!document.hidden&&!fieldFocused)request=requestAnimationFrame(tick);}
    stage.addEventListener('focusin',()=>{fieldFocused=!!stage.querySelector(':focus-visible');sync();});
    stage.addEventListener('focusout',event=>{if(!stage.contains(event.relatedTarget)){fieldFocused=false;sync();}});
    preference.addEventListener('change',()=>{playing=!preference.matches;sync();draw();});
    document.addEventListener('visibilitychange',sync);
    new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(stage);
    new ResizeObserver(()=>{const nextWidth=stage.clientWidth,nextHeight=stage.clientHeight;if(nextWidth===width&&nextHeight===height)return;width=nextWidth;height=nextHeight;labelCenters=labels.map(label=>label.querySelector('span').offsetWidth/2);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();stage.classList.add('is-ready');}).observe(stage);
    sync();
  }
}
