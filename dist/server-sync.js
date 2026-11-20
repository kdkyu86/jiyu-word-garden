'use strict';
/* The family server is authoritative; localStorage is only a recovery copy. */
const FamilySync = (() => {
  const pendingKey=KEY+'-pending-server';
  let revision=0,csrf='',ready=false,dirty=false,blocked=false,generation=0,lastSnapshot='',inflight=null,timer=null,message='Loading saved progress…';
  const originalShell=shell;
  shell=function(content){originalShell(content);decorate();};
  function decorate(){
    const bar=document.querySelector('.topbar');if(!bar)return;
    bar.querySelector('.family-controls')?.remove();
    const box=document.createElement('div');box.className='family-controls';
    const status=document.createElement('span');status.className='family-status'+(dirty||blocked?' pending':'');status.setAttribute('role','status');status.textContent=message;box.append(status);
    if(ready&&dirty&&!blocked){const b=document.createElement('button');b.className='smallbtn';b.textContent='Save now';b.dataset.a='familysave';box.append(b);}
    const logout=document.createElement('button');logout.className='smallbtn';logout.textContent='Log out';logout.dataset.a='familylogout';box.append(logout);bar.append(box);
  }
  function status(text){message=text;decorate();}
  function cachePending(){try{localStorage.setItem(pendingKey,JSON.stringify({revision,state:JSON.parse(lastSnapshot)}));}catch{storageOK=false;}}
  function downloadLocal(){
    let payload;try{payload=JSON.parse(lastSnapshot||JSON.stringify(state));}catch{payload=state;}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download='jiyu-device-backup-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function conflict(text){
    blocked=true;status('Not saved — another device has newer progress.');
    if(document.getElementById('family-conflict'))return;
    const panel=document.createElement('div');panel.className='modal';panel.id='family-conflict';
    panel.innerHTML='<div class="modalbox" role="dialog" aria-modal="true" aria-label="Progress needs your attention"><h2>Let’s keep both copies safe.</h2><p>'+esc(text)+'</p><p>Download this device’s backup first if you want to keep these latest changes. Loading the server copy will replace this device’s unsaved changes.</p><div class="row"><button class="secondary" data-a="familybackup">Download this device’s backup</button><button class="primary" data-a="familyreload">Load server progress</button></div></div>';
    document.body.append(panel);panel.querySelector('button').focus();
  }
  async function flush(){
    clearTimeout(timer);
    if(!ready||blocked)return false;
    if(inflight){await inflight;if(dirty&&!blocked)return flush();return !dirty;}
    if(!dirty)return true;
    const sent=generation,snapshot=lastSnapshot;status('Saving to our family garden…');
    let ok=false;
    inflight=(async()=>{
      try{
        const r=await fetch('/api/state',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({revision,state:JSON.parse(snapshot)})});
        if(r.status===409){conflict('Another family device has saved newer progress. We have kept your local copy instead of overwriting that progress.');return;}
        if(r.status===401||r.status===403){blocked=true;status('Sign in again to save.');showSessionExpired();return;}
        if(!r.ok)throw Error('save failed');
        const d=await r.json();revision=d.revision;ok=true;
        if(generation===sent){dirty=false;try{localStorage.removeItem(pendingKey);}catch{}status('Saved to our family garden');}
        else{cachePending();status('Saving your latest changes…');}
      }catch{status('Not saved yet — check your connection and retry.');}
    })();
    await inflight;inflight=null;
    if(ok&&dirty&&!blocked)timer=setTimeout(flush,0);
    return ok&&!dirty;
  }
  function queue(){
    lastSnapshot=JSON.stringify(state);generation++;dirty=true;
    try{localStorage.setItem(KEY,lastSnapshot);}catch{storageOK=false;}
    cachePending();status('Saving to our family garden…');clearTimeout(timer);if(ready&&!blocked)timer=setTimeout(flush,350);
    return true;
  }
  function showSessionExpired(){
    if(document.getElementById('family-expired'))return;
    const panel=document.createElement('div');panel.className='modal';panel.id='family-expired';
    panel.innerHTML='<div class="modalbox" role="dialog" aria-modal="true" aria-label="Sign in again"><h2>Time to sign in again.</h2><p>Your latest changes are kept on this device. After signing in, we’ll try saving them again.</p><div class="row"><button class="secondary" data-a="familybackup">Download a backup</button><a class="primary" href="/login">Sign in again</a></div></div>';
    document.body.append(panel);panel.querySelector('button').focus();
  }
  async function boot(){
    $('#app').innerHTML='<main class="sync-loading"><span style="font-size:50px">🌷</span><h1>Opening our garden…</h1><p>Getting your saved words and progress.</p></main>';
    try{
      const r=await fetch('/api/state',{credentials:'same-origin',cache:'no-store'});
      if(r.status===401){location.replace('/login');return;}
      if(!r.ok)throw Error();
      const d=await r.json();revision=d.revision;csrf=d.csrf;ready=true;blocked=false;
      const local=state;state=d.state||local;state.pausedSessions=state.pausedSessions||{};state.schema=3;
      if(state.session&&!state.session.key)state.session.key='legacy';
      let pending;try{pending=JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{}
      message=d.state?'Saved to our family garden':'Ready to save to our family garden';
      if(pending?.state){
        if(pending.revision===revision){state=pending.state;render();queue();return;}
        lastSnapshot=JSON.stringify(pending.state);render();conflict('There are unsaved changes from this device and a newer copy on the server.');return;
      }
      try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;}
      render();
    }catch{
      $('#app').innerHTML='<main class="sync-loading"><h1>The garden is taking a moment.</h1><p>We could not load the saved progress. Please check your connection.</p><div class="row"><button class="primary" data-a="familyboot">Try again</button><button class="secondary" data-a="familybackup">Download this device’s backup</button></div></main>';
    }
  }
  async function refresh(){
    if(!ready||dirty||inflight||blocked||document.hidden||document.querySelector('.studyhead')||document.querySelector('.modal')||document.getElementById('wordform'))return;
    try{
      const r=await fetch('/api/state',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;
      const d=await r.json();if(d.revision>revision){revision=d.revision;csrf=d.csrf;state=d.state;state.pausedSessions=state.pausedSessions||{};try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}render();status('Updated from our family garden');}
    }catch{}
  }
  async function logout(){
    if(dirty&&!await flush()){toast('Please save or download a backup before logging out.');return;}
    const r=await fetch('/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrf}});
    if(r.ok){try{localStorage.removeItem(KEY);localStorage.removeItem(pendingKey);}catch{}location.replace('/login');}
    else toast('Could not log out. Please try again.');
  }
  save=queue;
  actions.familysave=flush;actions.familyboot=boot;actions.familybackup=downloadLocal;actions.familylogout=()=>logout().catch(()=>toast('Check your connection and try again.'));
  actions.familyreload=()=>{try{localStorage.removeItem(pendingKey);}catch{}location.reload();};
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();else if(dirty)flush();});
  setInterval(refresh,15000);
  return {boot,flush};
})();
FamilySync.boot();
