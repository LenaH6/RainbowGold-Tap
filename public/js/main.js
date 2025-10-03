document.addEventListener('DOMContentLoaded', ()=>{
  const $ = (id)=> document.getElementById(id);
  const open = (c)=>{ const m={UP:['drawerUP','backdropUP'],IN:['drawerIN','backdropIN'],PF:['drawerPF','backdropPF'],ID:['drawerID','backdropID']}; const [dr,bd]=m[c]||[]; document.getElementById(dr)?.classList.add('show'); document.getElementById(bd)?.classList.add('show'); };
  const close = (c)=>{ const m={UP:['drawerUP','backdropUP'],IN:['drawerIN','backdropIN'],PF:['drawerPF','backdropPF'],ID:['drawerID','backdropID']}; const [dr,bd]=m[c]||[]; document.getElementById(dr)?.classList.remove('show'); document.getElementById(bd)?.classList.remove('show'); };
  window.openDrawer=open; window.closeDrawer=close;

  $('#profileBtn')?.addEventListener('click', ()=> open('PF'));
  $('#inboxBtn')?.addEventListener('click', ()=> open('IN'));
  $('#openUp')?.addEventListener('click', ()=> open('UP'));
  const trophyBtn = $('#trophyBtn'), trophyTip = $('#trophyTip');
  if (trophyBtn && trophyTip){ trophyBtn.addEventListener('click', ()=>{ const vis=trophyTip.style.opacity!=='1'; trophyTip.style.opacity = vis?'1':'0'; if (vis) setTimeout(()=>trophyTip.style.opacity='0', 1200); }); }
});