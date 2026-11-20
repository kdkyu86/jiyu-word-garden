'use strict';
// Small, exact motion demonstrations accompany the story pictures.
// They start only when the child presses Play and can be paused at any time.
const MotionGuide={
 items:{
  'back and forth':['across','One way, then the other.'],
  'wobble':['wobble','Unsteady, side to side.'],
  'tilt':['tilt','Lean to one side.'],
  'swerve':['swerve','A sudden turn to the side.'],
  'skid':['skid','Slide without control.'],
  'whirl':['whirl','Turn around quickly.'],
  'charge':['rush','Rush straight toward something.'],
  'zip around':['rush','Move around very fast.'],
  'whiz':['rush','Move very fast.'],
  'creep':['creep','Move slowly and quietly.'],
  'waggle':['arms','Little moves from side to side.'],
  'wiggle':['arms','Little moves from side to side.'],
  'flung':['flung','Move your arms suddenly.'],
  'arch':['arch','Bend into a bridge shape.'],
  'ooze':['ooze','Flow slowly and thickly.'],
  'dribble':['dribble','A little stream or little drops.'],
  'squirming':['worm','Twist and move.'],
  'squiggle':['worm','Little twists and curves.'],
  'duck down':['duck','Lower your head quickly.'],
  'halt':['halt','Move, then stop.'],
  'invisible':['invisible','You cannot see it.']
 },
 render(w){
  const item=this.items[w.word.toLowerCase()];if(!item)return '';
  const [type,caption]=item;
  const person='<circle cx="180" cy="26" r="12" fill="#f1bb88"/><path d="M180 40V78M180 78L160 101M180 78L200 101" stroke="#7360bd" stroke-width="9" stroke-linecap="round" fill="none"/>';
  let drawing='';
  if(['across','rush','creep','skid','halt'].includes(type))drawing='<path d="M36 72H324" fill="none" stroke="#b6c8c0" stroke-width="3" stroke-dasharray="6 6"/><circle class="motion-element" cx="40" cy="66" r="15" fill="#d88c57"/><circle cx="323" cy="66" r="4" fill="#1b7767"/>';
  if(type==='swerve')drawing='<path d="M35 80H148Q175 80 185 44T322 38" fill="none" stroke="#b6c8c0" stroke-width="3" stroke-dasharray="6 6"/><circle class="motion-element" cx="40" cy="80" r="14" fill="#d88c57"/><rect x="168" y="67" width="30" height="28" rx="6" fill="#cfb9eb"/>';
  if(type==='wobble'||type==='tilt')drawing='<path d="M95 96H265" stroke="#b6c8c0" stroke-width="3"/><g class="motion-element"><rect x="151" y="24" width="58" height="70" rx="9" fill="#b7a2da"/><circle cx="169" cy="43" r="4" fill="#fff"/></g>';
  if(type==='whirl')drawing='<circle cx="180" cy="61" r="36" fill="none" stroke="#b6c8c0" stroke-width="3" stroke-dasharray="6 6"/><circle class="motion-element" cx="180" cy="25" r="12" fill="#d88c57"/>';
  if(type==='arms'||type==='flung')drawing=person+'<g class="motion-arm left"><path d="M180 45L125 '+(type==='arms'?'59':'87')+'" stroke="#7360bd" stroke-width="9" stroke-linecap="round"/></g><g class="motion-arm right"><path d="M180 45L235 '+(type==='arms'?'59':'87')+'" stroke="#7360bd" stroke-width="9" stroke-linecap="round"/></g>';
  if(type==='arch')drawing='<path d="M50 91H310" stroke="#d8ddd8" stroke-width="3"/><path class="motion-element" d="M62 85Q180 -28 298 85" stroke="#7360bd" stroke-width="12" stroke-linecap="round" fill="none"/>';
  if(type==='ooze'||type==='worm')drawing='<path d="M40 95H325" stroke="#d8ddd8" stroke-width="3"/><path class="motion-element" d="M85 72Q105 46 126 72T165 70T205 71T246 73" stroke="'+(type==='worm'?'#b87e6e':'#967348')+'" stroke-width="'+(type==='worm'?16:30)+'" stroke-linecap="round" fill="none"/>';
  if(type==='dribble')drawing='<path d="M158 14H200" stroke="#659da9" stroke-width="10" stroke-linecap="round"/><path d="M134 90Q180 109 225 90" stroke="#659da9" stroke-width="6" fill="none"/>'+[0,1,2].map(n=>'<ellipse class="motion-drop drop-'+n+'" cx="'+(169+n*9)+'" cy="28" rx="4" ry="7" fill="#55a3bb"/>').join('');
  if(type==='duck')drawing='<g class="motion-element">'+person+'<path d="M180 45L155 62M180 45L205 62" stroke="#7360bd" stroke-width="9" stroke-linecap="round"/></g><rect x="108" y="75" width="144" height="40" rx="6" fill="#92ae87"/>';
  if(type==='invisible')drawing='<g class="motion-element">'+person+'<path d="M180 45L155 62M180 45L205 62" stroke="#7360bd" stroke-width="9" stroke-linecap="round"/></g>';
  return '<div class="motion-guide motion-'+type+'"><div class="row"><b>See it move</b><span class="spacer"></span><button class="smallbtn" data-a="motion" aria-pressed="false">Play motion</button></div><svg class="motion-stage" viewBox="0 0 360 115" role="img" aria-label="'+caption+'">'+drawing+'</svg><p>'+caption+'</p></div>';
 }
};
