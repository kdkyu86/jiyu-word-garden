import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../dist/',import.meta.url);
const server={state:null,revision:0,failNext:false,requests:0};
function client(initialStorage=new Map()){
 const storage=new Map(initialStorage),elements=new Map(),modals=new Map();
 function node(){
  return {innerHTML:'',textContent:'',disabled:false,dataset:{},className:'',id:'',setAttribute(){},focus(){},classList:{add(){},remove(){}},append(){},remove(){},querySelector(){return {focus(){}}},click(){},scrollIntoView(){}};
 }
 const document={
  hidden:false,
  querySelector:s=>{if(s==='.studyhead'||s==='.modal'||s==='#wordform')return null;if(!elements.has(s)){let e=node();if(s==='.topbar')e.querySelector=()=>null;elements.set(s,e);}return elements.get(s)},
  querySelectorAll:()=>[],
  getElementById:id=>modals.get(id)||null,
  createElement:()=>node(),
  body:{append:n=>modals.set(n.id,n)},
  addEventListener(){}
 };
 const fetch=async(url,options={})=>{
  if(url==='/api/state'&&!options.method)return {ok:true,status:200,json:async()=>({state:structuredClone(server.state),revision:server.revision,csrf:'test-csrf'})};
  if(url==='/api/state'&&options.method==='PUT'){
   server.requests++;
   if(server.failNext){server.failNext=false;throw Error('offline');}
   const data=JSON.parse(options.body);
   assert.equal(options.headers['X-CSRF-Token'],'test-csrf');
   if(data.revision!==server.revision)return {ok:false,status:409,json:async()=>({error:'version_conflict'})};
   server.state=structuredClone(data.state);server.revision++;
   return {ok:true,status:200,json:async()=>({revision:server.revision})};
  }
  throw Error('Unexpected route');
 };
 const ctx=vm.createContext({console,Date,Intl,Math,JSON,Set,Map,Object,Array,Number,String,RegExp,Promise,setTimeout:()=>1,clearTimeout(){},setInterval(){},window:{addEventListener(){}},document,fetch,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{replace(){},reload(){}}});
 for(const f of ['data.js','data-part2.js','motion.js','learning.js','app.js','server-sync.js'])vm.runInContext(fs.readFileSync(new URL(f,root),'utf8'),ctx);
 return {run:s=>vm.runInContext(s,ctx),storage,modals};
}
const settle=()=>new Promise(r=>setImmediate(r));
const a=client();await settle();
a.run('start()');assert.equal(await a.run('FamilySync.flush()'),true);
assert.equal(server.revision,1);
assert.equal(server.state.session.ids.length,35);
assert(!a.storage.has('jiyu-word-garden-v1-pending-server'));
const b=client();await settle();
assert.equal(b.run('state.session.ids.length'),35,'Fresh browser must load shared saved game');
// An offline save is kept locally and recovered on a new page load.
b.run('actions.reveal()');server.failNext=true;
assert.equal(await b.run('FamilySync.flush()'),false);
assert(b.storage.has('jiyu-word-garden-v1-pending-server'));
const recover=client(b.storage);await settle();
assert.equal(await recover.run('FamilySync.flush()'),true);
assert.equal(server.revision,2);
const learnedId=recover.run('state.session.order[state.session.index]');
assert.equal(server.state.progress[learnedId].views,1);
// The older browser may not overwrite the updated server snapshot.
a.run('actions.reveal()');
assert.equal(await a.run('FamilySync.flush()'),false);
assert(a.modals.has('family-conflict'));
assert.equal(server.revision,2);
assert.equal(server.state.progress[learnedId].views,1);
assert(a.storage.has('jiyu-word-garden-v1-pending-server'));
// Old backup positions can be validated for migration.
assert.equal(recover.run('validImportedSession(state.session)'),true);
assert.equal(recover.run('validImportedSession({...state.session,ids:["unknown"]})'),false);
console.log('PASS: browser-to-server autosave; fresh-device resume; offline pending recovery; concurrent-device conflict protection; backup session validation.');
