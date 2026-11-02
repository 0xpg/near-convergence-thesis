export function walkingPose(frame) { const phase=(frame%16)/16*Math.PI*2; return {swing:Math.sin(phase),lift:Math.cos(phase)}; }

export function bodyShape(variant){return [{width:.82,height:.76,weight:.9},{width:1.28,height:.96,weight:1.3},{width:1,height:1,weight:1}][variant%3];}

export function ditherAt(x,y,variant,frame) {
  const seed=(variant*.61803398875)%1,{swing,lift}=walkingPose(frame);
  const build=bodyShape(variant);
  const center=38,shoulder=(8+seed*3)*build.weight,hip=(5+seed*2)*build.weight,stride=swing*(10+seed*9);
  const segment=(ax,ay,bx,by,r)=>{
    r*=build.weight;
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-ax-t*dx,y-ay-t*dy)/r;
  };
  const body=Math.hypot((x-center)/((9+seed*3)*build.weight),(y-57)/21);
  const head=Math.hypot((x-center)/(6+seed*1.5),(y-23)/8);
  let distance=Math.min(body,head,segment(center,30,center,41,3),segment(center+4,23,center+8,26,2));
  for(const side of [-1,1]){
    const knee=center+side*hip+side*stride*.45,foot=center+side*hip+side*stride;
    const footY=121-Math.max(0,side*lift)*7;
    const elbow=center+side*(shoulder+4)-side*stride*.35,hand=center+side*(shoulder+3)-side*stride*.7;
    distance=Math.min(distance,
      segment(center+side*hip,74,knee,98,3.6),segment(knee,98,foot,footY,3),segment(foot,footY,foot+4,footY,2.7),
      segment(center+side*shoulder,43,elbow,61,2.8),segment(elbow,61,hand,80,2.3));
  }
  const density=distance<1?Math.min(.97,.55+(1-distance)*.45):0;
  const threshold=((Math.sin(x*127.1+y*311.7+variant*74.7)*43758.5453)%1+1)%1;
  return threshold<density;
}

export function depthBlur(depth){return Math.max(0,Math.abs(depth-.5)-.08)*19;}

export function labelAnchor(x,width) { return Math.max(6,Math.min(width-106,x*width-10)); }

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
    const individuality=(i*.754877666)%1,cadence=4.5+individuality*3;
    const velocity=(.009+individuality*.012)*(i%2?1:-1);
    const dx=.88*(drift(seed,velocity,motion+.05)-drift(seed,velocity,motion))/.05+.006*Math.cos(motion*.4+i);
    return {x:.06+.88*drift(seed,(.009+individuality*.012)*(i%2?1:-1),motion)+Math.sin(motion*.4+i)*.015,y:.18+.60*drift(depth,(.014+seed*.018)*(i%3?1:-1),motion)+Math.cos(motion*.3+i)*.015,z:depth,variant:i,gait:(motion*cadence+i*2.718281828)%16,cadence,direction:dx<0?-1:1,profile:.72+individuality*.30};
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
    let width=0,height=0,time=0,last=0,request=0,playing=!preference.matches,visible=true,fieldFocused=false;
    let selected=selectPeople(fieldAt(0).nodes),nextSwitch=[1.4,2.1,2.8];
    const sprites=Array.from({length:48},(_,variant)=>Array.from({length:8},(_,pose)=>{
      const sprite=document.createElement('canvas');sprite.width=76;sprite.height=140;
      const pen=sprite.getContext('2d');
      pen.fillStyle='#2e4838';
      for(let y=6;y<134;y+=3)for(let x=5;x<72;x+=3){
        if(ditherAt(x,y,variant,pose*2))pen.fillRect(x,y,2,2);
      }
      return sprite;
    }));
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
        const build=bodyShape(node.variant),size=(.38+node.z*.87)*scale;
        ctx.globalAlpha=.43+(.5-Math.abs(node.z-.5))*.95;
        ctx.filter=`blur(${depthBlur(node.z)}px)`;
        const pose=Math.floor(node.gait/2);
        ctx.save();ctx.translate(node.x*width,node.y*height);ctx.scale(node.direction*node.profile*build.width,build.height);
        ctx.drawImage(sprites[node.variant][pose],-38*size,-70*size,76*size,140*size);ctx.restore();
      }
      ctx.filter='none';ctx.globalAlpha=1;
      const beat=time%7;
      const lineStrength=beat<4.4?Math.min(1,beat/.4):Math.max(0,1-(beat-4.4)/.4);
      ctx.strokeStyle='#566b5d';ctx.lineWidth=.45;ctx.globalAlpha=.12*lineStrength;
      for(const [a,b]of edges){ctx.beginPath();ctx.moveTo(nodes[a].x*width,nodes[a].y*height);ctx.lineTo(nodes[b].x*width,nodes[b].y*height);ctx.stroke();}
      ctx.globalAlpha=1;
      for(let i=0;i<3;i++) {
        const a=focus[i],b=focus[(i+1)%3];
        ctx.globalAlpha=1;ctx.strokeStyle=colors[i];ctx.lineWidth=1.1;
        ctx.beginPath();ctx.moveTo(labelAnchor(a.x,width)+28,Math.max(6,Math.min(height-100,a.y*height-43))+9);ctx.lineTo(labelAnchor(b.x,width)+28,Math.max(6,Math.min(height-100,b.y*height-43))+9);ctx.stroke();
        ctx.globalAlpha=1;ctx.strokeStyle=colors[i];ctx.lineWidth=attention===i?1.2:.6;ctx.strokeRect(a.x*width-10,a.y*height-24,20,44);
        labels[i].style.transform=`translate(${labelAnchor(a.x,width)}px,${Math.max(6,Math.min(height-100,a.y*height-43))}px)`;
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
    new ResizeObserver(()=>{const nextWidth=stage.clientWidth,nextHeight=Math.min(400,Math.max(260,stage.clientWidth*.3));if(nextWidth===width&&nextHeight===height)return;width=nextWidth;height=nextHeight;stage.style.height=height+'px';const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();stage.classList.add('is-ready');}).observe(stage);
    sync();
  }
}
