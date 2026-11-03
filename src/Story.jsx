import {useCallback, useEffect, useRef, useState} from 'react';
import {frames} from '../story-frames.mjs';
import {sourceUrl, stepIndex} from './story-utils.mjs';

export default function Story() {
  const [current, setCurrent] = useState(() => Math.max(0, frames.findIndex(frame => frame.id === (typeof location==='undefined'?'':location.hash.slice(1)))));
  const [panel, setPanel] = useState(null);
  const [detail, setDetail] = useState(null);
  const canvasRef = useRef(null), contentRef = useRef(null), frameRef = useRef(null);
  const chapterRef = useRef(null), sourcesRef = useRef(null), openerRef = useRef(null);
  const chapterCloseRef = useRef(null), sourcesCloseRef = useRef(null), detailCloseRef = useRef(null);
  const available = frames.length > 0, frame = frames[current];
  const sources = (frame?.sources || []).map(source => ({...source, url: sourceUrl(source.url)})).filter(source => source.url);
  const closePanel = useCallback(() => {
    setPanel(null);
    openerRef.current?.focus();
  }, []);
  const openPanel = (name, opener) => {
    openerRef.current = opener;
    setPanel(name);
  };
  const go = useCallback(index => {
    if (!frames.length) return;
    const next = Math.max(0, Math.min(frames.length - 1, index));
    setCurrent(next);
    setPanel(null);
    history.replaceState(null, '', '#' + frames[next].id);
  }, []);

  useEffect(() => {
    const close = {chapters: chapterCloseRef, sources: sourcesCloseRef, detail: detailCloseRef}[panel];
    close?.current?.focus();
  }, [panel]);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape' && panel) { closePanel(); return; }
      if (panel || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        go(stepIndex(current, event.key === 'ArrowRight' ? 1 : -1, frames.length));
      }
    };
    const onHash = () => {
      const index = frames.findIndex(item => item.id === location.hash.slice(1));
      if (index >= 0) go(index);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, [current, panel, closePanel, go]);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext('2d');
    if (!ctx) return;
    let active = true;
    function draw() {
      if (!active) return;
      const width = canvas.clientWidth, height = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.font = "10px 'Saans Mono',monospace"; ctx.textAlign = 'center';
      const glyphs = '.:+x';
      for (let y = 12; y < height; y += 13) for (let x = 10; x < width; x += 10) {
        const u = (x - width * .69) / width, v = (y - height * .48) / height, r = Math.hypot(u * 1.4, v), angle = Math.atan2(v, u);
        const wave = Math.sin(r * 46 + angle * 2 + current * .6) + Math.sin(u * 21 - v * 17) * .22;
        const grain = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
        const density = Math.max(0, 1 - r * 1.7) * Math.max(0, wave - .12);
        if (grain < density * .58) {
          ctx.fillStyle = `rgba(173,204,157,${.15 + density * .42})`;
          ctx.fillText(glyphs[Math.floor(grain * 31) % glyphs.length], x, y);
        }
      }
    }
    const observer = new ResizeObserver(draw);
    observer.observe(canvas); document.fonts.ready.then(draw); draw();
    return () => { active = false; observer.disconnect(); };
  }, [current]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (!available || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = frameRef.current.animate([{opacity: 0, transform: 'translateY(12px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 400, easing: 'ease-out'});
    return () => animation.cancel();
  }, [current, available]);

  return <>
    <a className="story-skip" href="#story-content">Skip to story</a>
    <main id="story" className="story-stage" aria-label="NEAR visual thesis">
      <canvas id="story-field" ref={canvasRef} aria-hidden="true" />
      <div className="story-vignette" aria-hidden="true" />
      <header className="story-header">
        <a className="story-brand" href="index.html" aria-label="NEAR home">NEAR</a><span>Visual thesis</span>
        <div><button ref={chapterRef} id="chapter-toggle" type="button" aria-expanded={panel === 'chapters'} aria-controls="chapter-panel" onClick={() => panel === 'chapters' ? closePanel() : openPanel('chapters', chapterRef.current)}>Chapters</button><a href="index.html">Exit story</a></div>
      </header>
      <section ref={contentRef} id="story-content" className="story-content" tabIndex={-1} aria-live="polite">
        <div id="story-empty" hidden={available}><p className="story-kicker">Story in preparation</p><h1>NEAR</h1><p className="story-pending">Awaiting research material</p></div>
        <article ref={frameRef} id="story-frame" hidden={!available}><p id="frame-kicker" className="story-kicker">{frame?.kicker || ''}</p><h1 id="frame-title">{frame?.title || ''}</h1><div id="frame-body">{frame?.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></article>
      </section>
      <div id="story-visual" className="story-visual">
        <pre id="frame-ascii" aria-label="Story visualization" hidden={!frame?.ascii}>{frame?.ascii || ''}</pre>
        <div id="story-hotspots">{(frame?.hotspots || []).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)).map((point, index) => <button key={index} className="story-hotspot" type="button" aria-label={point.title || 'Inspect evidence'} style={{left: `clamp(22px,${Math.max(0, Math.min(1, point.x)) * 100}%,calc(100% - 22px))`, top: `clamp(22px,${Math.max(0, Math.min(1, point.y)) * 100}%,calc(100% - 22px))`}} onClick={event => {setDetail(point); openPanel('detail', event.currentTarget);}}>+</button>)}</div>
      </div>
      <aside id="chapter-panel" className="chapter-panel" aria-label="Story chapters" hidden={panel !== 'chapters'}>
        <div><h2>Chapters</h2><button ref={chapterCloseRef} id="chapter-close" type="button" onClick={closePanel}>Close</button></div>
        <p id="chapter-empty" hidden={available}>Available when the story is ready.</p>
        <ol id="chapter-list">{frames.map((item, index) => <li key={item.id}><button type="button" aria-current={index === current ? 'step' : undefined} onClick={() => {go(index); chapterRef.current?.focus();}}>{item.title || 'Untitled scene'}</button></li>)}</ol>
      </aside>
      <aside id="story-detail" className="story-detail" aria-label="Evidence detail" hidden={panel !== 'detail'}><button ref={detailCloseRef} id="detail-close" type="button" onClick={closePanel}>Close</button><h2 id="detail-title">{detail?.title || ''}</h2><p id="detail-body">{detail?.description || ''}</p></aside>
      <footer className="story-footer">
        <button ref={sourcesRef} id="story-sources" type="button" hidden={!sources.length} onClick={() => openPanel('sources', sourcesRef.current)}>Sources</button>
        <span id="story-position" role="status">{available ? frame?.kicker || 'Visual thesis' : 'Awaiting material'}</span>
        <nav aria-label="Story navigation"><button id="story-back" type="button" disabled={!available || current === 0} onClick={() => go(stepIndex(current, -1, frames.length))}>Back</button><button id="story-next" type="button" disabled={!available || current === frames.length - 1} onClick={() => go(stepIndex(current, 1, frames.length))}>Continue</button></nav>
      </footer>
      <section id="source-panel" className="source-panel" aria-label="Sources for this scene" hidden={panel !== 'sources'}><h2>Sources</h2><ul id="source-list">{sources.map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label || source.url}</a></li>)}</ul><button ref={sourcesCloseRef} id="sources-close" type="button" onClick={closePanel}>Close</button></section>
    </main>
  </>;
}
