import {resolveRoute,routes} from './routes.ts';

const LEAVE_MS=220,FONT_WAIT_MS=600;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const body=()=>document.body;

export function revealPage(){
  const show=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{body().classList.remove('page-out');body().classList.add('page-in');}));
  const fonts=document.fonts?.ready??Promise.resolve();
  Promise.race([fonts,new Promise(resolve=>setTimeout(resolve,FONT_WAIT_MS))]).then(show,show);
}

function internalTarget(event:MouseEvent):URL|null{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return null;
  const anchor=(event.target as Element|null)?.closest?.('a[href]') as HTMLAnchorElement|null;
  if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return null;
  const url=new URL(anchor.href,location.href);
  if(url.origin!==location.origin)return null;
  const next=resolveRoute(url.pathname),current=resolveRoute(location.pathname);
  if(next.redirect===undefined&&!routes[next.path])return null;
  if(next.path!==undefined&&next.path===current.path)return null;
  return url;
}

export function startPageTransitions(){
  document.addEventListener('click',event=>{
    const url=internalTarget(event);
    if(!url||reduced())return;
    event.preventDefault();
    body().classList.remove('page-in');
    body().classList.add('page-out');
    setTimeout(()=>location.assign(url.href),LEAVE_MS);
  });
  addEventListener('pageshow',event=>{if(event.persisted)revealPage();});
}
