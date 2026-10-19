// ---------- team media library picker ----------
// Every "upload" opens this picker: choose something the team already uploaded,
// or upload from this device (which also adds it to the team library).
(function(){
  const MP={items:null,filter:'all',q:'',input:null};
  const esc2=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const who=()=>{try{return localStorage.getItem('lm-author')||'';}catch(e){return '';}};
  const el=id=>document.getElementById(id);
  function toast(msg,ms){ const t=el('mpToast'); t.textContent=msg; t.classList.add('on'); clearTimeout(t._h); if(ms!==0) t._h=setTimeout(()=>t.classList.remove('on'),ms||3500); }
  function allows(m){ const acc=(MP.input&&MP.input.accept)||''; if(!acc) return true;
    return acc.split(',').some(a=>{a=a.trim(); if(a.endsWith('/*')) return m.type.startsWith(a.slice(0,-1)); return a===m.type;}); }
  async function load(force){
    if(MP.items&&!force) return MP.items;
    try{ const r=await fetch('/api/media',{cache:'no-store'}); MP.items=r.ok?await r.json():[]; }catch(e){ MP.items=[]; }
    return MP.items;
  }
  function feed(input,file){ const dt=new DataTransfer(); dt.items.add(file); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); }
  async function upload(file){
    const r=await fetch('/api/media?name='+encodeURIComponent(file.name||'file')+'&by='+encodeURIComponent(who()),{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
    if(!r.ok){ let m='Could not add it to the team library.'; try{m=(await r.json()).error||m;}catch(e){} throw new Error(m); }
    MP.items=null; return r.json();
  }
  function fmtDate(t){ return new Date(t||0).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'}); }
  function thumb(m){ return m.kind==='video'
    ? `<video src="${m.url}#t=0.1" muted playsinline preload="metadata"></video><span class="mpKind">Video</span>`
    : `<img src="${m.url}" alt="" loading="lazy">${m.kind==='gif'?'<span class="mpKind">GIF</span>':''}`; }
  function draw(){
    const q=MP.q.toLowerCase();
    const rows=(MP.items||[]).filter(allows).filter(m=>MP.filter==='all'||m.kind===MP.filter).filter(m=>!q||(m.name+' '+(m.uploader||'')).toLowerCase().includes(q));
    el('mpGrid').innerHTML=rows.length?rows.map(m=>`<button type="button" class="mpItem" data-mid="${m.id}" title="${esc2(m.name)}">
      <span class="mpThumb">${thumb(m)}</span><span class="mpName">${esc2(m.name)}</span>
      <span class="mpMeta">${m.uploader?esc2(m.uploader)+', ':''}${fmtDate(m.uploadedAt)}</span></button>`).join('')
      :`<p class="mpEmpty">${(MP.items||[]).length?'Nothing matches.':'The team library is empty. Upload something to start it.'}</p>`;
    document.querySelectorAll('#mediaPicker [data-mpf]').forEach(b=>b.classList.toggle('on',b.dataset.mpf===MP.filter));
  }
  async function open(input){
    MP.input=input; el('mediaPicker').classList.add('on'); el('mpSearch').value=MP.q;
    el('mpGrid').innerHTML='<p class="mpEmpty">Loading the team library…</p>';
    await load(true); draw();
  }
  function close(){ el('mediaPicker').classList.remove('on'); }
  async function useLocal(file){
    if(!file) return; const input=MP.input; close();
    feed(input,file);
    toast('Adding to the team library…',0);
    try{ await upload(file); toast('Added to the team library.'); }catch(e){ toast(e.message||'Could not add it to the team library.',6000); }
  }
  window.openMediaPicker=open;
  document.addEventListener('DOMContentLoaded',()=>{});
  el('mpClose').addEventListener('click',close);
  el('mediaPicker').addEventListener('click',e=>{ if(e.target.id==='mediaPicker') close(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&el('mediaPicker').classList.contains('on')) close(); });
  el('mpUploadBtn').addEventListener('click',()=>{ const f=el('mpFile'); f.accept=(MP.input&&MP.input.accept)||''; f.value=''; f.click(); });
  el('mpFile').addEventListener('change',e=>useLocal(e.target.files[0]));
  el('mpSearch').addEventListener('input',e=>{MP.q=e.target.value; draw();});
  document.querySelectorAll('#mediaPicker [data-mpf]').forEach(b=>b.addEventListener('click',()=>{MP.filter=b.dataset.mpf; draw();}));
  const card=el('mpCard');
  ['dragenter','dragover'].forEach(t=>card.addEventListener(t,e=>{e.preventDefault(); card.classList.add('drop');}));
  ['dragleave','drop'].forEach(t=>card.addEventListener(t,e=>{e.preventDefault(); card.classList.remove('drop');}));
  card.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) useLocal(f); });
  el('mpGrid').addEventListener('click',async e=>{
    const b=e.target.closest('[data-mid]'); if(!b) return;
    const m=(MP.items||[]).find(x=>x.id===b.dataset.mid); if(!m) return;
    b.classList.add('busy');
    try{
      const r=await fetch(m.url); if(!r.ok) throw 0;
      const blob=await r.blob(); const input=MP.input; close();
      feed(input,new File([blob],m.name,{type:m.type||blob.type}));
    }catch(err){ toast('Could not open that file. Try again.'); }
    b.classList.remove('busy');
  });
})();
