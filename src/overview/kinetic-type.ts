const clamp=value=>Math.max(0,Math.min(1,value));
export function wordReveal(index,count,seconds){
  const order=index/Math.max(1,count-1);
  return Math.min(clamp((seconds-order*.65)/.15),clamp((2.9+order*.7-seconds)/.15));
}
export function startKineticType(stage:HTMLElement){
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const cells=Array.from(stage.querySelectorAll<HTMLElement>('.kinetic-cell'));
  const inner=(cell:HTMLElement)=>cell.firstElementChild as HTMLElement;
  let active=true,frame=0,widths:number[]=[],lastSeconds:number|null=null;
  function paint(){
    frame=0;if(!active)return;
    const rect=stage.getBoundingClientRect(),height=innerHeight;
    const seconds=preference.matches?1.5:clamp((height*.9-rect.top)/(height*.8+rect.height))*3.6;
    if(seconds===lastSeconds||widths.length!==cells.length)return;lastSeconds=seconds;
    for(let index=0;index<cells.length;index++){
      const cell=cells[index],mark=cell.dataset.mark==='true';
      const amount=mark?Math.min(clamp((seconds-.55)/.2),clamp((2.7-seconds)/.2)):wordReveal(index,cells.length,seconds);
      const width=`${widths[index]*amount}px`;
      if(cell.style.width!==width)cell.style.width=width;
      const transform=mark?`scaleX(${.45+.55*Math.abs(Math.sin(seconds*5))})`:`translateY(${(1-amount)*.8}em)`;
      if(inner(cell).style.transform!==transform)inner(cell).style.transform=transform;
    }
  }
  function update(){if(preference.matches)return;if(!frame&&active)frame=requestAnimationFrame(paint);}
  function measure(){if(!active)return;lastSeconds=null;widths=cells.map(cell=>inner(cell).offsetWidth);paint();}
  const observer=new ResizeObserver(measure);observer.observe(stage);
  document.fonts.ready.then(measure);
  addEventListener('scroll',update,{passive:true});addEventListener('resize',measure);preference.addEventListener('change',measure);
  return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();removeEventListener('scroll',update);removeEventListener('resize',measure);preference.removeEventListener('change',measure);};
}
