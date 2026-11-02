export function walkingPose(frame) { const phase=(frame%16)/16*Math.PI*2; return {swing:Math.sin(phase),lift:Math.cos(phase)}; }

export function labelAnchor(x,width) { return Math.max(6,Math.min(width-106,x*width-10)); }

export function motionTime(seconds) {
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Time must be finite and nonnegative');
  return Math.floor(seconds/7)*4.8+Math.min(seconds%7,4.8);
}
export function selectPeople(nodes,random=Math.random,previous=[]) {
  return [[.12,.34],[.38,.62],[.66,.86]].map(([left,right],group)=>{
    const candidates=nodes.map((node,index)=>({node,index})).filter(({node,index})=>index!==previous[group]&&node.x>=left&&node.x<=right&&node.z>.25&&node.z<.72);
    return candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))].index;
  });
}
export function fieldAt(seconds,selected=[12,33,54]) {
  const motion=motionTime(seconds);
  const nodes=Array.from({length:72},(_,i)=>{
    const seed=(i*.61803398875)%1,depth=(i*.41421356237+.07)%1;
    const individuality=(i*.754877666)%1,cadence=4.5+individuality*3;
    return {x:.04+seed*.92+Math.sin(motion*(.045+individuality*.035)+i*1.7)*(.009+individuality*.008),y:.16+depth*.64+Math.cos(motion*(.04+seed*.035)+i)*.006,z:depth,variant:i%6,gait:(motion*cadence+i*2.718281828)%16,cadence,direction:seed<.5?-1:1,profile:.72+individuality*.30};
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
    let selected=selectPeople(fieldAt(0).nodes),nextSwitch=[4,5.3,6.6];
    const sprites=Array.from({length:6},(_,variant)=>Array.from({length:16},(_,pose)=>{
      const sprite=document.createElement('canvas');sprite.width=76;sprite.height=140;
      const pen=sprite.getContext('2d'),gait=walkingPose(pose),swing=gait.swing*(.45+variant*.08),lift=gait.lift*.65;
      function limb(points,color,width){pen.strokeStyle=color;pen.lineWidth=width;pen.lineCap='round';pen.lineJoin='round';pen.beginPath();pen.moveTo(...points[0]);for(const point of points.slice(1))pen.lineTo(...point);pen.stroke();}
      const feet=[[33+swing*15,118-Math.max(0,lift)*7],[43-swing*15,118-Math.max(0,-lift)*7]];
      limb([[33,70],[33+swing*7,94],feet[0]],'#6c756d',7);
      limb([[43,70],[43-swing*7,94],feet[1]],'#344138',8);
      const hands=[[27-swing*12,78],[50+swing*12,78]];
      limb([[29,43],[24-swing*6,61],hands[0]],'#6f786f',5);
      limb([[47,43],[53+swing*6,61],hands[1]],'#3d4c40',5);
      pen.fillStyle='#748174';for(const [x,y]of hands){pen.beginPath();pen.ellipse(x,y,3,4,0,0,Math.PI*2);pen.fill();}
      pen.fillStyle='#2e3b32';for(const [x,y]of feet){pen.beginPath();pen.ellipse(x+2,y,6,3,0,0,Math.PI*2);pen.fill();}
      pen.fillStyle='#27332c10';pen.beginPath();pen.ellipse(38,124,20,3,0,0,Math.PI*2);pen.fill();
      const body=pen.createLinearGradient(23,0,52,0);body.addColorStop(0,'#90978f');body.addColorStop(.45,variant%2?'#424c45':'#5d665e');body.addColorStop(1,'#303d33');
      pen.fillStyle=body;pen.beginPath();pen.moveTo(29,41);pen.quadraticCurveTo(38,35,47,41);pen.quadraticCurveTo(53,48,50,65);pen.lineTo(47,72);pen.quadraticCurveTo(38,78,29,72);pen.lineTo(26,65);pen.quadraticCurveTo(23,48,29,41);pen.fill();
      pen.fillStyle='#687269';pen.fillRect(34,31,8,10);
      const head=pen.createLinearGradient(29,0,47,0);head.addColorStop(0,'#a1a69c');head.addColorStop(1,'#465249');pen.fillStyle=head;pen.beginPath();pen.ellipse(38,25,7,9,0,0,Math.PI*2);pen.fill();
      return sprite;
    }));
    const restingNodes=fieldAt(0).nodes;
    const edges=restingNodes.flatMap((origin,i)=>restingNodes.map((node,index)=>({index,distance:Math.hypot(node.x-origin.x,node.y-origin.y)})).filter(item=>item.index>i&&item.distance<.20).sort((a,b)=>a.distance-b.distance).slice(0,3).map(item=>[i,item.index]));
    function draw(){
      const initial=fieldAt(time);
      if(playing&&!fieldFocused)for(let i=0;i<3;i++)if(time>=nextSwitch[i]){
        const options=selectPeople(initial.nodes,Math.random,selected);selected[i]=options[i];nextSwitch[i]=time+5+Math.random()*3;
        labels[i].querySelector('span').animate([{transform:'translateX(-2px)',opacity:.45,textShadow:'2px 0 #a55561,-2px 0 #466d9f'},{transform:'translateX(2px)',opacity:1},{transform:'translateX(0)',opacity:1,textShadow:'none'}],{duration:260,easing:'steps(3,end)'});
      }
      const {nodes,focus,attention}=fieldAt(time,selected);
      ctx.clearRect(0,0,width,height);
      const scale=width<600?.62:1;
      for(const node of [...nodes].sort((a,b)=>a.z-b.z)) {
        const size=(.26+node.z*.67)*scale;
        ctx.globalAlpha=.28+(.5-Math.abs(node.z-.5))*.9;
        ctx.filter=`blur(${Math.max(0,Math.abs(node.z-.5)-.12)*8}px)`;
        const pose=Math.floor(node.gait);
        ctx.save();ctx.translate(node.x*width,node.y*height);ctx.scale(node.direction*node.profile,1);
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
        ctx.globalAlpha=lineStrength;ctx.strokeStyle=colors[i]+(attention===i?'60':'24');ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(a.x*width,a.y*height);ctx.lineTo(b.x*width,b.y*height);ctx.stroke();
        ctx.globalAlpha=1;ctx.strokeStyle=colors[i];ctx.lineWidth=attention===i?1.2:.6;ctx.strokeRect(a.x*width-10,a.y*height-24,20,44);
        labels[i].style.transform=`translate(${labelAnchor(a.x,width)}px,${a.y*height-43}px)`;
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
    stage.addEventListener('focusin',()=>{fieldFocused=true;sync();});
    stage.addEventListener('focusout',event=>{if(!stage.contains(event.relatedTarget)){fieldFocused=false;sync();}});
    preference.addEventListener('change',()=>{playing=!preference.matches;sync();draw();});
    document.addEventListener('visibilitychange',sync);
    new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(stage);
    new ResizeObserver(()=>{const nextWidth=stage.clientWidth,nextHeight=Math.min(400,Math.max(260,stage.clientWidth*.3));if(nextWidth===width&&nextHeight===height)return;width=nextWidth;height=nextHeight;stage.style.height=height+'px';const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();stage.classList.add('is-ready');}).observe(stage);
    sync();
  }
}
