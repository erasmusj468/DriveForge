import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/environments/RoomEnvironment.js';

const data = await fetch('./data.json').then(r=>r.json());
const $ = id => document.getElementById(id);
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const state = { paint:data.paints[2], finish:'gloss', wheel:data.wheels[0], aero:data.aero[0], engine:data.engines[0], ride:0, track:0, pro:false, preset:'street', lights:'white' };
const presets = {
  street:{name:'Apex R Street',meta:'Mid-engine · 2 seats · road setup',paint:'rosso',aero:'clean',wheel:'oem',engine:'v6',drop:0},
  track:{name:'Apex R Track',meta:'Track-focused · 2 seats · wide stance',paint:'graphite',aero:'sport',wheel:'sport',engine:'v8',drop:-7},
  hyper:{name:'Apex R Hyper',meta:'Carbon aero · 2 seats · V12 flagship',paint:'obsidian',aero:'gt',wheel:'deep',engine:'v12',drop:-10,pro:true}
};

let renderer, scene, camera, controls, pmrem, env, model, mixer, clipMap = {}, aeroGroup, brakesGroup, autoRotate=false;
const clock = new THREE.Clock();

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b10);
  camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  camera.position.set(7.6, 3.8, 8.8);
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  $('scene').appendChild(renderer.domElement);
  pmrem = new THREE.PMREMGenerator(renderer);
  env = pmrem.fromScene(new RoomEnvironment(renderer), .05).texture; scene.environment = env;

  const key = new THREE.DirectionalLight(0xffffff, 4.2); key.position.set(5,8,6); key.castShadow=true; key.shadow.mapSize.set(2048,2048); scene.add(key);
  const fill = new THREE.DirectionalLight(0xb9d1ff, 1.7); fill.position.set(-7,4,1); scene.add(fill);
  const rim = new PointLight(0x7db5ff, 20, 18); rim.position.set(1.5,2.5,-6); scene.add(rim);
  const warm = new THREE.PointLight(0xffc27a, 18, 13); warm.position.set(-5,2,6); scene.add(warm);
  scene.add(new THREE.HemisphereLight(0x6f7f91,0x090b0e,.9));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70,70), new THREE.MeshStandardMaterial({color:0x0b0f14,roughness:.25,metalness:.28}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-.02; floor.receiveShadow=true; scene.add(floor);
  const platform = new THREE.Mesh(new THREE.CircleGeometry(6.8,128), new THREE.MeshStandardMaterial({color:0x151b22,roughness:.18,metalness:.42}));
  platform.rotation.x=-Math.PI/2; platform.position.y=-.01; platform.receiveShadow=true; scene.add(platform);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=.055; controls.minDistance=4.8; controls.maxDistance=15; controls.maxPolarAngle=1.48; controls.target.set(0,.72,0);
  controls.enablePan=false;
  renderer.domElement.addEventListener('dblclick', resetCamera);
  addEvents(); renderPresetChoices(); renderAll(); loadModel(); animate(); resize(); window.addEventListener('resize', resize);
}

function resize(){const el=$('scene'); renderer.setSize(el.clientWidth,el.clientHeight,false); camera.aspect=el.clientWidth/el.clientHeight; camera.updateProjectionMatrix();}
function resetCamera(){camera.position.set(7.6,3.8,8.8); controls.target.set(0,.72,0); controls.update();}
function addEvents(){
  $('resetBtn').onclick=()=>{state.paint=data.paints[2];state.finish='gloss';state.wheel=data.wheels[0];state.aero=data.aero[0];state.engine=data.engines[0];state.ride=0;state.track=0;state.preset='street';state.lights='white';renderAll();applyConfig();setCamera('hero');toast('Build reset');};
  $('saveBtn').onclick=()=>{const spec=`DRIVEFORGE BUILD\n${presets[state.preset].name}\nPaint: ${state.paint.name}\nFinish: ${state.finish}\nWheels: ${state.wheel.name}\nAero: ${state.aero.name}\nEngine: ${state.engine.name}\nRide: ${state.ride} mm\nTrack: +${state.track} mm\nValue: ${money(buildPrice())}`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([spec],{type:'text/plain'}));a.download='driveforge-build.txt';a.click();toast('Build sheet saved');};
  $('rideSlider').oninput=e=>{state.ride=+e.target.value;updateLabels();applyConfig();};
  $('trackSlider').oninput=e=>{state.track=+e.target.value;updateLabels();applyConfig();};
  $('rotateBtn').onclick=()=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;controls.autoRotateSpeed=1.2; $('rotateBtn').classList.toggle('active',autoRotate)};
  $('doorBtn').onclick=()=>playFirst(/door-open/i,'Doors opening'); $('hoodBtn').onclick=()=>playFirst(/bonnet-open|hood-open/i,'Bonnet opening');
  document.querySelectorAll('#cameraTabs button').forEach(b=>b.onclick=()=>setCamera(b.dataset.cam));
  document.querySelectorAll('.finish[data-finish]').forEach(b=>b.onclick=()=>{state.finish=b.dataset.finish;renderPaintFinishButtons();applyPaint();});
  document.querySelectorAll('.finish[data-lights]').forEach(b=>b.onclick=()=>{state.lights=b.dataset.lights;document.querySelectorAll('.finish[data-lights]').forEach(x=>x.classList.toggle('active',x===b));applyLights();});
  $('unlockBtn').onclick=()=>state.pro?toast('Pro Garage already unlocked'):openModal(); $('cancelBtn').onclick=closeModal;
  $('payBtn').onclick=()=>{state.pro=true;closeModal();renderAll();toast('Pro Garage unlocked — premium options enabled');};
}
function renderPresetChoices(){
  $('presetChoices').innerHTML=''; Object.entries(presets).forEach(([id,p])=>{const b=document.createElement('button');b.className='choice'+(state.preset===id?' active':'');b.innerHTML=`<b>${p.name}</b><small>${p.meta}</small>${p.pro&&!state.pro?'<span class="pill pro">PRO</span>':''}`;b.onclick=()=>{if(p.pro&&!state.pro){openModal();return;}state.preset=id;state.paint=data.paints.find(x=>x.id===p.paint);state.aero=data.aero.find(x=>x.id===p.aero);state.wheel=data.wheels.find(x=>x.id===p.wheel);state.engine=data.engines.find(x=>x.id===p.engine);state.ride=p.drop||0;state.track=id==='track'?10:0;renderAll();applyConfig();setCamera('hero');};$('presetChoices').appendChild(b)});
}
function renderAll(){renderPresetChoices(); renderPaints(); renderWheels(); renderAero(); renderEngines(); renderPaintFinishButtons(); updateLabels(); updateStats(); updateSummary(); updateHero();}
function renderPaints(){ $('paintChoices').innerHTML=''; data.paints.forEach(p=>{const b=document.createElement('button');b.className='swatch'+(state.paint.id===p.id?' active':'');b.title=p.name;b.style.background=`radial-gradient(circle at 30% 25%,#fff8,${p.hex} 35%,${p.hex} 70%,#000 160%)`;b.onclick=()=>{state.paint=p;document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));b.classList.add('active');applyPaint();updateSummary();};$('paintChoices').appendChild(b)});}
function renderPaintFinishButtons(){document.querySelectorAll('.finish[data-finish]').forEach(b=>b.classList.toggle('active',b.dataset.finish===state.finish));}
function renderWheels(){ $('wheelChoices').innerHTML=''; data.wheels.forEach(w=>{const b=document.createElement('button');b.className='choice'+(state.wheel.id===w.id?' active':'');b.innerHTML=`<b>${w.name}</b><small>${w.price? '+'+money(w.price):'Included'} · ${w.diameter}"</small>${w.pro&&!state.pro?'<span class="pill pro">PRO</span>':''}`;b.onclick=()=>{if(w.pro&&!state.pro){openModal();return;}state.wheel=w;renderAll();applyWheels();};$('wheelChoices').appendChild(b)});$('wheelLabel').textContent=state.wheel.diameter+' inch';}
function renderAero(){ $('aeroChoices').innerHTML=''; data.aero.forEach(a=>{const b=document.createElement('button');b.className='choice'+(state.aero.id===a.id?' active':'');b.innerHTML=`<b>${a.name}</b><small>${a.price? '+'+money(a.price):'Included'}</small>${a.pro&&!state.pro?'<span class="pill pro">PRO</span>':''}`;b.onclick=()=>{if(a.pro&&!state.pro){openModal();return;}state.aero=a;renderAll();applyAero();};$('aeroChoices').appendChild(b)});}
function renderEngines(){ $('engineChoices').innerHTML=''; data.engines.forEach(e=>{const b=document.createElement('button');b.className='choice'+(state.engine.id===e.id?' active':'');b.innerHTML=`<b>${e.name}</b><small>${e.hp} hp · ${e.price? '+'+money(e.price):'Included'}</small>${e.pro&&!state.pro?'<span class="pill pro">PRO</span>':''}`;b.onclick=()=>{if(e.pro&&!state.pro){openModal();return;}state.engine=e;renderAll();applyConfig();};$('engineChoices').appendChild(b)});}
function updateLabels(){ $('rideSlider').value=state.ride; $('trackSlider').value=state.track; $('rideValue').textContent=(state.ride>=0?'+':'')+state.ride+' mm'; $('trackValue').textContent='+'+state.track+' mm';}
function buildPrice(){return 92400+state.wheel.price+state.aero.price+state.engine.price;}
function updateStats(){const e=state.engine,a=state.aero;const hp=e.hp, tq=e.torque, zero=Math.max(2.5,e.zero+(a.drop<0?.03:0)-(state.track/1000)); $('hp').textContent=hp; $('torque').textContent=tq; $('zero').textContent=zero.toFixed(1)+'s'; $('top').textContent=e.top+(state.aero.id==='gt'?7:0); $('weight').textContent=(1470+e.weight+(state.aero.pro?34:0)).toLocaleString(); $('price').textContent=money(buildPrice());}
function updateSummary(){ $('sumPaint').textContent=state.paint.name; $('sumWheel').textContent=state.wheel.name; $('sumEngine').textContent=state.engine.name; $('sumAero').textContent=state.aero.name; $('sumPrice').textContent=money(buildPrice()); $('proStatus').innerHTML=state.pro?'<div class="unlocked">PRO GARAGE UNLOCKED</div>':''; }
function updateHero(){const p=presets[state.preset];$('heroName').textContent=p.name;$('heroMeta').textContent=p.meta;}
function applyPaint(){if(!model)return; const c=new THREE.Color(state.paint.hex); const rough={gloss:.16,satin:.28,matte:.55}[state.finish]; model.traverse(o=>{if(!o.isMesh||!o.material)return;const mats=Array.isArray(o.material)?o.material:[o.material];const n=((o.name||'')+' '+mats.map(m=>m?.name||'').join(' ')).toLowerCase(); if(/paint|body|panel|hood|bonnet|roof|door|fender|wing|bumper|quarter|sill/.test(n)&&!/(glass|rubber|plastic|trim|brake|tire)/.test(n)){mats.forEach(m=>{if(m.color){m.color.copy(c);m.metalness=state.paint.metallic;m.roughness=rough;m.clearcoat=.95;m.clearcoatRoughness=.06;}});}});}
function applyWheels(){if(!model)return; const scale=state.wheel.diameter/19; const names=['wheel-front-right','wheel-front-left','wheel-rear-right','wheel-rear-left']; names.forEach(n=>{const o=model.getObjectByName(n);if(o)o.scale.setScalar(scale)}); createBrakes();}
function applyTrack(){const dx=state.track*.0016;['wheel-front-right','wheel-rear-right'].forEach(n=>model?.getObjectByName(n)?.position.x=.83+dx);['wheel-front-left','wheel-rear-left'].forEach(n=>model?.getObjectByName(n)?.position.x=-.83-dx);}
function applyRide(){if(model)model.position.y=state.ride*.005+state.aero.drop*.004;}
function applyAero(){if(!model)return; aeroGroup?.removeFromParent(); aeroGroup=new THREE.Group(); const carbon=new THREE.MeshPhysicalMaterial({color:0x101317,metalness:.86,roughness:.2,clearcoat:.65}); const paint=new THREE.MeshPhysicalMaterial({color:new THREE.Color(state.paint.hex),metalness:state.paint.metallic,roughness:.17,clearcoat:.95});
  const base= new THREE.Mesh(new THREE.BoxGeometry(2.18,.055,.34),carbon);base.position.set(0,.17,2.28);aeroGroup.add(base);
  if(['sport','wide','gt'].includes(state.aero.id)){for(const x of[-1.07,1.07]){const s=new THREE.Mesh(new THREE.BoxGeometry(.055,.13,1.75),carbon);s.position.set(x,.32,0);aeroGroup.add(s)}}
  if(['wide','gt'].includes(state.aero.id)){for(const x of[-1.13,1.13]){const flare=new THREE.Mesh(new THREE.BoxGeometry(.09,.18,2.15),paint);flare.rotation.y=Math.PI/2;flare.position.set(x,.53,-.05);aeroGroup.add(flare)}}
  if(state.aero.id==='gt'){const wing=new THREE.Mesh(new THREE.BoxGeometry(1.92,.075,.18),carbon);wing.position.set(0,1.18,-2.10);aeroGroup.add(wing);for(const x of[-.58,.58]){const st=new THREE.Mesh(new THREE.BoxGeometry(.06,.34,.06),carbon);st.position.set(x,1.01,-2.10);aeroGroup.add(st)}}
  model.add(aeroGroup); applyRide();
}
function createBrakes(){if(!model)return; brakesGroup?.removeFromParent();brakesGroup=new THREE.Group();const rotorMat=new THREE.MeshStandardMaterial({color:0x6d747d,metalness:.92,roughness:.24});const caliperMat=new THREE.MeshStandardMaterial({color:0xd81d2a,metalness:.52,roughness:.25}); const specs=[[-.83,.38,1.33], [.83,.38,1.33],[-.83,.38,-1.33],[.83,.38,-1.33]]; specs.forEach(([x,y,z])=>{const d=new THREE.Mesh(new THREE.CylinderGeometry(.255,.255,.035,64),rotorMat);d.rotation.z=Math.PI/2;d.position.set(x*state.wheel.diameter/19,y,z);brakesGroup.add(d);const cal=new THREE.Mesh(new THREE.BoxGeometry(.08,.22,.24),caliperMat);cal.position.set(d.position.x,y+.01,z+.17);brakesGroup.add(cal);});model.add(brakesGroup);}
function applyLights(){model?.traverse(o=>{if(o.isMesh&&o.material?.emissive){const n=(o.name+' '+(o.material.name||'')).toLowerCase();if(/head|lamp|light/.test(n)){const col={white:0xffffff,ice:0x8cc8ff,amber:0xffa62e}[state.lights];o.material.emissive.setHex(col);o.material.emissiveIntensity=3;}}});}
function applyConfig(){applyPaint();applyWheels();applyTrack();applyRide();applyAero();applyLights();updateStats();updateSummary();}
async function loadModel(){const loading=$('loading'); const loader=new GLTFLoader(); try{const gltf=await loader.loadAsync(data.model.url); model=gltf.scene; model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(Array.isArray(o.material))o.material.forEach(m=>m.envMapIntensity=1.6);else if(o.material)o.material.envMapIntensity=1.6;}}); scene.add(model); if(gltf.animations){gltf.animations.forEach(a=>clipMap[a.name]=a);mixer=new THREE.AnimationMixer(model);} model.scale.setScalar(1.95); applyConfig(); loading.classList.add('hide'); toast('Realistic 3D car loaded'); }catch(err){console.error(err);loading.querySelector('small').textContent='The remote 3D asset could not be loaded. Deploy/open with an internet connection.';}}
function playFirst(regex,msg){if(!mixer){toast('Animation system not ready');return;}const clip=Object.entries(clipMap).find(([n])=>regex.test(n))?.[1];if(!clip){toast('This model does not expose that animation');return;}mixer.stopAllAction();mixer.clipAction(clip).reset().play();toast(msg);}
function setCamera(mode){document.querySelectorAll('#cameraTabs button').forEach(b=>b.classList.toggle('active',b.dataset.cam===mode));const poses={hero:[7.6,3.8,8.8],front:[0,2.55,10.8],rear:[0,2.55,-10.8],side:[10.8,2.7,0],top:[0,11.2,0]};camera.position.set(...poses[mode]);controls.target.set(0,.7,0);controls.update();}
function openModal(){$('modal').classList.add('show')}function closeModal(){$('modal').classList.remove('show')}
let toastTimer;function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();mixer?.update(dt);controls?.update();renderer.render(scene,camera)}
init();
