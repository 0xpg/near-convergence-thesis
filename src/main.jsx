import React,{Component} from 'react';
import {createRoot} from 'react-dom/client';
import {Landing,Lab,Report,Research,Methodology} from './pages.jsx';
import ThesisPage from './ThesisPage.jsx';
import './root.css';

class ErrorBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="app-error"><h1>This page could not load.</h1><p>Reload to try again. The saved research report remains available.</p><a href="report.pdf" download>Download PDF</a></main>:this.props.children;}
}
const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/index';
const pages={'/index':Landing,'/thesis':ThesisPage,'/lab':Lab,'/report':Report,'/research':Research,'/methodology':Methodology};
if(path==='/explore')location.replace('research.html#explore');
const Page=pages[path]||(()=> <main className="app-error"><h1>Page not found</h1><a href="index.html">Return home</a></main>);
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><Page/></ErrorBoundary></React.StrictMode>);
