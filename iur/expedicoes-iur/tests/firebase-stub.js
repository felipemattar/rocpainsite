// Substituto de js/firebase.js para testes: banco em memória (localStorage), sem rede.
// O usuário logado vem de ?as=email (padrão: o administrador fixo).
const KEY='__fakedb';
const load=()=>{ try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};} };
let db=load(); const subs=[];
const persist=()=>localStorage.setItem(KEY,JSON.stringify(db));
const colOf=p=>{ const s=p.split('/'); return {col:s.slice(0,-1).join('/'), id:s[s.length-1]}; };
const tick2=()=>subs.forEach(s=>{ let m=new Map(Object.entries(db[s.path]||{}).map(([k,v])=>[k,JSON.parse(JSON.stringify(v))]));
  if(s.opts.where){ const [f,op,val]=s.opts.where; m=new Map([...m].filter(([k,v])=>(v[f]||[]).includes(val))); } s.cb(m); });
const tick=()=>{ db=load(); tick2(); };
let onWriteError=e=>console.error(e); export const setWriteErrorHandler=fn=>{onWriteError=fn;};
const email=new URLSearchParams(location.search).get('as')||'fdesigner@gmail.com';
export const onUser=cb=>setTimeout(()=>cb({email}),5);
export const signIn=async()=>{}; export const redirectResult=async()=>null; export const signOutUser=async()=>{};
export function listen(path,cb,opts={},onErr){ const s={path,cb,opts}; subs.push(s); setTimeout(()=>{
  db=load(); if(path==='team' && email!=='fdesigner@gmail.com' && !(db.team||{})[email]) return onErr&&onErr({code:'permission-denied'});
  tick(); },0); return ()=>{ const i=subs.indexOf(s); if(i>=0) subs.splice(i,1); }; }
export function save(path,data){ db=load(); const {col,id}=colOf(path); (db[col]=db[col]||{})[id]=JSON.parse(JSON.stringify(data)); persist(); setTimeout(tick,0); }
export function merge(path,data){ db=load(); const {col,id}=colOf(path); (db[col]=db[col]||{})[id]={...((db[col]||{})[id]||{}),...data}; persist(); setTimeout(tick,0); }
export function remove(path){ db=load(); const {col,id}=colOf(path); if(db[col]) delete db[col][id]; persist(); setTimeout(tick,0); }
export const newId=()=>'p'+Math.random().toString(36).slice(2,10);
export async function batchSet(entries){ db=load(); for(const [p,d] of entries){ const {col,id}=colOf(p); (db[col]=db[col]||{})[id]=d; } persist(); setTimeout(tick,0); }
window.__db=()=>load();
