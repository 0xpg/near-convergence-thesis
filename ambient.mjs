const soundtrack=document.getElementById('ambient-track');
if(soundtrack){
  soundtrack.volume=.3;
  let pending=false;
  function stopListening(){document.removeEventListener('pointerup',start);document.removeEventListener('keydown',start);}
  async function start(){
    if(pending||!soundtrack.paused)return;
    pending=true;
    try {await soundtrack.play();soundtrack.dataset.state='playing';stopListening();}
    catch(error){
      soundtrack.dataset.state=error.name==='NotAllowedError'?'waiting-for-interaction':'unavailable';
      if(error.name!=='NotAllowedError'&&error.name!=='AbortError')stopListening();
    } finally {pending=false;}
  }
  soundtrack.addEventListener('error',()=>{soundtrack.dataset.state='unavailable';stopListening();});
  document.addEventListener('pointerup',start);document.addEventListener('keydown',start);
  start();
}
