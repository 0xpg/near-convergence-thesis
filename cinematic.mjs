export function fieldAt(seconds) {
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Time must be finite and nonnegative');
  const nodes=Array.from({length:72},(_,i)=>{
    const seed=(i*0.61803398875)%1, depth=((i*0.41421356237+0.07)%1);
    return {x:0.04+seed*0.92+Math.sin(seconds*0.13+i*1.7)*0.014,y:0.16+depth*0.64+Math.cos(seconds*0.11+i)*0.008,z:depth,variant:i%6};
  });
  const bases=[[.25,.43],[.49,.34],[.74,.54]];
  const focus=bases.map(([x,y],i)=>({x:x+Math.sin(seconds*.12+i*2)*.045,y:y+Math.cos(seconds*.15+i)*.035,z:.5,variant:i+1}));
  return {nodes,focus,attention:Math.floor(seconds/5)%3};
}

if(typeof document!=='undefined') {
  const canvas=document.getElementById('activity-field'), stage=document.getElementById('field-stage'),button=document.getElementById('motion-toggle');
  const ctx=canvas?.getContext('2d');
  if(ctx&&stage&&button) {
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const labels=[...stage.querySelectorAll('[data-focus]')];
    const colors=['#367b63','#a55561','#466d9f'];
    let width=0,height=0,time=0,last=0,request=0,playing=!preference.matches,visible=true,fieldFocused=false;
    const sprites=Array.from({length:6},(_,variant)=>{
      const sprite=document.createElement('canvas');sprite.width=76;sprite.height=140;
      const pen=sprite.getContext('2d');pen.font='11px monospace';pen.fillStyle='#3e4544';
      const ramp=' .:+ox#';
      for(let y=0;y<13;y++)for(let x=0;x<7;x++) {
        const nx=(x-3)/3,ny=(y-6)/6;
        const shape=nx*nx/(.38+.12*Math.sin(y*.55+variant))+ny*ny;
        if(shape>1)continue;
        const shade=Math.max(1,Math.min(6,Math.round((1-Math.abs(nx)) *4+Math.sin(y+variant)*1.2+1)));
        pen.fillText(ramp[shade],x*9+6,y*10+12);
      }
      return sprite;
    });
    function draw(){
      const {nodes,focus,attention}=fieldAt(time);
      ctx.clearRect(0,0,width,height);
      const scale=width<600?.62:1;
      for(const node of [...nodes,...focus].sort((a,b)=>a.z-b.z)) {
        const size=(.26+node.z*.67)*scale;
        ctx.globalAlpha=.28+(.5-Math.abs(node.z-.5))*.9;
        ctx.filter=`blur(${Math.max(0,Math.abs(node.z-.5)-.12)*8}px)`;
        ctx.drawImage(sprites[node.variant],node.x*width-38*size,node.y*height-70*size,76*size,140*size);
      }
      ctx.filter='none';ctx.globalAlpha=1;
      for(let i=0;i<3;i++) {
        const a=focus[i],b=focus[(i+1)%3];
        ctx.strokeStyle=colors[i]+(attention===i?'60':'24');ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(a.x*width,a.y*height);ctx.lineTo(b.x*width,b.y*height);ctx.stroke();
        ctx.strokeStyle=colors[i];ctx.lineWidth=attention===i?1.2:.6;ctx.strokeRect(a.x*width-10,a.y*height-24,20,44);
        labels[i].style.transform=`translate(${a.x*width-10}px,${a.y*height-43}px)`;
        labels[i].style.opacity='1';
      }
    }
    function updateButton(){button.textContent=playing?'Pause motion':'Play motion';button.setAttribute('aria-label',playing?'Pause illustrative animation':'Play illustrative animation');}
    function tick(stamp){
      request=0;
      if(!playing||!visible||document.hidden||fieldFocused)return;
      if(!last)last=stamp;
      if(stamp-last>=50){time+=Math.min((stamp-last)/1000,.1);last=stamp;draw();}
      request=requestAnimationFrame(tick);
    }
    function sync(){cancelAnimationFrame(request);request=0;last=0;updateButton();if(playing&&visible&&!document.hidden&&!fieldFocused)request=requestAnimationFrame(tick);}
    button.hidden=false;
    stage.addEventListener('focusin',()=>{fieldFocused=true;sync();});
    stage.addEventListener('focusout',event=>{if(!stage.contains(event.relatedTarget)){fieldFocused=false;sync();}});
    button.addEventListener('click',()=>{playing=!playing;sync();});
    preference.addEventListener('change',()=>{playing=!preference.matches;sync();draw();});
    document.addEventListener('visibilitychange',sync);
    new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(stage);
    new ResizeObserver(()=>{const nextWidth=stage.clientWidth,nextHeight=Math.min(400,Math.max(260,stage.clientWidth*.3));if(nextWidth===width&&nextHeight===height)return;width=nextWidth;height=nextHeight;stage.style.height=height+'px';const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();stage.classList.add('is-ready');}).observe(stage);
    sync();
  }
}
