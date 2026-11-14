import React,{Component,type ComponentType,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {resolveRoute,routes} from './routes.ts';
import {revealPage,startPageTransitions} from './page-transition.ts';
import './root.css';

class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="app-error"><h1>This page could not load.</h1><p>Reload to try again.</p><a href="/">Return home</a></main>:this.props.children;}
}

function NotFound(){return <main className="app-error"><h1>Page not found</h1><a href="/">Return home</a></main>;}

function loadStyles(hrefs:string[]){
  return Promise.all(hrefs.map(href=>new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;
    link.onload=link.onerror=resolve;document.head.append(link);
  })));
}

async function start(){
  startPageTransitions();
  const target=resolveRoute(location.pathname);
  if(target.redirect!==undefined){location.replace(target.redirect+(target.redirect.includes('#')?'':location.hash));return;}
  const path=target.path;
  if(path!==location.pathname)history.replaceState(null,'',path+location.search+location.hash);
  const route=routes[path];
  let Page:ComponentType=NotFound;
  if(route){
    document.title=route.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content',route.description);
    const [component]=await Promise.all([route.load(),loadStyles(route.styles)]);
    Page=component;
  }
  createRoot(document.getElementById('root') as HTMLElement).render(<React.StrictMode><ErrorBoundary><Page/></ErrorBoundary></React.StrictMode>);
  revealPage();
}

start().catch(()=>document.body.classList.add('page-in'));
