'use strict';
const Learning = {
  progress(p = {}) {return {level:0,due:'',misses:0,views:0,practices:0,attempts:0,correct:0,checkAttempts:0,checkCorrect:0,...p};},
  tricky(p) {return !!(p.misses > 0 || p.needsReview);},
  rank(words, progress, today) {
    return [...words].sort((a,b)=>{
      const x=this.progress(progress[a.id]),y=this.progress(progress[b.id]);
      const priority=p=>this.tricky(p)?0:p.due&&p.due<=today?1:!p.lastPractice&&!p.due?2:3;
      return priority(x)-priority(y)||(y.misses-x.misses)||(x.due||today).localeCompare(y.due||today)||((Date.parse(b.addedAt)||0)-(Date.parse(a.addedAt)||0));
    });
  },
  plan(words, progress, today, size=30) {return this.rank(words,progress,today).slice(0,size);},
  sets(words) {
    const collections=new Map();
    for(const w of words){const key=w.collection||'mywords';if(!collections.has(key))collections.set(key,[]);collections.get(key).push(w);}
    const sets=[];
    for(const [collection,items] of collections){
      const count=Math.max(Math.ceil(items.length/40),Math.min(Math.max(1,Math.floor(items.length/30)),Math.round(items.length/35)||1));
      const base=Math.floor(items.length/count),extra=items.length%count;let offset=0;
      for(let i=0;i<count;i++){const size=base+(i<extra?1:0),title=collection==='part1'?'Part 1':collection==='part2'?'Part 2':'My words';sets.push({key:'deck-'+collection+'-'+i,collection,title,label:title+' · Set '+(i+1),ids:items.slice(offset,offset+size).map(w=>w.id)});offset+=size;}
    }
    return sets;
  },
  accuracy(history) {const total=history.reduce((n,h)=>n+h.total,0);return total?Math.round(history.reduce((n,h)=>n+h.correct,0)/total*100):null;},
  nextDate(today,level,weak) {const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(weak?1:[1,1,3,7,14,30][level]));return d.toISOString().slice(0,10);}
};
const CHECK_PROMPTS = [
 ['She ___ the yard very fast.','zipped around'],['The long strings were ___ in a knot.','tangled'],['A tiny noise scared her. She felt ___.','jumpy'],['Hit the rock hard to ___ it.','smash'],['When I feel unhappy, I sometimes ___.','frown'],['Okay, we can play your game. ___.','Have it your way'],['Let’s ___ to find the hidden treasure.','hatch a plan'],['He kept bothering me. He was ___.','a pain and a pest'],['Calling someone a ___ can hurt their feelings.','booger-head'],['Children can ___ a grumpy stage.','go through'],['She understood what the sign ___.','meant'],['She always told us what to do. She was ___.','bossy'],['Please don’t ___ me while I read.','bug'],['The loud crash scared her. She ___.','freaked out'],['She thought the silly idea was ___.','dumb'],['He made a long, low, unhappy sound. He began to ___.','moan'],['She took a tiny ___ at the tall lady.','peek up'],['A paper piece of money is a ___.','bill'],['He never wanted to spend money. They called him a ___.','tightwad'],['Move your lips without a sound to ___ a word.','mouth'],['It was not a mistake. She did it ___.','on purpose'],['That tapping noise could ___.','drive someone crazy'],['She helped carry the box. She was ___.','helpful'],['A small, round plant with many branches is a ___.','bush'],['Walk beside the road on the ___.','sidewalk'],['Put the thin ___ through the needle.','thread'],['She was so excited, she could ___ wait!','hardly'],['Be careful! That sharp branch could ___ your arm.','poke'],['Watch the bike ___ past very fast.','whiz'],['Lean to one side to ___ your body.','tilt'],['Please close the door quietly. Don’t ___ it.','slam'],['The sunlight is bright, so I ___ my eyes.','squint'],['That strange hat looks ___.','weird'],['The costume was silly and a little strange. It looked ___.','goony'],['An unkind name for someone who seems silly is ___.','dork'],['Our picnic was ruined. It was a ___ day.','crummy'],['A child whose parents have both died is an ___.','orphan'],['A home that cares for children without parents is an ___.','orphanage'],['Speak very quietly and not clearly to ___.','mutter'],['She was surprised. “What the ___?” she said.','heck'],['The pretend ghost said, “I will ___ you!”','haunt'],['The plan did not work. It was ___.','a bust'],['Make a long spooky cry. ___ like a wolf.','Howl'],['Push water out of your mouth to ___ it out.','spit'],['Air came out of his stomach through his mouth. He let out a ___.','burp'],['The baby began to ___ with a long, loud cry.','wail'],['Twisting your ankle too far can ___ it.','sprain'],['She likes to ___ her tongue.','stick out'],['Move your fingers from side to side. ___ them!','Wiggle'],['Her foot hurt, so she began to ___.','limp'],['Giving a consequence for breaking a rule is a way to ___.','punish'],['I finished my food. May I ___?','have seconds'],['We made our final choice. ___.','That settled it'],['Bend your knees and ___ under the leaves.','crouch'],['Move slowly and carefully. ___ along the wall.','Edge'],['The rough wall could ___ her back.','scrape'],['Stop moving! Come to a ___.','halt'],['They disagreed and began to ___.','argue'],['An unkind name for someone who seems scared is ___.','wimp'],['The leaves were a little wet. They were ___.','damp'],['She heard a noise and stopped very still. She ___.','froze'],['People who secretly watch to find out things are ___.','spies'],['I ___ she is making up that story.','figure']
];
