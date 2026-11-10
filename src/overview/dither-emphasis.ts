export function startDitherEmphasis(section:HTMLElement){
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)entry.target.classList.toggle('is-ink-visible',entry.isIntersecting);
  },{threshold:.25});
  for(const emphasis of section.querySelectorAll('strong'))observer.observe(emphasis);
  return()=>observer.disconnect();
}
