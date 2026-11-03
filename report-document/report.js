document.getElementById('print-report').addEventListener('click', () => window.print());

for (const flow of document.querySelectorAll('.intents-flow')) {
  const panels = [...flow.querySelectorAll('[data-flow-panel]')];
  const stages = [...flow.querySelectorAll('[data-flow-step]')];
  const economics = flow.querySelector('[data-flow-economics]');
  function select(index) {
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    stages.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    flow.dataset.step = String(index);
  }
  stages.forEach((button, index) => {
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? stages.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + stages.length) % stages.length;
      stages[next].focus();
      select(next);
    });
  });
  economics.addEventListener('change', () => {
    flow.querySelectorAll('.flow-economics').forEach(detail => { detail.hidden = !economics.checked; });
  });
  flow.querySelector('[data-flow-motion]').addEventListener('click', event => {
    const paused = flow.dataset.paused !== 'true';
    flow.dataset.paused = String(paused);
    event.currentTarget.setAttribute('aria-pressed', String(paused));
    event.currentTarget.textContent = paused ? 'Resume animation' : 'Pause animation';
  });
  select(4);
}
