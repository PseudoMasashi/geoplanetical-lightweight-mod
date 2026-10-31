const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
let time=0,busy=false,draws=0,simulationMutations=0;
class V{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}copy(v){Object.assign(this,v);return this;}length(){return Math.hypot(this.x,this.y,this.z);}normalize(){const n=this.length();this.x/=n;this.y/=n;this.z/=n;return this;}}
class Q{clone(){return new Q();}copy(){return this;}setFromUnitVectors(){return this;}}
class Geometry{constructor(radius,w,h,p=0,l=Math.PI*2,t=0,a=Math.PI){this.parameters={radius,widthSegments:w,heightSegments:h,thetaLength:a};this.index={count:w*h*6};}}
class Material{constructor(o){Object.assign(this,o);}}
const originalGeometry=new Geometry(2,256,160),originalMaterial={name:'original'},scene={},sky={visible:true};
const g={sphere:{geometry:originalGeometry,material:originalMaterial,quaternion:new Q(),frustumCulled:true},scene,
 renderer:{render(){draws++;},compileAsync(){return Promise.resolve();}},globeMat:{uniforms:{specTex:{value:{}},uPolitical:{value:1}}},
 camera:{position:new V(0,0,2.5)},container:{addEventListener(){}},activeBody:'earth',_forceStrategic:false,skyGroup:sky,
 update(){this.renderer.render(scene,this.camera);},prepareLateShaders(){return[];}};
const session={day:10,status:{commitRevision:1},simulationWorkStatus:()=>({active:busy}),advanceDays(){simulationMutations++;},update(){simulationMutations++;}};
const storage=new Map(),doc={getElementById(){return null;},body:{classList:{contains(){return false;}}},documentElement:{classList:{toggle(){}}}};
const win={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:doc,performance:{now:()=>time},addEventListener(){},requestAnimationFrame(){return 1;},setTimeout(){return 2;}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../lightweight.js','utf8'),{window:win,console:{info(){}}});
const a=win.__geoLite;a.attach({globe:g,getSession:()=>session,getFrameInterval:()=>1000/60,types:{Vector3:V,SphereGeometry:Geometry,ShaderMaterial:Material}});
g._climateViewSource=session; // Every loaded campaign has a climate provider, even with no data map open.
g.update(1/60);assert.notEqual(g.sphere.material,originalMaterial);assert.equal(sky.visible,false);assert.ok(a.snapshot().surfaceTriangles<a.snapshot().originalSurfaceTriangles);
time=2000;g.update(1/60);const idleBefore=draws;time=2020;g.update(1/60);assert.equal(draws,idleBefore,'Idle calls must skip graphics work');
busy=true;time=2200;g.update(1/60);const busyBefore=draws;time=2300;g.update(1/60);assert.equal(draws,busyBefore,'Calculation must reduce map redraw frequency');time=2400;g.update(1/60);assert.equal(draws,busyBefore+1);
g._dataMode=true;a.setEnabled(false);a.setEnabled(true);g.update(1/60);assert.equal(g.sphere.material,originalMaterial,'Data views must retain the original surface');
g._dataMode=false;a.setEnabled(false);g.update(1/60);assert.equal(g.sphere.geometry,originalGeometry);assert.equal(g.sphere.material,originalMaterial);assert.equal(sky.visible,true);assert.equal(g._forceStrategic,false);
a.setEnabled(true);g.activeBody='moon';g.update(1/60);assert.equal(g.sphere.geometry,originalGeometry,'Moon view must not use the Earth cap');
assert.equal(simulationMutations,0,'Renderer mode must not invoke simulation mutation methods');
console.log(JSON.stringify({passed:true,contracts:['simple surface','idle redraw reduction','month-end redraw reduction','data-map fallback','geometry/material/visibility/view restoration','Moon fallback','no simulation mutations'],metrics:a.snapshot()}));
