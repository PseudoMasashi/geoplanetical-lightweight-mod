/* Geoplanetical optional lightweight renderer. No simulation methods are replaced. */
(() => {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const STORAGE_KEY = 'geo.codex.lightweight.v1';
  const VERSION = '1.1.0';
  let enabled = true;
  try { enabled = root.localStorage.getItem(STORAGE_KEY) !== 'off'; } catch (_) {}
  let responsive = true;
  try { responsive = root.localStorage.getItem('geo.codex.responsive.v1') !== 'off'; } catch (_) {}
  const viewAssociations = new WeakMap();
  let adapter = null, controls = [], lastScheduledAt = 0;
  const now = () => root.performance.now();
  const metrics = { rendered:0, skipped:0, lastCpuMs:0, originalSurfaceTriangles:0, surfaceTriangles:0, monthEndThrottles:0, cachedViewsRetained:0, freshQueriesDeferred:0 };
  const api = { version:VERSION, get enabled(){ return enabled; }, get responsive(){return responsive;},
    attach, setEnabled, setResponsive, scheduleFrame, retainCommittedView, deferFreshView, withCapturedParams,
    snapshot(){ return {version:VERSION,enabled,responsive,...metrics,profile:adapter?.profile||'waiting',specialistFallback:!!adapter?.specialist}; },
    // Local diagnostic handle used for testing the renderer, not for changing the simulation.
    getGlobe(){return adapter?.globe || null;}
  };
  root.__geoLite = api;

  function withCapturedParams(params, call) {
    // Match postMessage's value-at-call semantics even if a draft is edited while waiting.
    try {return call(root.structuredClone(params));}
    catch(error){return Promise.reject(error);}
  }

  function setResponsive(value) {
    responsive=!!value;
    try {root.localStorage.setItem('geo.codex.responsive.v1',responsive?'on':'off');}catch(_){}
    refreshControls();
    if(!responsive)updateCalculationHint(null);
  }

  function retainCommittedView(bridge, viewId, params, active, response, snapshot) {
    // These are read-only UI snapshots. Never substitute data across parameters or sessions.
    const epoch=bridge.sessionEpoch;
    let association=viewAssociations.get(bridge);
    if(!association||association.epoch!==epoch){
      association={epoch,params:new Map()};viewAssociations.set(bridge,association);
    }
    if(!active)return snapshot; // Vanilla unsubscribe leaves the stored view slot intact.
    let key;
    try {key=JSON.stringify(params||{});}catch(_){association.params.delete(viewId);return snapshot;}
    let result=snapshot;
    if(responsive&&response?.pending===true&&snapshot==null&&
      association.params.has(viewId)&&association.params.get(viewId)===key){
      const previous=bridge.views.get(viewId);
      if(previous!=null){result=previous;metrics.cachedViewsRetained++;}
    }
    // A pending ACK still establishes the parameters of later authoritative status updates.
    association.params.set(viewId,key);
    return result;
  }

  function workIsActive(bridge) {
    return !!(bridge.status?.work?.active||bridge.status?.continuing);
  }

  function deferFreshView(bridge, params, request) {
    // Quote/preview reads must be fresh. Do not return stale data to these callers.
    // Historical start-of-game queries are independent of the pending day.
    if(!responsive||params?.time==='start'||!workIsActive(bridge))return request();
    metrics.freshQueriesDeferred++;
    const epoch=bridge.sessionEpoch;
    return new Promise((resolve,reject)=>{
      const check=()=>{
        if(bridge.failure||bridge.closed){reject(bridge.failure||new Error('Simulation session closed'));return;}
        if(bridge.sessionEpoch!==epoch){reject(new Error('Simulation session changed'));return;}
        if(!responsive||!workIsActive(bridge)){
          Promise.resolve().then(request).then(resolve,reject);return;
        }
        root.setTimeout(check,50);
      };
      check();
    });
  }

  function updateCalculationHint(work) {
    const note=root.document?.getElementById('geo-lite-calculation-note');
    if(!note)return;
    const inGame=!adapter?.getState||adapter.getState()==='game';
    note.hidden=!(responsive&&inGame&&work?.active);
  }

  function setEnabled(value) {
    const next = !!value;
    if (next === enabled) return;
    enabled = next;
    try { root.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch (_) {}
    if (adapter) {
      adapter.restoreVisuals();
      if(enabled)adapter.previousStrategic=adapter.globe._forceStrategic;
      adapter.globe._forceStrategic = enabled ? true : adapter.previousStrategic;
      adapter.lastDrawAt = -Infinity;
      adapter.interactingUntil = now() + 1600;
      adapter.globe._liteDiagnosticMode = enabled;
    }
    lastScheduledAt = 0;
    refreshControls();
  }

  function scheduleFrame(callback) {
    if (!enabled) return root.requestAnimationFrame(callback);
    // The old release spins uncapped rAF callbacks even when its own cap skips a frame.
    // Pace the application callback without changing its dt, clock or simulation methods.
    const interval = Math.max(1000/60, Number(adapter?.getFrameInterval?.()) || 0);
    const at = now(), due = Math.max(at, lastScheduledAt + interval);
    lastScheduledAt = due;
    return root.setTimeout(() => root.requestAnimationFrame(callback), Math.max(0, due-at-1));
  }

  function refreshControls() {
    for (const button of controls) {
      const value=button.dataset?.geoLiteKind==='responsive'?responsive:enabled;
      button.textContent = value ? 'On' : 'Off';
      button.setAttribute('aria-pressed', String(value));
    }
    root.document?.documentElement?.classList.toggle('geo-lite-enabled', enabled);
  }

  function mountControls() {
    const doc = root.document;
    if (!doc || doc.getElementById('geo-lite-control')) return;
    const pane = doc.getElementById('pane-graphics');
    if (!pane) return;
    const row = doc.createElement('div');
    row.id = 'geo-lite-control'; row.className = 'set-row';
    const label = doc.createElement('div'); label.className = 'set-label';
    const title = doc.createElement('span'); title.className = 'set-name'; title.textContent = 'Lightweight strategy graphics';
    const desc = doc.createElement('span'); desc.className = 'set-desc';
    desc.textContent = 'Simple map, fewer effects and fewer idle redraws. Turn off to restore the original renderer. Ctrl+Alt+L.';
    label.append(title,desc);
    const box = doc.createElement('div'); box.className = 'set-ctrl';
    const button = doc.createElement('button'); button.type='button';button.className='k';
    button.setAttribute('aria-label','Lightweight strategy graphics');
    button.addEventListener('click',()=>setEnabled(!enabled));
    box.append(button); row.append(label,box);pane.prepend(row);controls.push(button);
    const browseRow=doc.createElement('div');browseRow.className='set-row';browseRow.id='geo-lite-responsive-control';
    const browseLabel=doc.createElement('div');browseLabel.className='set-label';
    const browseTitle=doc.createElement('span');browseTitle.className='set-name';browseTitle.textContent='Browse during calculations';
    const browseDesc=doc.createElement('span');browseDesc.className='set-desc';
    browseDesc.textContent='Keep available committed figures while month-end runs. New figures and policy actions may still wait.';
    browseLabel.append(browseTitle,browseDesc);
    const browseBox=doc.createElement('div');browseBox.className='set-ctrl';
    const browseButton=doc.createElement('button');browseButton.type='button';browseButton.className='k';browseButton.dataset.geoLiteKind='responsive';
    browseButton.setAttribute('aria-label','Browse during calculations');
    browseButton.addEventListener('click',()=>setResponsive(!responsive));
    browseBox.append(browseButton);browseRow.append(browseLabel,browseBox);row.after(browseRow);controls.push(browseButton);
    const note=doc.createElement('div');note.id='geo-lite-calculation-note';note.hidden=true;note.setAttribute('role','status');
    note.textContent='Calculating. Previous figures remain available where already loaded; new figures may wait.';
    Object.assign(note.style,{position:'fixed',top:'62px',left:'50%',transform:'translateX(-50%)',zIndex:'7000',
      maxWidth:'80vw',padding:'7px 12px',fontSize:'12px',color:'#e8e9eb',background:'rgba(20,24,30,.94)',
      border:'1px solid rgba(200,205,215,.25)',borderRadius:'4px',pointerEvents:'none'});
    doc.body.append(note);
    doc.addEventListener('keydown',e=>{
      if(e.ctrlKey&&e.altKey&&e.code==='KeyL'){
        e.preventDefault();e.stopImmediatePropagation();setEnabled(!enabled);
      }
    },true);
    // Choosing the photographic view is also a direct route back to the original graphics.
    doc.querySelector('[data-view="satellite"]')?.addEventListener('click',()=>{
      if(enabled)setEnabled(false);
    },true);
    refreshControls();
  }

  function attach(options) {
    if (adapter) return api;
    const g=options.globe, T=options.types;
    if(!g?.renderer || !g.sphere || !T?.SphereGeometry || !T?.ShaderMaterial || !T?.Vector3) {
      throw new Error('Lightweight renderer: unsupported game renderer');
    }
    const originalUpdate = g.update;
    const originalRender = g.renderer.render;
    const originalMaterial = g.sphere.material;
    const originalGeometry = g.sphere.geometry;
    const originalQuaternion = g.sphere.quaternion.clone();
    const originalFrustumCulled = g.sphere.frustumCulled;
    const radius = originalGeometry.parameters.radius;
    const cache = new Map(), visualRestores=[];
    const up = new T.Vector3(0,1,0), direction = new T.Vector3();
    const cheapMaterial = new T.ShaderMaterial({
      name:'Geoplanetical lightweight land and sea',
      uniforms:{specTex:g.globeMat.uniforms.specTex,uPolitical:g.globeMat.uniforms.uPolitical},
      depthWrite:true,depthTest:true,transparent:false,
      vertexShader:`varying vec3 vWorld; void main(){
        vWorld=(modelMatrix*vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
      fragmentShader:`precision highp float; uniform sampler2D specTex;
        uniform float uPolitical; varying vec3 vWorld;
        void main(){
          vec3 n=normalize(vWorld);
          vec2 uv=vec2(fract(atan(n.z,-n.x)/6.283185307179586+1.0),asin(clamp(n.y,-1.0,1.0))/3.141592653589793+0.5);
          float ocean=clamp(texture2D(specTex,uv).r,0.0,1.0);
          vec3 land=vec3(0.205,0.230,0.270);
          vec3 sea=mix(vec3(0.050,0.067,0.097),vec3(0.145,0.245,0.355),uPolitical);
          gl_FragColor=vec4(mix(land,sea,ocean),1.0);
        }`
    });
    metrics.originalSurfaceTriangles=triangleCount(originalGeometry);
    adapter={...options,globe:g,previousStrategic:g._forceStrategic,lastDrawAt:-Infinity,
      interactingUntil:now()+1200,profile:'lightweight',specialist:false,restoreVisuals,
      lastRevision:null,previousFrameAt:now(),lastUiBlock:null};
    g._liteDiagnosticMode=enabled;

    function triangleCount(geometry){return (geometry.index?.count||geometry.attributes?.position?.count||0)/3;}
    function restoreVisuals(){
      for(let i=visualRestores.length-1;i>=0;i--){const [object,key,value]=visualRestores[i];object[key]=value;}
      visualRestores.length=0;
      g.sphere.material=originalMaterial;g.sphere.geometry=originalGeometry;
      g.sphere.quaternion.copy(originalQuaternion);g.sphere.frustumCulled=originalFrustumCulled;
      adapter && (adapter.specialist=false);
    }
    function hide(object){if(object&&object.visible!==false){visualRestores.push([object,'visible',object.visible]);object.visible=false;}}
    function specialistView(){
      // Preserve the original pixel-based data/temperature/resource overlays rather than
      // approximating or omitting strategic information in the simple surface shader.
      const u=g.globeMat?.uniforms;
      return !!(g._dataMode||g._forageMode||
        (g._overlayTarget||0)>.001||(g._overlayMix||0)>.001||
        (u?.uOverlay?.value||0)>.001||(u?.uAttack?.value||0)>.001);
    }
    function useSimpleSurface(){
      const distance=g.camera.position.length();
      // Only the camera-facing spherical cap is needed. Keeping the spherical projection
      // preserves picking, country polygons and strategic marker positions at every zoom.
      const needed=Math.acos(Math.min(1,radius/Math.max(radius,distance)))+.06;
      const angle=Math.min(Math.PI,Math.ceil(needed/.08)*.08);
      const close=distance<radius*1.9;
      const width=close?64:96,height=close?28:48;
      const key=`${angle.toFixed(2)}:${width}`;
      if(!cache.has(key))cache.set(key,new T.SphereGeometry(radius,width,height,0,Math.PI*2,0,angle));
      g.sphere.geometry=cache.get(key);g.sphere.material=cheapMaterial;
      direction.copy(g.camera.position).normalize();
      g.sphere.quaternion.setFromUnitVectors(up,direction);g.sphere.frustumCulled=false;
      metrics.surfaceTriangles=triangleCount(g.sphere.geometry);
    }
    function isCapturing(){return !!(g._captureViewport || root.document?.body?.classList.contains('cinema-recording'));}
    function simpleActive(){return enabled&&(g.activeBody||'earth')==='earth'&&!isCapturing();}
    function applyVisuals(){
      if(!simpleActive())return;
      adapter.specialist=specialistView();
      if(!adapter.specialist)useSimpleSurface();
      else metrics.surfaceTriangles=metrics.originalSurfaceTriangles;
      for(const key of ['skyGroup','sunGroup','auroraMesh','atmosphereMesh','atmosphereExtinctionMesh',
        'cloudMesh','cityLights','_issScene','_orbitalPollutionScene'])hide(g[key]);
      // The Moon itself is cosmetic from Earth; its independent map stays untouched.
      hide(g.moonMesh);
    }
    g.renderer.render=function(scene,camera){
      if(scene===g.scene)applyVisuals();
      if(simpleActive()&&(scene===g._issScene||scene===g._orbitalPollutionScene))return;
      return originalRender.call(this,scene,camera);
    };
    const prepare=g.prepareLateShaders;
    if(typeof prepare==='function')g.prepareLateShaders=function(...args){
      // The photographic materials will compile normally on first use after switching back.
      if(enabled)return [];
      return prepare.apply(this,args);
    };
    const compile=g.renderer.compileAsync;
    if(typeof compile==='function')g.renderer.compileAsync=function(...args){
      if(enabled)return Promise.resolve();
      return compile.apply(this,args);
    };
    // These methods animate decoration only. Units, map layers, borders, picking,
    // construction, facility, transport and war markers keep their original code.
    for(const name of ['_updateISS','_updateOrbitalPollution','_updateHurricanes','_updateFlashes','_updateVolcano']){
      const method=g[name];if(typeof method!=='function')continue;
      g[name]=function(...args){if(simpleActive())return;return method.apply(this,args);};
    }
    const wake=(ms=1400)=>{adapter.interactingUntil=Math.max(adapter.interactingUntil,now()+ms);};
    for(const type of ['pointerdown','pointermove','pointerup','wheel'])g.container?.addEventListener(type,()=>wake(),{passive:true});
    root.addEventListener?.('resize',()=>wake());
    root.addEventListener?.('keydown',()=>wake(700));
    g.update=function(dt){
      const session=options.getSession?.(),work=session?.simulationWorkStatus?.();
      updateCalculationHint(work);
      if(!enabled){
        restoreVisuals();adapter.profile='original';metrics.surfaceTriangles=metrics.originalSurfaceTriangles;
        return originalUpdate.call(this,dt);
      }
      const at=now();
      const revision=`${session?.day??''}:${session?.status?.commitRevision??''}:${g.activeBody}:${g.selectedKey??''}`;
      const changed=revision!==adapter.lastRevision;
      const interactive=at<adapter.interactingUntil||!!g._focusAnim;
      const busy=!!work?.active;
      const interval=interactive?0:busy?200:100; // UI and simulation still use the original application loop.
      if(!isCapturing()&&!changed&&at-adapter.lastDrawAt<interval){
        metrics.skipped++;if(busy)metrics.monthEndThrottles++;return;
      }
      restoreVisuals();
      if((g.activeBody||'earth')==='earth')g._forceStrategic=true;
      adapter.profile=busy?'lightweight, calculating':interactive?'lightweight, interactive':'lightweight, idle';
      const elapsed=Number.isFinite(adapter.lastDrawAt)?(at-adapter.lastDrawAt)/1000:dt;
      adapter.lastDrawAt=at;adapter.lastRevision=revision;
      const start=now();
      try{return originalUpdate.call(this,Math.min(.2,Math.max(0,elapsed||dt||0)));}
      finally{metrics.rendered++;metrics.lastCpuMs=now()-start;}
    };
    mountControls();refreshControls();
    console.info('[geo-lite] optional lightweight renderer ready '+VERSION);
    return api;
  }
})();
