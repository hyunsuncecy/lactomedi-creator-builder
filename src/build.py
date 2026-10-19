import re
SRC='/home/claude/demo/'; OUT='/home/claude/rw2/public/'; P='/home/claude/rw2/src/'
def R(s,a,b,n=1):
    assert s.count(a)==n,(a[:80],s.count(a)); return s.replace(a,b)
def team(s,app):
    s=R(s,"const LIB={kind:'local',db:null,assets:null,uid:null};","const LIB={kind:'local',db:null,assets:null,uid:null};\nconst TEAM_APP='"+app+"';")
    s=R(s,"""(async()=>{
  try{
    if(!(window.claude&&typeof window.claude.use==='function')) return;""","""(async()=>{
  try{
    const r=await fetch('/api/health',{cache:'no-store'});
    if(r.ok){ const j=await r.json(); if(j&&j.app==='lm-brief-builder') LIB.kind='team'; }
  }catch(e){}
  if(LIB.kind==='team'){ $('libWhere').textContent='Saved scripts are shared with the whole team. Open any of them to edit. Your open tabs stay private until you save.'; renderAuthor(); return; }
  try{
    if(!(window.claude&&typeof window.claude.use==='function')) return;""")
    s=R(s,"function libCol(){","""function getAuthor(){ try{return localStorage.getItem('lm-author')||'';}catch(e){return '';} }
function setAuthor(v){ try{localStorage.setItem('lm-author',v);}catch(e){} renderAuthor(); }
function renderAuthor(){ const el=$('authorRow'); if(!el) return; el.hidden=LIB.kind!=='team'; if($('authorName')&&document.activeElement!==$('authorName')) $('authorName').value=getAuthor(); }
function libCol(){""")
    s=R(s,"    if(!url){ const r=await LIB.assets.upload(dataUrlToBlob(v)); url=r.url; upCache.set(v,url); }","""    if(!url){
      if(LIB.kind==='team'){
        const blob=dataUrlToBlob(v);
        const r=await fetch('/api/images',{method:'POST',headers:{'Content-Type':blob.type},body:blob});
        if(!r.ok) throw {code:'upload'}; url=(await r.json()).url;
      } else { const r=await LIB.assets.upload(dataUrlToBlob(v)); url=r.url; }
      upCache.set(v,url);
    }""")
    s=R(s,"async function libSave(t,asNew){\n  const rec=scriptRecord(t);\n","""async function libSave(t,asNew){
  const rec=scriptRecord(t);
  if(LIB.kind==='team'){
    if(!getAuthor()) throw {code:'need_name'};
    await uploadImages(rec.store);
    const same=!asNew&&t.savedWhere==='team'&&t.savedId;
    const id=same||uid0();
    const r=await fetch('/api/scripts/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({app:TEAM_APP,name:rec.name,product:rec.product,preset:rec.preset,author:getAuthor(),baseVersion:same?(t.savedVersion||0):0,state:rec.store})});
    if(r.status===409){ const j=await r.json().catch(()=>({})); throw {code:'conflict',who:j.author}; }
    if(r.status===413) throw {code:'too_big'};
    if(!r.ok) throw {code:'server'};
    const j=await r.json(); t.savedVersion=j.version;
    t.store=rec.store; if(t.id===WS.active){ store=t.store; S=store.drafts[presetId]||S; }
    return {id,where:'team'};
  }
""")
    s=R(s,"async function libList(){\n","""async function libList(){
  if(LIB.kind==='team'){
    const r=await fetch('/api/scripts?app='+TEAM_APP,{cache:'no-store'}); if(!r.ok) throw new Error('list');
    return (await r.json()).map(x=>({id:x.id,name:x.name,product:x.product,updatedAt:x.updatedAt,author:x.author,where:'team'}));
  }
""")
    s=R(s,"async function libLoad(item){\n","""async function libLoad(item){
  if(item.where==='team'){ const r=await fetch('/api/scripts/'+encodeURIComponent(item.id),{cache:'no-store'}); if(!r.ok) return null; const x=await r.json(); return {name:x.name,store:x.state,version:x.version}; }
""")
    s=R(s,"async function libDelete(item){\n","""async function libDelete(item){
  if(item.where==='team'){ const r=await fetch('/api/scripts/'+encodeURIComponent(item.id),{method:'DELETE'}); if(!r.ok&&r.status!==404) throw new Error('del'); return; }
""")
    s=R(s,"newTab(r.store,r.name,{savedId:item.id,savedWhere:item.where,dirty:false});","newTab(r.store,r.name,{savedId:item.id,savedWhere:item.where,savedVersion:r.version||0,dirty:false});")
    s=R(s,"savedWhere:t.savedWhere||null,dirty:!!t.dirty,store:t.store}","savedWhere:t.savedWhere||null,savedVersion:t.savedVersion||0,dirty:!!t.dirty,store:t.store}")
    s=R(s,"${esc(x.product||'')}${x.product?' · ':''}${new Date(","${esc(x.product||'')}${x.product?' · ':''}${x.author?'by '+esc(x.author)+' · ':''}${new Date(")
    s=R(s,"    status(e&&e.code==='too_big'?","""    if(e&&e.code==='need_name'){ status('Add your name next to “Your name” first, so the team knows who saved it.'); $('authorName').focus(); }
    else if(e&&e.code==='conflict') status(`${e.who||'Someone'} saved a newer version of “${tabName(t)}” after you opened it. Use “Save as copy” to keep yours, or open the latest from Saved scripts.`);
    else status(e&&e.code==='too_big'?""")
    s=R(s,"    catch(e){ failed.push(tabName(t)); }","    catch(e){ failed.push(tabName(t)+(e&&e.code==='conflict'?' (someone saved a newer version)':e&&e.code==='need_name'?' (add your name first)':'')); }")
    s=R(s,'      <p class="hint" id="saveNote" style="margin:8px 0 0"></p>','''      <div class="field" id="authorRow" hidden style="margin:12px 0 0;max-width:320px"><label for="authorName">Your name (shown on scripts and files you save)</label><input type="text" id="authorName" placeholder="e.g. Cecy"></div>
      <p class="hint" id="saveNote" style="margin:8px 0 0"></p>''')
    # --- never lose work: save tabs quickly, and before leaving the page
    s=R(s,"  clearTimeout(wsT); wsT=setTimeout(saveWorkspace,700);","  clearTimeout(wsT); wsT=setTimeout(saveWorkspace,250);")
    s=R(s,"  IDB.set('workspace',{","  return IDB.set('workspace',{")
    s=R(s,"initWorkspace();","""initWorkspace();
$('authorName').addEventListener('input',()=>setAuthor($('authorName').value.trim()));
try{ navigator.storage&&navigator.storage.persist&&navigator.storage.persist(); }catch(e){}
function flushNow(){ clearTimeout(wsT); try{ persist(); }catch(e){} return saveWorkspace()||Promise.resolve(); }
window.addEventListener('pagehide',()=>{ flushNow(); });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') flushNow(); });
document.querySelectorAll('[data-back]').forEach(a=>a.addEventListener('click',async e=>{
  e.preventDefault(); try{ await Promise.race([flushNow(),new Promise(r=>setTimeout(r,1500))]); }catch(err){} location.href='/';
}));""")
    # --- uploads go through the team media picker
    s=R(s,"$('filePick').value=''; $('filePick').click();","$('filePick').value=''; openMediaPicker($('filePick'));")
    s=R(s,'href="#" onclick="location.reload();return false"','href="/" data-back')
    s=R(s,'<input type="file" id="filePick"',open(P+'picker.html').read()+'<input type="file" id="filePick"')
    s=s.replace("</style>",open(P+'picker.css').read()+"</style>",1)
    s=R(s,"</body>","<script>\n"+open(P+'picker.js').read()+"</script>\n</body>")
    return s

G=open(SRC+'guide.html').read(); S=open(SRC+'script.html').read()
G=team(G,'guide'); S=team(S,'script')
# normal browser downloads outside Claude
G=R(G,"  } else showModal(blob);\n}","""  } else if(!(window.claude&&window.claude.use)){
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); status('Downloaded '+name);
  } else showModal(blob);
}""")
S=R(S,"async function saveOne(f){\n  if(!downloads) return 'modal';","""async function saveOne(f){
  if(!downloads&&!(window.claude&&window.claude.use)){
    const a=document.createElement('a'); a.href=URL.createObjectURL(f.blob); a.download=f.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    await new Promise(r=>setTimeout(r,350)); return 'saved';
  }
  if(!downloads) return 'modal';""")
G=R(G,"<title>Lactomedi Content Guide Builder</title>","<title>Content Guide Builder | Lactomedi</title>") if "<title>Lactomedi Content Guide Builder</title>" in G else G
S=R(S,"<title>Lactomedi Content Script Builder</title>","<title>Content Script Builder | Lactomedi</title>")
open(OUT+'guide.html','w').write(G); open(OUT+'script.html','w').write(S)
print('built', len(G), len(S))
