import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const $ = (s)=>document.querySelector(s);
let catalog;
let scene, camera, renderer, composer, controls, clock;
let carRoot=null, extras=null, mixer=null, currentVehicle=null;
const modelCache=new Map();
const modelPromises=new Map();
const loader=new GLTFLoader();
let baseScale=1, baseCenter=new THREE.Vector3();
let wheelOriginals=[];
let activeTab='vehicle';
let cameraMode='hero';
const state={
 mode:'customize',vehicle:'bmw-m3-xdrive',paint:'crimson',wheel:'split5',body:'sport',interior:'black',engine:'v6',drivetrain:'rwd',transmission:'dct',brakes:'bigsteel',aero:'active',ride:0,track:0,width:0,length:0,front:0,rear:0,lights:true,exhaust:true,pro:false,name:'BMW M3 Competition xDrive'
};

const inlineCatalog=(()=>{try{return JSON.parse($('#dfCatalog')?.textContent||'null')}catch{return null}})();
function activeProfile(){
  if(!catalog) return null;
  const real=catalog.referenceModels?.find(x=>x.id===state.vehicle);
  if(real){const base=catalog.vehicles.find(x=>x.id===real.base);return base?{...real,url:real.visualUrl||base.url,visualBaseId:base.id,visualLabel:real.visualLabel||base.name}:real}
  return catalog.vehicles.find(x=>x.id===state.vehicle)||catalog.referenceModels?.[0]||null;
}
function activeVisualBase(profile=activeProfile()){return profile?.visualBaseId||profile?.id||'coupe'}

if(inlineCatalog){catalog=inlineCatalog;boot()}else{fetch('data.json').then(r=>{if(!r.ok)throw new Error('catalog fetch failed');return r.json()}).then(d=>{catalog=d;boot()}).catch(()=>{catalog=window.DF_CATALOG;if(catalog){boot()}else{$('#loadStatus').textContent='Catalog failed to load.'}})}

function boot(){
  setupLanding();
  setupScene();
  setupGlobalUI();
  renderConfig();
  // Start loading the default production model while the landing screen is still visible.
  schedulePrefetch(state.vehicle);
}

function schedulePrefetch(id){
  const profile=catalog.referenceModels?.find(v=>v.id===id)||catalog.vehicles.find(v=>v.id===id);
  const base=profile?.base?catalog.vehicles.find(v=>v.id===profile.base):profile;
  const run=()=>{loadModel(base, false).catch(()=>{})};
  if('requestIdleCallback' in window) requestIdleCallback(run,{timeout:1200}); else setTimeout(run,350);
}

function loadModel(v,showProgress=true){
  if(!v) return Promise.reject(new Error('Missing vehicle'));
  if(modelCache.has(v.id)) return Promise.resolve(modelCache.get(v.id));
  if(modelPromises.has(v.id)) return modelPromises.get(v.id);
  const promise=new Promise((resolve,reject)=>{
    loader.load(v.url, gltf=>{modelCache.set(v.id,gltf);modelPromises.delete(v.id);resolve(gltf)}, xhr=>{
      if(showProgress && xhr.total){const pct=Math.round((xhr.loaded/xhr.total)*100);$('#loadStatus').textContent=`Loading ${v.name} · ${pct}%`}}, err=>{modelPromises.delete(v.id);reject(err)});
  });
  modelPromises.set(v.id,promise);
  return promise;
}

function setupLanding(){
  document.querySelectorAll('.mode-card').forEach(btn=>btn.addEventListener('click',()=>{
    state.mode=btn.dataset.mode;
    $('#startScreen').classList.add('hidden');
    $('#studio').classList.remove('hidden');
    state.vehicle=state.mode==='scratch'?'lamborghini-revuelto':'bmw-m3-xdrive';
    state.name=state.mode==='scratch'?'Forge Custom':activeProfile()?.name||'BMW M3 Competition xDrive';
    renderConfig();loadVehicle();updateAll();
  }));
}

function setupScene(){
  const host=$('#stage');
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0b0f13);
  camera=new THREE.PerspectiveCamera(38,host.clientWidth/host.clientHeight,.1,100);
  camera.position.set(7.2,3.5,8.2);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.setSize(host.clientWidth,host.clientHeight,false);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
  host.appendChild(renderer.domElement);

  const hemi=new THREE.HemisphereLight(0xcfd7df,0x090b0d,1.45); scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffffff,4.2); key.position.set(6,8,9); key.castShadow=true; key.shadow.mapSize.set(1024,1024); scene.add(key);
  const rim=new THREE.DirectionalLight(0x9cb4d8,2.2); rim.position.set(-8,4,-6); scene.add(rim);
  const fill=new THREE.PointLight(0xd8ed9a,1.7,18); fill.position.set(0,2.5,-1); scene.add(fill);

  const floor=new THREE.Mesh(new THREE.CircleGeometry(13,96),new THREE.MeshStandardMaterial({color:0x16191d,metalness:.58,roughness:.24}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-.012; floor.receiveShadow=true; scene.add(floor);
  const halo=new THREE.Mesh(new THREE.RingGeometry(5.6,8.8,96),new THREE.MeshBasicMaterial({color:0x2b333b,transparent:true,opacity:.24,side:THREE.DoubleSide}));
  halo.rotation.x=-Math.PI/2;halo.position.y=.005;scene.add(halo);

  controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.08; controls.minDistance=3.2; controls.maxDistance=15; controls.target.set(0,.85,0); controls.enablePan=false;
  clock=new THREE.Clock();
  window.addEventListener('resize',onResize);
  renderer.domElement.addEventListener('dblclick',centerCar);
  animate();
}

function onResize(){const host=$('#stage');camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false)}
function centerCar(){setCamera('hero',true)}
function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();mixer?.update(dt);controls.update();renderer.render(scene,camera)}

function setupGlobalUI(){
  $('#modeCustomize').onclick=()=>switchMode('customize'); $('#modeScratch').onclick=()=>switchMode('scratch');
  $('#resetBtn').onclick=resetBuild; $('#saveBtn').onclick=saveBuild;
  $('#unlockPro').onclick=()=>{state.pro=true;$('#modal').classList.add('hidden');$('#proBadge').textContent='PRO ON';$('#proBadge').classList.add('on');renderConfig();toast('Pro Garage unlocked — demo only')};
  $('#closeModal').onclick=()=>$('#modal').classList.add('hidden');
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
  $('#tabs').addEventListener('click',(e)=>{const b=e.target.closest('button[data-tab]');if(!b)return;activeTab=b.dataset.tab;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x===b));renderConfig()});
}
function switchMode(mode){state.mode=mode;state.name=mode==='scratch'?'Forge Custom':activeProfile()?.name||'BMW M3 Competition xDrive';renderConfig();updateAll();toast(mode==='scratch'?'Scratch architecture enabled':'Production model mode enabled')}

function optionButton(item,current,onClick,sub='',pro=false){
  const locked=pro&&!state.pro; return `<button class="choice ${item.id===current?'active':''}" data-opt="${item.id}" ${locked?'data-locked="1"':''}><strong>${item.name}</strong><small>${sub||item.desc||('+'+(item.price||0).toLocaleString()+' USD')}</small>${locked?'<span class="pill pro">PRO</span>':((item.price||0)>0?`<span class="pill">+$${Math.round(item.price).toLocaleString()}</span>`:'')}</button>`
}
function bindChoices(container,items,key,onSelect){container.querySelectorAll('.choice').forEach(btn=>btn.addEventListener('click',()=>{const item=items.find(x=>x.id===btn.dataset.opt);if(!item)return;if(btn.dataset.locked){openPremium();return}onSelect(item)}))}
function premiumCard(){return `<div class="premium-card"><div class="eyebrow small">PREMIUM</div><h4>Pro Garage · $20</h4><p>Unlock V10/V12/hybrid power, forged wheels, carbon interior, race aero and exclusive widebody programs.</p><div class="premium-row"><strong>$20</strong><button class="solid-btn" id="premiumBtn">UNLOCK</button></div></div>`}

function renderConfig(){
  const el=$('#config'); const v=activeProfile(); if(!v)return;
  $('#buildName').textContent=state.name;$('#viewerName').textContent=state.name;$('#viewerTag').textContent=v.tag;
  let html='';
  if(activeTab==='vehicle') html=renderVehicleTab(v);
  if(activeTab==='exterior') html=renderExteriorTab(v);
  if(activeTab==='wheels') html=renderWheelsTab(v);
  if(activeTab==='interior') html=renderInteriorTab(v);
  if(activeTab==='power') html=renderPowerTab(v);
  if(activeTab==='chassis') html=renderChassisTab(v);
  if(activeTab==='details') html=renderDetailsTab(v);
  el.innerHTML=html;
  bindDynamic(); updateAll();
}
function title(t,s){return `<div class="config-title"><h3>${t}</h3><span>${s||''}</span></div>`}
function renderVehicleTab(v){
  const models=catalog.referenceModels||[];
  const brands=[...new Set(models.map(x=>x.brand))];
  let h=title(state.mode==='scratch'?'Architecture':'Real-world garage',state.mode==='scratch'?'Shape the base silhouette':'Choose a real production model profile');
  h+=`<div class="garage-head"><div><strong>${models.length} models</strong><span>BMW · Dodge · Ford · Toyota · Porsche · Chevrolet · Nissan · Mercedes-AMG · Audi · Lexus · McLaren · Aston Martin · Lamborghini · Ferrari · Honda · Subaru</span></div><label class="garage-search"><span>⌕</span><input id="modelSearch" placeholder="Search model or brand" autocomplete="off"></label></div>`;
  h+='<div class="brand-filter" id="brandFilter"><button class="brand-pill active" data-brand="all">ALL</button>'+brands.map(b=>`<button class="brand-pill" data-brand="${escapeHtml(b)}">${escapeHtml(b)}</button>`).join('')+'</div>';
  h+='<div class="real-model-grid" id="realModelGrid">';
  for(const m of models){
    const sel=m.id===state.vehicle?' selected':'';
    const pressed=m.id===state.vehicle?'true':'false';
    h+=`<button type="button" class="real-model-card${sel}" data-real-model="${m.id}" data-brand="${escapeHtml(m.brand)}" data-search="${escapeHtml((m.brand+' '+m.name+' '+m.category).toLowerCase())}" aria-pressed="${pressed}"><span class="model-top"><span class="model-brand">${escapeHtml(m.brand)}</span>${m.id===state.vehicle?'<span class="selected-mark">SELECTED ✓</span>':''}</span><strong>${escapeHtml(m.name)}</strong><span class="model-meta">${escapeHtml(m.year)} · ${escapeHtml(m.category)}</span><span class="model-stats"><b>${m.hp} HP</b><b>${m.zero.toFixed(1)} s 0–100</b></span><span class="model-choose">${m.id===state.vehicle?'ACTIVE BUILD':'SELECT MODEL'} <span>→</span></span></button>`;
  }
  h+='</div>';
  if(state.mode==='scratch'){
    h+=title('Custom proportions','Change the silhouette while retaining the selected 3D base');
    h+=slider('length','Overall length',state.length,-8,8,'%');
    h+=slider('width','Overall width',state.width,-7,9,'%');
    h+=slider('front','Front overhang',state.front,-5,5,'%');
    h+=slider('rear','Rear overhang',state.rear,-5,5,'%');
  }
  h+=title('Build identity','Name this configuration');
  h+=`<div class="row"><label>Vehicle name</label><input id="nameInput" value="${escapeHtml(state.name)}" maxlength="34" style="width:65%;padding:8px;border-radius:7px;border:1px solid #2a313a;background:#0d1014;color:#fff"></div>`;
  h+=`<div class="reference-note"><strong>Real-world reference profile</strong><span>${escapeHtml(catalog.realCarDisclaimer||'')}</span></div>`;
  return h;
}
function slider(id,label,val,min,max,suffix){return `<div class="row"><label>${label}</label><span class="value" id="${id}Val">${val>0?'+':''}${val}${suffix}</span></div><input class="range" id="${id}Range" type="range" min="${min}" max="${max}" value="${val}">`}
function renderExteriorTab(){
  let h=title('Paint','Live material swap');h+='<div class="swatches">';for(const p of catalog.paints)h+=`<button class="swatch ${state.paint===p.id?'active':''}" data-paint="${p.id}" title="${p.name}" style="background:${p.hex}"></button>`;h+='</div><div class="swatch-label" id="paintName"></div>';
  h+=title('Surface finish','');h+='<div class="choice-grid">'+catalog.paints.slice(0,4).map(p=>optionButton(p,state.paint,()=>{},`${p.type} · +$${p.price}`)).join('')+'</div>';
  h+=title('Body kit','Physical aero overlays');h+='<div class="choice-grid">'+catalog.bodykits.map(k=>optionButton(k,state.body,'',k.desc,k.pro)).join('')+'</div>';
  h+=title('Lighting & trim','');
  h+=toggle('lights','Signature LED lighting',state.lights,'Night-ready headlamps and tails');
  h+=toggle('exhaust','Visible exhaust hardware',state.exhaust,'Titanium-style tips');
  return h;
}
function renderWheelsTab(){let h=title('Wheel design','Real-time wheel geometry');h+='<div class="choice-grid">'+catalog.wheels.map(w=>optionButton(w,state.wheel,'',`${w.size}\" · ${w.finish}`,w.pro)).join('')+'</div>';h+=title('Brake package','Mass, price and visual hardware');h+='<div class="choice-grid">'+catalog.brakes.map(b=>optionButton(b,state.brakes,'',`${b.price?'$'+b.price.toLocaleString():'Included'}`,b.pro)).join('')+'</div>';h+=slider('ride','Ride height',state.ride,-30,20,' mm');h+=slider('track','Track width',state.track,-10,25,' mm');return h}
function renderInteriorTab(){let h=title('Interior','Cabin-focused camera');h+='<div class="choice-grid">'+catalog.interiors.map(i=>optionButton(i,state.interior,'',`${i.price?'+'+i.price.toLocaleString()+' USD':'Included'}`,i.pro)).join('')+'</div>';h+=title('Ambient lighting','Accent glow in the cabin');h+=`<div class="swatches" id="ambientSwatches">${['#d9ef71','#8eb7ff','#ff6d73','#d8c28e','#ffffff'].map((c,i)=>`<button class="swatch ambient" data-amb="${c}" style="background:${c}"></button>`).join('')}</div>`;return h}
function renderPowerTab(v){let h=title('Engine','Performance model');h+='<div class="choice-grid">'+catalog.engines.map(e=>optionButton(e,state.engine,'',`${e.layout} · ${e.hp} HP`,e.pro)).join('')+'</div>';h+=title('Drivetrain','');h+='<div class="choice-grid">'+catalog.drivetrains.map(d=>optionButton(d,state.drivetrain,'',`+$${(d.price||0).toLocaleString()}`)).join('')+'</div>';h+=title('Transmission','');h+='<div class="choice-grid">'+catalog.transmissions.map(t=>optionButton(t,state.transmission,'',`shift ${t.shift>0?'+':''}${t.shift.toFixed(2)}s`)).join('')+'</div>';return h}
function renderChassisTab(v){let h=title('Aerodynamics','Downforce affects the live 0–100/top-speed model');h+='<div class="choice-grid">'+catalog.aero.map(a=>optionButton(a,state.aero,'',`${a.downforce} kg @ high speed`,a.pro)).join('')+'</div>';h+=title('Weight distribution','Tune the build for response');h+=slider('balance','Front weight bias',50,45,55,'%');h+=title('Performance notes','Formula-based estimate, not random');h+='<div class="section-stack"><div class="toggle-row"><div><strong>Weight reduction</strong><small>Remove 6% mass from trim and non-structural parts.</small></div><button class="switch" id="weightSwitch"><i></i></button></div></div>';return h}
function renderDetailsTab(v){let h=title('Build sheet','Everything updates from the active configuration');h+=`<div class="section-stack"><div class="toggle-row"><div><strong>Open bonnet</strong><small>Use the asset's real bonnet animation where available.</small></div><button class="text-btn" id="bonnetBtn">OPEN</button></div><div class="toggle-row"><div><strong>Open doors</strong><small>Preview the production-style door pivots.</small></div><button class="text-btn" id="doorsBtn">OPEN</button></div><div class="toggle-row"><div><strong>Interior camera</strong><small>Jump into the cabin.</small></div><button class="text-btn" id="interiorBtn">VIEW</button></div></div>`;h+=premiumCard();return h}
function toggle(id,label,on,sub){return `<div class="toggle-row"><div><strong>${label}</strong><small>${sub}</small></div><button class="switch ${on?'on':''}" id="${id}Switch"><i></i></button></div>`}

function bindDynamic(){
  const area=$('#config');
  const modelSelect=area.querySelector('#realModelGrid');
  modelSelect?.addEventListener('click',(e)=>{
    const card=e.target.closest('[data-real-model]');
    if(!card)return;
    e.preventDefault();
    const id=card.dataset.realModel;
    const model=catalog.referenceModels?.find(x=>x.id===id);
    if(!model)return;
    state.vehicle=id;
    state.name=model.brand+' '+model.name;
    $('#buildName').textContent=state.name;
    $('#viewerName').textContent=state.name;
    document.querySelectorAll('#realModelGrid [data-real-model]').forEach(x=>{
      const active=x.dataset.realModel===id;
      x.classList.toggle('selected',active);
      x.setAttribute('aria-pressed',String(active));
      const mark=x.querySelector('.selected-mark');
      const choose=x.querySelector('.model-choose');
      if(mark) mark.textContent=active?'SELECTED ✓':'';
      if(choose) choose.innerHTML=active?'ACTIVE BUILD <span>✓</span>':'SELECT MODEL <span>→</span>';
    });
    loadVehicle();
    updateAll();
    toast(`${model.brand} ${model.name} selected`);
  });
  const search=$('#modelSearch');
  const grid=$('#realModelGrid');
  const pills=[...document.querySelectorAll('.brand-pill')];
  let activeBrand='all';
  const filterModels=()=>{
    const q=(search?.value||'').trim().toLowerCase();
    grid?.querySelectorAll('[data-real-model]').forEach(card=>{const okBrand=activeBrand==='all'||card.dataset.brand===activeBrand;const okText=!q||card.dataset.search.includes(q);card.hidden=!(okBrand&&okText)});
  };
  search?.addEventListener('input',filterModels);
  pills.forEach(pill=>pill.addEventListener('click',()=>{activeBrand=pill.dataset.brand;pills.forEach(x=>x.classList.toggle('active',x===pill));filterModels()}));

  area.querySelectorAll('.swatch[data-paint]').forEach(b=>b.onclick=()=>{state.paint=b.dataset.paint;applyAllMaterials();renderConfig();toast('Paint updated')});
  area.querySelectorAll('.choice').forEach(b=>b.onclick=()=>handleChoice(b));
  const sliders=['length','width','front','rear','ride','track'];for(const id of sliders){const r=$(`#${id}Range`);if(r)r.oninput=()=>{state[id]=+r.value;const val=$(`#${id}Val`);if(val)val.textContent=(state[id]>0?'+':'')+state[id]+(id==='ride'||id==='track'?' mm':'%');applyVehicleTransforms();updateAll()}}
  const ni=$('#nameInput');if(ni)ni.oninput=()=>{state.name=ni.value||'Untitled Forge';$('#buildName').textContent=state.name;$('#viewerName').textContent=state.name};
  const switches=[['lights','lights'],['exhaust','exhaust']];for(const [id,key] of switches){const s=$(`#${id}Switch`);if(s)s.onclick=()=>{state[key]=!state[key];s.classList.toggle('on',state[key]);applyDetails()}}
  const ws=$('#weightSwitch');if(ws)ws.onclick=()=>{state.weightReduction=!state.weightReduction;ws.classList.toggle('on',!!state.weightReduction);applyAllMaterials();updateAll()}
  $('#premiumBtn')?.addEventListener('click',openPremium);$('#bonnetBtn')?.addEventListener('click',()=>playClip(/bonnet/i));$('#doorsBtn')?.addEventListener('click',()=>playClip(/door/i));$('#interiorBtn')?.addEventListener('click',()=>setCamera('interior'));
}
function handleChoice(b){const id=b.dataset.opt; if(b.dataset.locked){openPremium();return} const tab=activeTab;
  if(tab==='vehicle'){const ref=catalog.referenceModels?.find(v=>v.id===id); if(ref){state.vehicle=id;state.name=ref.brand+' '+ref.name;loadVehicle();renderConfig();return} const base=catalog.vehicles.find(v=>v.id===id); if(base){state.vehicle=id;state.name=state.mode==='scratch'?'Forge Custom':base.name;loadVehicle();renderConfig();return}}
  if(tab==='exterior'){const hit=[...catalog.bodykits].find(x=>x.id===id);if(hit){state.body=id;renderConfig();return}}
  if(tab==='wheels'){if(catalog.wheels.some(x=>x.id===id))state.wheel=id;else if(catalog.brakes.some(x=>x.id===id))state.brakes=id;renderConfig();return}
  if(tab==='interior'){state.interior=id;renderConfig();return}
  if(tab==='power'){if(catalog.engines.some(x=>x.id===id))state.engine=id;else if(catalog.drivetrains.some(x=>x.id===id))state.drivetrain=id;else if(catalog.transmissions.some(x=>x.id===id))state.transmission=id;renderConfig();return}
  if(tab==='chassis'){state.aero=id;renderConfig();return}
}

async function loadVehicle(){
  const requestedVehicle=state.vehicle;
  const v=activeProfile();if(!v)return; const base={...v,id:v.id,url:v.url,name:v.name};
  $('#loading').classList.remove('hidden');$('#loadStatus').textContent=`Preparing ${v.name}…`;
  if(carRoot){scene.remove(carRoot)};
  extras=null;mixer=null;wheelOriginals=[];
  try{
    const gltf=await loadModel(base,true);
    if(state.vehicle!==requestedVehicle)return;
    carRoot=gltf.scene;currentVehicle=v;scene.add(carRoot);
    carRoot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if('roughness'in m)m.roughness=Math.min(m.roughness+.03,.9);if('metalness'in m)m.metalness=Math.max(m.metalness,.05)})}}});
    mixer=gltf.animations?.length?new THREE.AnimationMixer(carRoot):null;
    if(gltf.animations?.length){const idle=gltf.animations.find(a=>/wheel-roll/i.test(a.name))||gltf.animations[0];mixer.clipAction(idle).play()}
    fitModel();applyAllMaterials();applyVehicleTransforms();applyDetails();setCamera(cameraMode,true);$('#assetLabel').textContent=`3D REFERENCE / ${v.brand?v.brand+' · ':''}${v.name}`;$('#loading').classList.add('hidden');toast('3D vehicle ready');
  }catch(err){console.error(err);$('#loadStatus').textContent='The 3D asset could not be loaded. Check your connection and refresh.';$('#assetLabel').textContent='GLB / LOAD ERROR'}
}
function fitModel(){
 const box=new THREE.Box3().setFromObject(carRoot);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());const max=Math.max(size.x,size.y,size.z);baseScale=4.7/max;carRoot.scale.setScalar(baseScale);carRoot.position.set(-center.x*baseScale,-box.min.y*baseScale, -center.z*baseScale);baseCenter.set(0,0,0);
}
function applyAllMaterials(){if(!carRoot)return;const p=catalog.paints.find(x=>x.id===state.paint);const int=catalog.interiors.find(x=>x.id===state.interior);const paintColor=new THREE.Color(p.hex);const interiorColor=new THREE.Color(int.accent);carRoot.traverse(o=>{if(!o.isMesh||!o.material)return;const mats=Array.isArray(o.material)?o.material:[o.material];const nm=(o.name+' '+mats.map(m=>m?.name||'').join(' ')).toLowerCase();if(/body|paint|panel|hood|bonnet|roof|door|fender|wing|quarter|bumper/.test(nm)){mats.forEach(m=>{m.color?.copy(paintColor);if('metalness'in m){m.metalness=p.type==='Matte'?.15:.78;m.roughness=p.type==='Matte'?.5:p.type==='Satin'?.28:.16};if('clearcoat'in m)m.clearcoat=.95;if('clearcoatRoughness'in m)m.clearcoatRoughness=.06})}if(/glass|window|windshield/.test(nm)){mats.forEach(m=>{m.color?.set(0x10151a);m.transparent=true;m.opacity=.92;m.roughness=.06})}if(/seat|dashboard|interior|doortrim|steering|console/.test(nm)){mats.forEach(m=>m.color?.copy(interiorColor))}if(/tyre|tire|rubber/.test(nm)){mats.forEach(m=>{m.color?.set(0x080909);if('roughness'in m)m.roughness=.76})}});applyWheelTheme();createAero();}
function applyWheelTheme(){if(!carRoot)return;const w=catalog.wheels.find(x=>x.id===state.wheel);carRoot.traverse(o=>{if(!o.isMesh||!o.material)return;const nm=(o.name||'').toLowerCase();if(/wheel|rim|alloy/.test(nm)){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if(/carbon/i.test(w.id))m.color?.set(0x111214);else if(w.id==='forged')m.color?.set(0x6f7479);else if(w.id==='mesh')m.color?.set(0x25282c);else m.color?.set(0xb0b4b7);if('metalness'in m)m.metalness=.92;if('roughness'in m)m.roughness=.2})}})}
function modelVisualTune(){
  const id=currentVehicle?.id||state.vehicle||'';
  const tune={x:1,y:1,z:1,roof:0,stance:0,wheel:1};
  const map={
    'bmw-m3-xdrive':{x:1.05,y:.99,z:1.02,roof:-.02,stance:-.01,wheel:1.03},
    'bmw-m4':{x:1.03,y:.97,z:1.04,roof:-.05,stance:-.015,wheel:1.04},
    'bmw-m5':{x:1.06,y:1.01,z:1.08,roof:.01,stance:0,wheel:1.05},
    'bmw-x5-m':{x:1.08,y:1.12,z:1.02,roof:.04,stance:.03,wheel:1.06},
    'dodge-charger-scat':{x:1.10,y:1.00,z:1.10,roof:-.01,stance:.01,wheel:1.08},
    'dodge-daytona':{x:1.08,y:.98,z:1.10,roof:-.03,stance:-.005,wheel:1.09},
    'ford-mustang-gt':{x:1.06,y:.98,z:1.07,roof:-.04,stance:-.01,wheel:1.06},
    'toyota-supra-30':{x:.98,y:.96,z:1.00,roof:-.06,stance:-.02,wheel:1.03},
    'porsche-911-carrera':{x:.94,y:.96,z:.98,roof:-.09,stance:-.02,wheel:1.02},
    'porsche-911-turbo-s':{x:.96,y:.98,z:1.01,roof:-.08,stance:-.025,wheel:1.08},
    'corvette-stingray':{x:.95,y:.94,z:1.07,roof:-.10,stance:-.025,wheel:1.08},
    'corvette-zr1x':{x:.98,y:.95,z:1.10,roof:-.11,stance:-.035,wheel:1.12},
    'nissan-gtr':{x:1.02,y:1.00,z:1.05,roof:-.04,stance:-.015,wheel:1.06},
    'honda-type-r':{x:1.01,y:1.04,z:1.00,roof:.03,stance:.005,wheel:1.01},
    'subaru-wrx':{x:1.02,y:1.00,z:1.03,roof:0,stance:-.005,wheel:1.04},
    'mercedes-amg-gt':{x:1.04,y:.98,z:1.06,roof:-.05,stance:-.01,wheel:1.07},
    'audi-rs6':{x:1.04,y:1.02,z:1.08,roof:.01,stance:.005,wheel:1.05},
    'lexus-lc500':{x:1.02,y:.99,z:1.04,roof:-.05,stance:-.005,wheel:1.06},
    'mclaren-artura':{x:.92,y:.91,z:1.02,roof:-.12,stance:-.035,wheel:1.09},
    'aston-vantage':{x:.98,y:.95,z:1.07,roof:-.07,stance:-.02,wheel:1.08},
    'lamborghini-revuelto':{x:.90,y:.91,z:1.08,roof:-.13,stance:-.04,wheel:1.12},
    'ferrari-296':{x:.91,y:.90,z:1.05,roof:-.12,stance:-.035,wheel:1.10}
  };
  return map[id]||tune;
}
function applyVehicleTransforms(){
  if(!carRoot)return;
  const b=catalog.bodykits.find(x=>x.id===state.body);
  const tune=modelVisualTune();
  const vScale=state.mode==='scratch'?{x:1+state.width*.009,y:1+state.width*.004,z:1+state.length*.009}:{x:1,y:1,z:1};
  const bodyMul={x:vScale.x*tune.x,y:vScale.y*tune.y,z:vScale.z*tune.z};
  carRoot.scale.set(baseScale*bodyMul.x,baseScale*bodyMul.y,baseScale*bodyMul.z);
  carRoot.position.y=(b.drop+state.ride)*.008+tune.stance;
  carRoot.position.x=state.track*.004;
  createAero();
  updateAll();
}
function createAero(){if(!carRoot)return;extras?.traverse(o=>o.geometry?.dispose?.());extras?.removeFromParent();extras=new THREE.Group();extras.name='DriveForge_Aero';const b=catalog.bodykits.find(x=>x.id===state.body),a=catalog.aero.find(x=>x.id===state.aero);const paint=new THREE.MeshPhysicalMaterial({color:new THREE.Color(catalog.paints.find(x=>x.id===state.paint).hex),metalness:.76,roughness:.18,clearcoat:.9});const carbon=new THREE.MeshPhysicalMaterial({color:0x111417,metalness:.75,roughness:.22,clearcoat:.45});
 const zFront=2.45, zRear=-2.35, y=.25; extras.add(new THREE.Mesh(new THREE.BoxGeometry(2.2,.06,.32),carbon));extras.children[0].position.set(0,y,zFront);
 if(b.id!=='stock'){const sill=new THREE.BoxGeometry(.08,.12,1.8);for(const x of[-1.05,1.05]){const s=new THREE.Mesh(sill,carbon);s.position.set(x,.34,0);extras.add(s)}}
 if(['wide','track'].includes(b.id)){for(const x of[-1.12,1.12]){const f=new THREE.Mesh(new THREE.BoxGeometry(.12,.28,1.65),paint);f.position.set(x,.5,-.1);extras.add(f)}}
 if(['track','luxury'].includes(b.id)){const rearBar=new THREE.Mesh(new THREE.BoxGeometry(1.85,.08,.2),carbon);rearBar.position.set(0,1.15,zRear);extras.add(rearBar);for(const x of[-.55,.55]){const st=new THREE.Mesh(new THREE.BoxGeometry(.055,.32,.055),carbon);st.position.set(x,1.0,zRear);extras.add(st)}}
 if(a.downforce>0 && !['track'].includes(b.id)){const rear=new THREE.Mesh(new THREE.BoxGeometry(1.65,.06,.14),carbon);rear.position.set(0,.99,zRear+.05);extras.add(rear)}
 createModelSpecificDetail();
 createBrandSignature(vBrandForScene());
 carRoot.add(extras);
}
function vBrandForScene(){return currentVehicle?.brand||activeProfile()?.brand||''}
function createModelSpecificDetail(){
  if(!extras)return;
  const id=currentVehicle?.id||state.vehicle||'';
  const tune=modelVisualTune();
  const dark=new THREE.MeshPhysicalMaterial({color:0x0d0f11,metalness:.86,roughness:.2,clearcoat:.5});
  const carbon=new THREE.MeshPhysicalMaterial({color:0x111315,metalness:.72,roughness:.2,clearcoat:.5});
  const light=new THREE.MeshPhysicalMaterial({color:0xe8f8ff,emissive:0xb5dcff,emissiveIntensity:2.8,roughness:.12});
  const red=new THREE.MeshPhysicalMaterial({color:0xff1824,emissive:0x5a0007,emissiveIntensity:1.7,roughness:.16});
  const front=2.48, rear=-2.38;
  const add=(geo,mat,pos,rot=[0,0,0])=>{const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;extras.add(m);return m};
  if(/dodge-charger/i.test(id)||/dodge-daytona/i.test(id)){
    add(new THREE.BoxGeometry(1.9,.10,.10),dark,[0,.52,front+.04]);
    for(const x of[-.72,-.48,.48,.72])add(new THREE.BoxGeometry(.06,.22,.04),light,[x,.72,front+.05]);
    add(new THREE.BoxGeometry(1.65,.06,.06),red,[0,.84,rear]);
    if(/scat/i.test(id))add(new THREE.BoxGeometry(1.30,.07,.08),carbon,[0,.78,.72]);
  } else if(/bmw-m3|bmw-m4|bmw-m5/i.test(id)){
    for(const x of[-.27,.27])add(new THREE.BoxGeometry(.22,.30,.06),dark,[x,.57,front+.02]);
    add(new THREE.BoxGeometry(1.15,.04,.04),light,[0,.78,front+.04]);
    add(new THREE.BoxGeometry(1.55,.05,.06),red,[0,.92,rear]);
  } else if(/mustang/i.test(id)){
    add(new THREE.BoxGeometry(1.60,.22,.06),dark,[0,.57,front+.02]);
    for(const x of[-.62,-.42,.42,.62])add(new THREE.BoxGeometry(.045,.12,.05),light,[x,.78,front+.03]);
    add(new THREE.BoxGeometry(1.45,.05,.05),red,[0,.88,rear]);
  } else if(/porsche/i.test(id)){
    for(const x of[-.65,-.43,.43,.65])add(new THREE.BoxGeometry(.055,.15,.04),light,[x,.75,front+.04]);
    add(new THREE.BoxGeometry(1.50,.04,.05),red,[0,.80,rear]);
  } else if(/corvette|ferrari|mclaren|lamborghini/i.test(id)){
    add(new THREE.BoxGeometry(1.55,.16,.05),dark,[0,.48,front+.03]);
    add(new THREE.BoxGeometry(1.28,.04,.05),light,[0,.72,front+.04]);
    add(new THREE.BoxGeometry(1.42,.05,.05),red,[0,.86,rear]);
  } else if(/honda-type-r/i.test(id)){
    add(new THREE.BoxGeometry(1.46,.20,.05),dark,[0,.56,front+.03]);
    add(new THREE.BoxGeometry(1.35,.05,.05),red,[0,.85,rear]);
    add(new THREE.BoxGeometry(1.55,.055,.20),carbon,[0,1.00,rear-.03]);
  } else if(/audi-rs6/i.test(id)){
    add(new THREE.BoxGeometry(1.48,.24,.05),dark,[0,.57,front+.02]);
    add(new THREE.BoxGeometry(1.32,.04,.04),light,[0,.79,front+.03]);
    add(new THREE.BoxGeometry(1.38,.05,.05),red,[0,.87,rear]);
  } else {
    add(new THREE.BoxGeometry(1.38,.18,.05),dark,[0,.56,front+.03]);
    add(new THREE.BoxGeometry(1.22,.04,.04),light,[0,.78,front+.04]);
    add(new THREE.BoxGeometry(1.34,.05,.05),red,[0,.86,rear]);
  }
}
function createBrandSignature(brand){
  if(!carRoot||!extras||!brand)return;
  const dark=new THREE.MeshPhysicalMaterial({color:0x111315,metalness:.86,roughness:.18,clearcoat:.55});
  const chrome=new THREE.MeshPhysicalMaterial({color:0xb9bec3,metalness:.95,roughness:.12});
  const light=new THREE.MeshPhysicalMaterial({color:0xdff7ff,emissive:0x9fd7ff,emissiveIntensity:2.3,metalness:.1,roughness:.12});
  const amber=new THREE.MeshPhysicalMaterial({color:0xff8b30,emissive:0xff4b10,emissiveIntensity:1.6,roughness:.2});
  const frontZ=2.48, rearZ=-2.38;
  if(/BMW/i.test(brand)){
    for(const x of[-.34,.34]){const g=new THREE.Mesh(new THREE.BoxGeometry(.22,.26,.05),dark);g.position.set(x,.55,frontZ);extras.add(g)}
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(1.15,.04,.05),light);lamp.position.set(0,.78,frontZ+.02);extras.add(lamp);
  } else if(/Dodge/i.test(brand)){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(1.45,.16,.06),dark);bar.position.set(0,.61,frontZ);extras.add(bar);
    for(const x of[-.62,.62]){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.22,.07,.05),light);lamp.position.set(x,.79,frontZ+.02);extras.add(lamp)}
  } else if(/Ford|Mustang/i.test(brand)){
    const grille=new THREE.Mesh(new THREE.BoxGeometry(1.5,.26,.05),dark);grille.position.set(0,.58,frontZ);extras.add(grille);
    const sig=new THREE.Mesh(new THREE.BoxGeometry(.72,.045,.04),light);sig.position.set(0,.82,frontZ+.02);extras.add(sig);
  } else if(/Porsche/i.test(brand)){
    const grille=new THREE.Mesh(new THREE.BoxGeometry(1.55,.10,.06),dark);grille.position.set(0,.58,frontZ);extras.add(grille);
    for(const x of[-.6,.6]){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.14,.08,.05),light);lamp.position.set(x,.8,frontZ+.03);extras.add(lamp)}
  } else if(/Mercedes-AMG/i.test(brand)){
    const grille=new THREE.Mesh(new THREE.BoxGeometry(1.65,.2,.05),dark);grille.position.set(0,.59,frontZ);extras.add(grille);
    for(let i=-4;i<=4;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(.025,.14,.035),chrome);slat.position.set(i*.12,.60,frontZ+.03);slat.rotation.y=.12;extras.add(slat)}
  } else if(/Audi/i.test(brand)){
    const grille=new THREE.Mesh(new THREE.BoxGeometry(1.45,.28,.05),dark);grille.position.set(0,.58,frontZ);extras.add(grille);
    const sig=new THREE.Mesh(new THREE.BoxGeometry(1.0,.035,.04),light);sig.position.set(0,.80,frontZ+.03);extras.add(sig);
  } else if(/Toyota|Lexus|Honda|Subaru/i.test(brand)){
    const grille=new THREE.Mesh(new THREE.BoxGeometry(1.3,.22,.05),dark);grille.position.set(0,.59,frontZ);extras.add(grille);
    for(const x of[-.54,.54]){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.20,.07,.05),light);lamp.position.set(x,.8,frontZ+.03);extras.add(lamp)}
  } else if(/Chevrolet|Corvette/i.test(brand)){
    const intake=new THREE.Mesh(new THREE.BoxGeometry(1.72,.25,.05),dark);intake.position.set(0,.53,frontZ);extras.add(intake);
    const sig=new THREE.Mesh(new THREE.BoxGeometry(.82,.04,.04),light);sig.position.set(0,.8,frontZ+.03);extras.add(sig);
  } else if(/Nissan/i.test(brand)){
    const intake=new THREE.Mesh(new THREE.BoxGeometry(1.60,.22,.05),dark);intake.position.set(0,.57,frontZ);extras.add(intake);
    const sig=new THREE.Mesh(new THREE.BoxGeometry(.90,.04,.04),light);sig.position.set(0,.79,frontZ+.03);extras.add(sig);
  } else if(/Lamborghini|Ferrari|McLaren|Aston Martin/i.test(brand)){
    const intake=new THREE.Mesh(new THREE.BoxGeometry(1.75,.20,.06),dark);intake.position.set(0,.49,frontZ);extras.add(intake);
    const sig=new THREE.Mesh(new THREE.BoxGeometry(.62,.035,.04),light);sig.position.set(0,.76,frontZ+.03);extras.add(sig);
    const rear=new THREE.Mesh(new THREE.BoxGeometry(1.45,.045,.045),amber);rear.position.set(0,.88,rearZ-.02);extras.add(rear);
  }
} 
function applyDetails(){if(!carRoot)return;carRoot.traverse(o=>{if(!o.isMesh)return;const nm=(o.name||'').toLowerCase();if(/head|headlamp|headlight|tail|rear.?light|lamp/.test(nm)){o.visible=state.lights}})}
function playClip(re){if(!mixer||!carRoot)return;const clip=carRoot.animations?.find(a=>re.test(a.name));if(clip){mixer.stopAllAction();const act=mixer.clipAction(clip);act.reset().setLoop(THREE.LoopOnce,1);act.clampWhenFinished=true;act.play()}else toast('This model does not expose that animation')}

function setCamera(mode,snap=false){cameraMode=mode;const poses={hero:[7.2,3.5,8.2],front:[0,2.5,10.5],rear:[0,2.4,-10.5],side:[10.2,2.7,0],interior:[0,1.2,0.25]};const p=poses[mode]||poses.hero;camera.position.set(...p);if(mode==='interior'){controls.target.set(0,1.15,1.2)}else controls.target.set(0,.85,0);controls.maxDistance=mode==='interior'?3.2:15;controls.minDistance=mode==='interior'?.4:3.2;if(snap)controls.update();document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===mode));}

function updateAll(){if(!catalog)return;const v=activeProfile(),e=catalog.engines.find(x=>x.id===state.engine),d=catalog.drivetrains.find(x=>x.id===state.drivetrain),t=catalog.transmissions.find(x=>x.id===state.transmission),b=catalog.bodykits.find(x=>x.id===state.body),w=catalog.wheels.find(x=>x.id===state.wheel),br=catalog.brakes.find(x=>x.id===state.brakes),a=catalog.aero.find(x=>x.id===state.aero),i=catalog.interiors.find(x=>x.id===state.interior),p=catalog.paints.find(x=>x.id===state.paint);
 let hp=Math.round(v.hp + (e.hp-v.hp)*.62 + (a.downforce*.08));let tq=Math.round(v.torque + (e.torque-v.torque)*.62);let wt=Math.max(980,Math.round(v.weight + e.weight + br.weight + (w.size-20)*3 - (state.weightReduction?95:0)));let zero=Math.max(2.3, v.zero + (e.zero*.7) + t.shift - d.bias*0.35 + (state.ride<0?-0.08:state.ride*.002) - (b.drop<0?.08:0) - a.downforce*.0012);let top=Math.min(390,Math.round(v.top + e.top + d.bias*2 + (b.drop<0?4:0) - (state.track>15?2:0)));const power=hp/(wt/1000);let price=v.basePrice+p.price+w.price+b.price+e.price+d.price+t.price+br.price+a.price+i.price+(state.weightReduction?3200:0);
 $('#hp').textContent=hp;$('#torque').textContent=tq;$('#zero').textContent=zero.toFixed(1);$('#top').textContent=top;$('#weight').textContent=wt.toLocaleString();$('#pwr').textContent=Math.round(power);$('#price').textContent='$'+Math.round(price).toLocaleString();$('#driveLabel').textContent=`${d.name} · ${t.name}`.toUpperCase();$('#engineLabel').textContent=e.name.toUpperCase();$('#progressBar').style.width=Math.min(100,Math.round((countConfigured()/16)*100))+'%';$('#progressText').textContent=`${countConfigured()} / 16`;$('#proBadge').textContent=state.pro?'PRO ON':'PRO OFF';$('#proBadge').classList.toggle('on',state.pro);
 const pn=$('#paintName');if(pn)pn.textContent=`${p.name} · ${p.type} · ${p.price?'$'+p.price:'included'}`;
}
function countConfigured(){let n=0;for(const x of [state.vehicle,state.paint,state.wheel,state.body,state.interior,state.engine,state.drivetrain,state.transmission,state.brakes,state.aero])if(x)n++;if(state.ride||state.track||state.width||state.length)n++;if(state.lights)n++;return Math.min(16,n)}
function openPremium(){$('#modal').classList.remove('hidden')}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>el.classList.remove('show'),2200)}
function resetBuild(){Object.assign(state,{vehicle:'bmw-m3-xdrive',paint:'crimson',wheel:'split5',body:'sport',interior:'black',engine:'v6',drivetrain:'rwd',transmission:'dct',brakes:'bigsteel',aero:'active',ride:0,track:0,width:0,length:0,front:0,rear:0,lights:true,exhaust:true,weightReduction:false,name:'BMW M3 Competition xDrive'});activeTab='vehicle';document.querySelectorAll('.tabs button').forEach((b,i)=>b.classList.toggle('active',i===0));renderConfig();loadVehicle();toast('Build reset')}
function saveBuild(){const spec={name:state.name,vehicle:state.vehicle,paint:state.paint,wheel:state.wheel,body:state.body,interior:state.interior,engine:state.engine,drivetrain:state.drivetrain,transmission:state.transmission,brakes:state.brakes,aero:state.aero,ride:state.ride,track:state.track,pro:state.pro};const blob=new Blob([JSON.stringify(spec,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(state.name||'driveforge-build').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`;a.click();URL.revokeObjectURL(a.href);toast('Build sheet saved')}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
