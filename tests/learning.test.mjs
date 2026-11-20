import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function makeElement(){return {innerHTML:'',textContent:'',disabled:false,dataset:{},classList:{add(){},remove(){}},focus(){},remove(){},scrollIntoView(){}};}
function load(saved){
 const elements=new Map();const storage=new Map(saved?[['jiyu-word-garden-v1',JSON.stringify(saved)]]:[]);
 const context=vm.createContext({console,Date,Intl,Math,JSON,Set,Map,Object,Array,Number,String,RegExp,setTimeout:()=>1,clearTimeout(){},window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>{if(!elements.has(s))elements.set(s,makeElement());return elements.get(s)},querySelectorAll:()=>[],addEventListener(){}}});
 for(const f of ['data.js','data-part2.js','motion.js','learning.js','app.js'])vm.runInContext(fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8'),context);
 return {run:x=>vm.runInContext(x,context),elements};
}
let t=load({progress:{},custom:[],edits:{},history:[{date:'2026-11-19',ids:['ivy-0'],correct:1,total:1}],settings:{size:6,rate:.8,auto:false},session:null});
assert.equal(t.run('state.settings.size'),35,'Existing six-word defaults must upgrade');
assert.equal(t.run('state.history.length'),1,'Existing records must survive migration');
assert.equal(t.run('Learning.sets(allWords(),30).map(s=>s.ids.length).join(",")'),'32,31,39,39,38');
t.run('start()');
assert.equal(t.run('state.session.ids.length'),35);
let front=t.run('flashBody(getWord("ivy-0"),false)');
assert(!front.includes('sprite')&&!front.includes('She zipped')&&!front.includes('to move around'),'Front must not reveal any picture, definition, or example');
let back=t.run('flashBody(getWord("ivy-0"),true)');
assert(back.includes('sprite')&&back.includes('She zipped')&&back.includes('to move around'),'Back must contain picture, meaning, and sentence');
t.run('next()');assert.equal(t.run('state.session.index'),0,'Cannot skip an unseen back');
t.run('actions.reveal();next();launch(allWords().slice(30,60).map(w=>w.id),"set-1","Set 2")');
assert.equal(t.run('state.pausedSessions.adaptive.index'),1,'Switching sets must preserve unfinished work');
t.run('launch(planned().map(w=>w.id),"adaptive","Your next 35")');
assert.equal(t.run('state.session.index'),1,'Switching back must resume');
t=load();t.run('launch(WORDS.slice(0,35).map(w=>w.id),"test","35-word adventure")');
for(let i=0;i<105;i++){
 assert.equal(t.run('state.session.stage'),'cards');
 t.run('actions.reveal();next()');
}
assert.equal(t.run('state.session.stage'),'match');
assert.equal(t.run('prog("ivy-0").views'),3);
for(let group=0;group<7;group++){
 const ids=JSON.parse(t.run('JSON.stringify(batch(state.session))'));assert.equal(ids.length,5);
 for(const id of ids)t.run('pair('+JSON.stringify(id)+',"word",'+
  '({classList:{add(){},remove(){}},disabled:false}));pair('+JSON.stringify(id)+',"meaning",({classList:{add(){},remove(){}},disabled:false}))');
 t.run('actions.matchnext()');
}
assert.equal(t.run('state.session.stage'),'quiz');
assert.equal(t.run('state.session.matched.length'),35);
for(let i=0;i<35;i++){
 if(i===0)t.run('answer(state.session.ids[1],{classList:{add(){}},disabled:false})');
 t.run('answer(quizIds(state.session)[state.session.quizIndex],{classList:{add(){}},disabled:false});quizNext()');
}
assert.equal(t.run('state.session.review'),true,'First wrong answer must trigger another round');
t.run('answer(quizIds(state.session)[state.session.quizIndex],{classList:{add(){}},disabled:false});quizNext()');
assert.equal(t.run('state.session.stage'),'check','Quiz must lead to short checks');
assert.equal(t.run('state.session.checkIds.length'),5);
const checked=t.run('state.session.checkIds[0]');
t.run('checkAnswer(state.session.options.find(x=>x!==checkIds(state.session)[0]),{classList:{add(){}},disabled:false})');
for(let guard=0;t.run('!!state.session')&&guard<20;guard++)t.run('checkAnswer(checkIds(state.session)[state.session.checkIndex],{classList:{add(){}},disabled:false});checkNext()');
assert.equal(t.run('state.session'),null);
assert.equal(t.run('state.history[0].correct'),34,'Retries must not inflate first-answer accuracy');
assert.equal(t.run('state.history[0].checkCorrect'),4);
assert.equal(t.run('state.history[0].checkTotal'),5);
assert.equal(t.run('Learning.accuracy(state.history)'),97);
assert(t.run('Learning.tricky(prog("ivy-0"))'));
assert.equal(t.run('planned()[0].id'),'ivy-0','Tricky word must return to top of recalculated plan');
assert.equal(t.run('prog("ivy-0").due'),t.run('Learning.nextDate(day(),0,true)'));
assert.equal(t.run('prog("ivy-1").attempts'),1);
assert.equal(t.run('prog("ivy-1").correct'),1);
// New entries automatically join the next list when they have priority over future reviews.
t.run('state.custom.push({id:"custom-123",word:"glow",meaning:"to shine softly",example:"The stars glow.",addedAt:new Date().toISOString()})');
assert(t.run('planned().some(w=>w.id==="custom-123")'));
assert.equal(t.run('Learning.sets(allWords(),30).map(s=>s.ids.length).join(",")'),'32,31,39,39,38,1');
assert.equal(t.run('CHECK_PROMPTS.length'),63);
assert.equal(t.run('WORDS.length'),179);
assert.equal(t.run('WORDS_PART2.length'),116);
assert.equal(t.run('new Set(WORDS.map(w=>w.id)).size'),179);
assert(t.run('Learning.sets(WORDS).every(s=>s.ids.length>=30&&s.ids.length<=40)'));
assert(t.run('art(getWord("ivy2-0")).includes("atlas-part2-a.png")'));
assert(t.run('art(getWord("ivy2-64")).includes("atlas-part2-b.png")'));
assert(t.run('flashBody(getWord("ivy2-85"),true).includes("Play motion")'));
assert(!t.run('flashBody(getWord("ivy2-85"),false).includes("motion-guide")'));
assert.equal(t.run('checkData(getWord("ivy2-96")).form'),'match');
t.run('state.edits["ivy2-96"]={word:"greeting",meaning:"a word you say when you meet someone"}');
assert.equal(t.run('checkData(getWord("ivy2-96")).reverse'),true,'Edited cards must not get an outdated sentence check');
assert.equal(t.run('getWord("ivy2-40").word'),'Fester');
assert(t.run('getWord("ivy2-40").meaning.includes("name of the dog")'));
assert.equal(t.run('getWord("ivy2-110").word'),'clobber');
assert.equal(t.run('getWord("ivy2-115").word'),'situation');
console.log('PASS: old-data migration; balanced 32/31/39/39/38 sets; front/back isolation; set resume; 105 card looks; 35 matches; first-try scoring; five checks with retries; review reprioritization; new-word planning.');
