import type {ComponentType} from 'react';

export type Route={title:string,description:string,styles:string[],load:()=>Promise<ComponentType>};

export const routes:Record<string,Route>={
  '/':{title:"NEAR / Investment research",description:"Explore NEAR’s place in the agent economy: financial infrastructure, cross-chain settlement, and the evidence behind the investment case.",styles:['/styles/landing.css?v=layout-25'],load:()=>import('./pages.tsx').then(module=>module.Landing)},
  '/thesis':{title:"Thesis / NEAR",description:"Explore NEAR architecture, AI convergence and token economics through interactive frameworks and linked Dune research.",styles:['/styles/overview.css'],load:()=>import('./ThesisPage.tsx').then(module=>module.default)},
  '/lab':{title:"Scenario lab / NEAR research",description:"An evidence-backed study of NEAR's distribution franchise, token economics and the assumptions between them.",styles:['/styles/overview.css'],load:()=>import('./pages.tsx').then(module=>module.Lab)},
  '/research':{title:"NEAR — The missing link",description:"An evidence-backed study of NEAR's distribution franchise, token economics and the assumptions between them.",styles:['/styles/styles.css?v=controls-25'],load:()=>import('./pages.tsx').then(module=>module.Research)},
  '/methodology':{title:"Methods & reproduction / NEAR Research",description:"How the NEAR research snapshot was collected, calculated and reproduced.",styles:['/styles/styles.css?v=controls-25','/styles/methodology.css'],load:()=>import('./pages.tsx').then(module=>module.Methodology)}
};

const redirects:Record<string,string>={'/explore':'/research#explore','/report':'/thesis'};

export function resolveRoute(pathname:string):{path:string,redirect?:undefined}|{redirect:string,path?:undefined}{
  let path=pathname.replace(/\/+$/,'').replace(/\.html$/,'')||'/';
  if(path==='/index')path='/';
  if(redirects[path])return {redirect:redirects[path]};
  return {path};
}
