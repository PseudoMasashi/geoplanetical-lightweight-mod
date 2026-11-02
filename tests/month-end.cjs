'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function setup(focus) {
  let time = 0, draws = 0;
  const handlers = {}, storage = new Map();
  class Vector {
    constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); }
    copy(v) { Object.assign(this,v); return this; }
    length() { return Math.hypot(this.x,this.y,this.z); }
    normalize() { const n=this.length(); this.x/=n; this.y/=n; this.z/=n; return this; }
  }
  class Quaternion { clone(){return new Quaternion();} copy(){return this;} setFromUnitVectors(){return this;} }
  class Geometry { constructor(radius,w,h){this.parameters={radius};this.index={count:w*h*6};} }
  class Material { constructor(value){Object.assign(this,value);} }
  const session = { day: 30, sessionEpoch: 1, status: {commitRevision:1},
    work: {active:true}, simulationWorkStatus(){return this.work;} };
  const g = {sphere:{geometry:new Geometry(2,256,160),material:{},quaternion:new Quaternion()},
    scene:{}, renderer:{render(){draws++; time+=2;}}, globeMat:{uniforms:{specTex:{},uPolitical:{}}},
    camera:{position:new Vector(0,0,3)}, activeBody:'earth',
    container:{addEventListener(name,handler){(handlers[name] ||= []).push(handler);}},
    update(){this.renderer.render(this.scene,this.camera);} };
  const win = {performance:{now:()=>time},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById(){return null;},body:{classList:{contains(){return false;}}},documentElement:{classList:{toggle(){}}}},
    addEventListener(){}, requestAnimationFrame(){}, setTimeout(){}};
  const context = vm.createContext({window:win,console:{info(){}}});
  for(const name of ['lightweight.js','month-end.js']) vm.runInContext(fs.readFileSync(__dirname+'/../'+name,'utf8'),context);
  win.__geoLite.monthEnd.setFocus(focus);
  win.__geoLite.attach({globe:g,getSession:()=>session,types:{Vector3:Vector,SphereGeometry:Geometry,ShaderMaterial:Material}});
  return {api:win.__geoLite,g,session,setTime:t=>{time=t;},draws:()=>draws,
    wake(){for(const handler of handlers.pointermove) handler();}};
}
const baseline=setup(false),focused=setup(true);
for(let time=2000;time<12000;time+=100){
  baseline.setTime(time);baseline.g.update(.1);
  focused.setTime(time);focused.g.update(.1);
}
assert.equal(baseline.draws(),50);
assert.equal(focused.draws(),10,'Idle map should draw once a second during work');
focused.setTime(12100);focused.wake();focused.g.update(.1);
assert.equal(focused.draws(),11,'Interaction must wake drawing immediately');
focused.session.work.active=false;focused.setTime(12200);focused.g.update(.1);
let report=focused.api.monthEnd.report();
assert.equal(report.completed.length,1);assert.equal(report.completed[0].observedMs,10200);
assert.equal(report.completed[0].mapCpuMs,22);assert.equal(report.completed[0].mapDraws,11);
assert.equal(report.completed[0].endUncertaintyMs,100);
report.completed[0].observedMs=-1;
assert.equal(focused.api.monthEnd.report().completed[0].observedMs,10200,'Reports must not mutate retained measurements');
focused.session.work.active=true;focused.setTime(13000);focused.g.update(.1);
let beforeDraws=focused.draws();
focused.setTime(13100);focused.g._captureViewport=true;focused.g.update(.1);
assert.equal(focused.draws(),beforeDraws+1,'Capture must bypass focus pacing');
focused.g._captureViewport=false;focused.api.setEnabled(false);
beforeDraws=focused.draws();focused.setTime(13200);focused.g.update(.1);assert.equal(focused.draws(),beforeDraws+1,'Original graphics mode bypasses focus');
focused.session.failure=new Error('Worker stopped');focused.setTime(13300);focused.g.update(.1);
assert.equal(focused.api.monthEnd.report().completed.at(-1).outcome,'Session stopped');
focused.session.sessionEpoch++;focused.session.failure=null;
focused.setTime(14000);focused.g.update(.1);
assert.equal(focused.api.monthEnd.report().completed.length,0,'New campaigns clear previous measurements');
for(let i=0;i<25;i++){
  focused.session.work.active=false;focused.setTime(15000+i*200);focused.g.update(.1);
  focused.session.work.active=true;focused.setTime(15100+i*200);focused.g.update(.1);
}
assert.equal(focused.api.monthEnd.report().completed.length,20,'History must remain bounded');
console.log('Month-end focus passed: 50 -> 10 idle map draws over 10 simulated seconds; interaction, capture, original mode, failure and session isolation passed.');
