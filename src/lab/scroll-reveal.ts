export function startLabReveals(root:HTMLElement){
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 if(preference.matches||typeof IntersectionObserver==='undefined')return()=>{};
 const targets=[...root.querySelectorAll<HTMLElement>('.lab-models>header,.lab-console-controls,.lab-console-results,.lab-card')];
 const pending=new Set<HTMLElement>();
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   const target=entry.target as HTMLElement;
   if(!entry.isIntersecting||!pending.delete(target))continue;
   target.classList.remove('lab-reveal-pending');observer.unobserve(target);
  }
 },{threshold:0,rootMargin:'0px 0px -24px 0px'});
 const desktop=matchMedia('(min-width:761px)').matches;
 for(const target of targets){
  if(target.getBoundingClientRect().top<innerHeight-16)continue;
  const parent=target.parentElement;
  const delay=desktop&&parent?.classList.contains('lab-grid')?([...parent.children].indexOf(target)%2)*45:0;
  target.style.setProperty('--lab-reveal-delay',`${delay}ms`);
  target.classList.add('lab-scroll-reveal','lab-reveal-pending');pending.add(target);observer.observe(target);
 }
 const showAll=()=>{
  if(!pending.size)return;
  observer.disconnect();
  for(const target of targets){target.classList.remove('lab-scroll-reveal','lab-reveal-pending');target.style.removeProperty('--lab-reveal-delay');}
  pending.clear();
 };
 const keyboard=(event:KeyboardEvent)=>{if(['Tab','ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))showAll();};
 document.addEventListener('keydown',keyboard,true);preference.addEventListener('change',showAll);
 return()=>{
  observer.disconnect();document.removeEventListener('keydown',keyboard,true);preference.removeEventListener('change',showAll);
  for(const target of targets){target.classList.remove('lab-scroll-reveal','lab-reveal-pending');target.style.removeProperty('--lab-reveal-delay');}
 };
}
