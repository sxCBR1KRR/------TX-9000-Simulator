import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import Stats from 'three/addons/libs/stats.module.js';
import GUI from 'lil-gui';
import gsap from 'gsap';


// setup i fps 

const canvas = document.querySelector('#webgl-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0b0e, 0.05);

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.xr.enabled = true;

document.body.appendChild(ARButton.createButton(renderer));

const stats = new Stats();
stats.dom.style.position = 'absolute';
stats.dom.style.right = '0px';
stats.dom.style.top = '0px';
stats.dom.style.zIndex = '100';
document.body.appendChild(stats.dom);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;


// svetlo , audio , okolina

const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.7; bloomPass.strength = 0.4;
const composer = new EffectComposer(renderer);
composer.addPass(renderPass); composer.addPass(bloomPass);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

new RGBELoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/royal_esplanade_1k.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture; scene.environmentIntensity = 1.0;
});

const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
new THREE.AudioLoader().load('/hum.mp3', (buffer) => {
  sound.setBuffer(buffer); sound.setLoop(true); sound.setVolume(0.4);
});

const gridHelper = new THREE.GridHelper(20, 40, 0x00aaff, 0x222222);
scene.add(gridHelper);

// holographic marker
const markerGeo = new THREE.TorusGeometry(0.12, 0.015, 16, 32);
const markerMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.9, depthTest: false });
const targetMarker = new THREE.Mesh(markerGeo, markerMat);
targetMarker.visible = false;
targetMarker.renderOrder = 999;
scene.add(targetMarker);

gsap.to(markerMat, { opacity: 0.3, duration: 0.8, yoyo: true, repeat: -1 });
gsap.to(targetMarker.rotation, { z: Math.PI * 2, duration: 4, repeat: -1, ease: "none" });


// materijali i teksturi

const textureLoader = new THREE.TextureLoader();
const skins = {
  "Original": null,
  "Carbon Fiber": textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/carbon/Carbon.png', (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4); }),
  "Wire Grid": textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/uv_grid_opengl.jpg')
};

const finishes = {
  'Original': { metalness: null, roughness: null },
  'Car Paint (Ultra Gloss)': { metalness: 0.6, roughness: 0.05 },
  'Chrome (Mirror)': { metalness: 1.0, roughness: 0.0 },
  'Brushed Metal': { metalness: 1.0, roughness: 0.4 },
  'Matte Plastic': { metalness: 0.0, roughness: 0.8 }
};


// otvori model

const gltfLoader = new GLTFLoader();
let myModel = null;
const originalMaterials = new Map();
let scaleMult = 1;
let isMachineRunning = false; 
let isCameraAnimating = false; 

gltfLoader.load('/Meshy_AI_Industrial_oil_pipeli_0504192740_texture.glb', (gltf) => {
  myModel = gltf.scene;
  
  const box = new THREE.Box3().setFromObject(myModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  myModel.position.sub(center);

  scaleMult = Math.max(size.x, size.y, size.z);
  gridHelper.position.y = -(size.y / 2) - 0.05;

  myModel.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.transparent = true; 
      originalMaterials.set(child, child.material.clone());
      child.userData.originalColor = child.material.color ? child.material.color.clone() : new THREE.Color(0xffffff);
    }
  });

  scene.add(myModel);
  
  document.getElementById('training-ui').style.opacity = '1';
  document.getElementById('training-ui').style.pointerEvents = 'auto';
  loadStep(0);
});


// guide cekori

const trainingSteps = [
  {
    title: "0. Pre-Flight & LOTO Verification",
    target: {x: 0, y: 0, z: 0}, cam: {x: 0, y: 0.5, z: 1.8},
    objective: "Verify system safety state before commencing startup procedures.",
    instructions: [
      "Confirm all Lock-Out/Tag-Out (LOTO) padlocks have been removed from the main breaker panel.",
      "Visually inspect the vibration-damping skid for cracks or loose mounting bolts.",
      "Verify the grounding wire is securely fastened to the chassis to prevent static discharge."
    ],
    safety: "Standard PPE (Steel-toe boots, safety glasses, hearing protection) is required. Never bypass LOTO without clearance.",
    showMarker: false, runMachine: false
  },
  {
    title: "1. Bearing Lubrication Check",
    target: {x: 0.45, y: 0.05, z: 0.1}, cam: {x: 0.8, y: 0.2, z: 0.8},
    objective: "Ensure drive components are properly lubricated to prevent seizing.",
    instructions: [
      "Locate the oil sight glass on the outboard motor bearing housing.",
      "Verify the oil level sits exactly in the middle of the bullseye indicator.",
      "Ensure oil is clear and amber. Milky oil indicates water contamination and requires a full flush."
    ],
    safety: "Use ONLY ISO VG 46 Turbine Oil. Mixing oil weights will destroy the hydrodynamic film layer.",
    showMarker: true, runMachine: false
  },
  {
    title: "2. Intake Valve Alignment",
    target: {x: -0.32, y: 0.06, z: 0}, cam: {x: -0.8, y: 0.2, z: 1.0},
    objective: "Open the suction line and establish positive intake pressure.",
    instructions: [
      "Rotate the main gate valve handwheel counter-clockwise to the 100% open position.",
      "Verify the suction pressure gauge stabilizes. Minimum required NPSH is 30 PSI.",
      "Do NOT open the discharge valve at this time."
    ],
    safety: "CRITICAL: Starting the motor with a closed intake valve will cause immediate dry-running and catastrophic seal failure.",
    showMarker: true, runMachine: false
  },
  {
    title: "3. Casing Venting (Bleeding)",
    target: {x: -0.15, y: 0.18, z: 0}, cam: {x: -0.4, y: 0.4, z: 0.8},
    objective: "Evacuate trapped atmospheric air from the volute casing.",
    instructions: [
      "Locate the brass petcock vent valve at the highest point of the pump casing.",
      "Crack the valve open a quarter-turn using a wrench.",
      "Listen for hissing air. Once a steady stream of fluid escapes, close the valve tightly."
    ],
    safety: "Trapped air causes cavitation, which acts like miniature explosions inside the pump, destroying the impeller blades.",
    showMarker: true, runMachine: false
  },
  {
    title: "4. VFD Panel Initialization",
    target: {x: 0.45, y: 0.08, z: 0}, cam: {x: 0.8, y: 0.5, z: 1.5},
    objective: "Power up the Variable Frequency Drive (VFD) controls.",
    instructions: [
      "Turn the main isolator switch on the power unit to the 'ON' position.",
      "Access the digital VFD interface and verify there are no active fault codes.",
      "Set the target operational frequency to 60Hz, allowing for a 15-second ramp-up time."
    ],
    safety: "Ensure the emergency stop (E-Stop) mushroom button is pulled OUT (disengaged) before powering the panel.",
    showMarker: true, runMachine: false
  },
  {
    title: "5. Motor Spool-Up",
    target: {x: 0.45, y: 0.08, z: 0}, cam: {x: 1.0, y: 0.3, z: 1.2},
    objective: "Engage the 3-Phase AC Induction Motor.",
    instructions: [
      "Press the green START button on the local control station.",
      "Monitor the VFD screen. The amp draw will spike initially, then settle as it reaches 3200 RPM.",
      "Listen for any metallic grinding or abnormal humming from the motor block."
    ],
    safety: "Stand strictly behind the coupling guard. If a coupling shears during startup, it becomes a high-speed projectile.",
    showMarker: true, runMachine: true 
  },
  {
    title: "6. Mechanical Seal Flush",
    target: {x: 0.2, y: 0.05, z: 0.1}, cam: {x: 0.3, y: 0.15, z: 0.8},
    objective: "Verify the mechanical seal is being cooled and flushed.",
    instructions: [
      "Inspect the small stainless steel tubing running from the discharge casing to the seal gland (Plan 11 Flush).",
      "Verify the flow meter indicates active circulation.",
      "Check for excessive fluid dripping from the seal area. (A drop every few minutes is normal, a steady stream is a failure)."
    ],
    safety: "Without cooling flush fluid, the carbon/silicon-carbide seal faces will warp and shatter within 60 seconds.",
    showMarker: true, runMachine: true
  },
  {
    title: "7. Multistage Compression Data",
    target: {x: 0.05, y: 0.05, z: 0}, cam: {x: 0, y: 0.3, z: 1.0},
    objective: "Analyze casing telemetry during active pressure generation.",
    instructions: [
      "Check the mounted IR temperature sensor. Normal operating casing temperature is 60°C to 85°C.",
      "Verify the piezoelectric vibration sensors are reading below 0.5 inches/second.",
      "Ensure the multistage casing is not leaking at any of the intermediate stage O-rings."
    ],
    safety: "The casing becomes dangerously hot. Do not touch bare metal surfaces without thermal-rated gloves.",
    showMarker: true, runMachine: true
  },
  {
    title: "8. Discharge Throttling",
    target: {x: 0.2, y: 0.1, z: 0.15}, cam: {x: 0.4, y: 0.3, z: 1.2},
    objective: "Regulate output flow to maintain the Best Efficiency Point (BEP).",
    instructions: [
      "Locate the high-pressure discharge valve on the output line.",
      "Slowly open the valve by 10% increments to introduce fluid into the main pipeline.",
      "Watch the discharge pressure gauge. Balance the valve until output pressure holds steady at 450 PSI."
    ],
    safety: "Never 'dead-head' the pump by leaving the discharge valve 100% closed while running at full RPM.",
    showMarker: true, runMachine: true
  },
  {
    title: "9. Emergency Procedures",
    target: {x: 0.3, y: -0.1, z: 0.2}, cam: {x: 0.5, y: 0.1, z: 1.0},
    objective: "Locate and understand the main system kill switch.",
    instructions: [
      "Identify the red mushroom Emergency Stop button on the lower power unit chassis.",
      "In the event of fire, massive seal blowout, or extreme vibration, strike the E-Stop immediately.",
      "This severs the 3-phase power relay instantly, bypassing the VFD ramp-down."
    ],
    safety: "Do NOT use the E-Stop for normal daily shutdowns, as the sudden torque loss causes extreme stress on the driveshaft.",
    showMarker: true, runMachine: true
  }
];


// logika za animacija za obuka

let currentStepIndex = 0;

function loadStep(index) {
  if (!myModel) return;
  const step = trainingSteps[index];
  
  document.getElementById('step-counter').innerText = `STEP ${index + 1} OF ${trainingSteps.length}`;
  document.getElementById('step-title').innerText = step.title;
  document.getElementById('step-objective').innerText = step.objective;
  document.getElementById('step-instructions').innerHTML = step.instructions.map(i => `<li>${i}</li>`).join('');
  
  const safetyContainer = document.getElementById('step-safety-container');
  if (step.safety) {
    safetyContainer.style.display = 'block';
    document.getElementById('step-safety').innerText = step.safety;
  } else {
    safetyContainer.style.display = 'none';
  }

  document.getElementById('progress-bar').style.width = `${((index + 1) / trainingSteps.length) * 100}%`;

  // problem so shake pri preminuvanje steps vo guidee
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);

  controls.enabled = false;
  isCameraAnimating = true;

  const tX = step.target.x * scaleMult, tY = step.target.y * scaleMult, tZ = step.target.z * scaleMult;
  
  gsap.to(camera.position, {
    x: step.cam.x * scaleMult, y: step.cam.y * scaleMult, z: step.cam.z * scaleMult,
    duration: 1.5, ease: 'power2.inOut'
  });

  gsap.to(controls.target, {
    x: tX, y: tY, z: tZ,
    duration: 1.5, ease: 'power2.inOut',
    onComplete: () => { 
      controls.enabled = true; 
      isCameraAnimating = false;
      controls.update(); 
    }
  });

  if (step.showMarker && isTrainingVisible) {
    targetMarker.visible = true;
    targetMarker.position.set(tX, tY, tZ);
  } else {
    targetMarker.visible = false;
  }

  isMachineRunning = step.runMachine;
  if (isMachineRunning && sound.buffer && !sound.isPlaying && !guiParams.audioMuted) {
    sound.play();
  } else if (!isMachineRunning && sound.isPlaying) {
    sound.pause();
    myModel.position.set(0,0,0);
  }
}

document.getElementById('btn-next').addEventListener('click', () => {
  if (currentStepIndex < trainingSteps.length - 1) loadStep(++currentStepIndex);
});
document.getElementById('btn-prev').addEventListener('click', () => {
  if (currentStepIndex > 0) loadStep(--currentStepIndex);
});


// ui desno za boja etc

function updateMaterialSettings() {
  if (!myModel) return;
  const selectedSkin = skins[guiParams.textureSkin];
  const selectedFinish = finishes[guiParams.materialFinish];

  myModel.traverse((child) => {
    if (child.isMesh) {
      child.material.map = (guiParams.textureSkin === "Original") ? originalMaterials.get(child).map : selectedSkin;
      
      if (guiParams.materialFinish === "Original") {
        child.material.metalness = originalMaterials.get(child).metalness;
        child.material.roughness = originalMaterials.get(child).roughness;
      } else {
        child.material.metalness = selectedFinish.metalness;
        child.material.roughness = selectedFinish.roughness;
      }

      child.material.envMapIntensity = guiParams.reflectionPower;
      child.material.wireframe = guiParams.isWireframe;
      child.material.opacity = guiParams.isXray ? 0.3 : 1.0;
      child.material.needsUpdate = true;
    }
  });
}

const colorParams = {
  paintColor: '#00aaff',
  paintAll: () => {
    if (!myModel) return;
    const targetColor = new THREE.Color(colorParams.paintColor);
    myModel.traverse((child) => {
      if (child.isMesh) gsap.to(child.material.color, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: 0.6 });
    });
  },
  resetColors: () => {
    if (!myModel) return;
    myModel.traverse((child) => {
      if (child.isMesh && child.userData.originalColor) {
        gsap.to(child.material.color, { r: child.userData.originalColor.r, g: child.userData.originalColor.g, b: child.userData.originalColor.b, duration: 0.6 });
      }
    });
  }
};

const guiParams = {
  textureSkin: "Original", materialFinish: "Original", reflectionPower: 1.0,
  isWireframe: false, isXray: false,
  ambientIntensity: 1.0, dirIntensity: 2.0, envIntensity: 1.0,
  audioMuted: true,
  startCinematic: () => {
    if (!myModel) return;
    
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    
    controls.enabled = false;
    isCameraAnimating = true;
    
    const targetZ = camera.position.z; const targetY = camera.position.y;
    gsap.to(camera.position, {
      x: targetZ, z: 0, y: targetY * 1.5, duration: 3, ease: 'power2.inOut',
      onComplete: () => {
        gsap.to(camera.position, { x: 0, z: -targetZ, y: targetY, duration: 3, ease: 'power2.inOut',
          onComplete: () => {
            gsap.to(camera.position, { x: 0, z: targetZ, y: targetY, duration: 3, ease: 'power2.inOut', onComplete: () => { 
              controls.enabled = true; 
              isCameraAnimating = false;
              controls.update();
            } });
          }
        });
      }
    });
  },
  recenterView: () => {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    
    controls.enabled = false;
    isCameraAnimating = true;
    
    gsap.to(camera.position, { x: 0, y: 0.5 * scaleMult, z: 1.5 * scaleMult, duration: 1.5, ease: 'power2.inOut' });
    gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut', onComplete: () => { 
      controls.enabled = true; 
      isCameraAnimating = false;
      controls.update(); 
    }});
  }
};

const rightGui = new GUI({ title: '⚙️ Engineer Toolkit' });

const colorFolder = rightGui.addFolder('🖌️ Color Customization');
colorFolder.addColor(colorParams, 'paintColor').name('Selected Color');
colorFolder.add(colorParams, 'paintAll').name('Apply Paint');
colorFolder.add(colorParams, 'resetColors').name('Reset Color');

const matFolder = rightGui.addFolder('✨ Surface Properties');
matFolder.add(guiParams, 'materialFinish', Object.keys(finishes)).name('Surface Finish').onChange(updateMaterialSettings);
matFolder.add(guiParams, 'reflectionPower', 0, 5).name('HDRI Reflection').onChange(updateMaterialSettings);

const viewFolder = rightGui.addFolder('🔍 Inspection Modes');
viewFolder.add(guiParams, 'isWireframe').name('Wireframe Topology').onChange(updateMaterialSettings);
viewFolder.add(guiParams, 'isXray').name('X-Ray Transparency').onChange(updateMaterialSettings);

const lightFolder = rightGui.addFolder('💡 Room Lighting');
lightFolder.add(guiParams, 'ambientIntensity', 0, 5).name('Ambient Light').onChange(v => ambientLight.intensity = v);
lightFolder.add(guiParams, 'dirIntensity', 0, 5).name('Main Spotlight').onChange(v => directionalLight.intensity = v);
lightFolder.add(guiParams, 'envIntensity', 0, 5).name('HDRI Brightness').onChange(v => scene.environmentIntensity = v);

const sysFolder = rightGui.addFolder('⚙️ System Options');
sysFolder.add(guiParams, 'textureSkin', Object.keys(skins)).name('Texture Wrap').onChange(updateMaterialSettings);
sysFolder.add(guiParams, 'audioMuted').name('Mute Audio').onChange((muted) => { 
  if (muted) sound.pause(); else if (sound.buffer && isMachineRunning) sound.play(); 
});
sysFolder.add(guiParams, 'startCinematic').name('🎬 Cinematic Fly-by');
sysFolder.add(guiParams, 'recenterView').name('🎯 Recenter View');


// ui za trening

let isTrainingVisible = true;
const trainingUI = document.getElementById('training-ui');
const toggleBtn = document.getElementById('btn-toggle-training');

if(toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    isTrainingVisible = !isTrainingVisible;
    
    if (isTrainingVisible) {
      trainingUI.style.opacity = '1';
      trainingUI.style.transform = 'translateY(0)';
      trainingUI.style.pointerEvents = 'auto';
      toggleBtn.innerText = '✖ Close Training Guide';
      
      if (trainingSteps[currentStepIndex].showMarker) {
        targetMarker.visible = true;
      }
    } else {
      trainingUI.style.opacity = '0';
      trainingUI.style.transform = 'translateY(-20px)';
      trainingUI.style.pointerEvents = 'none';
      toggleBtn.innerText = '📖 Open Training Guide';
      
      targetMarker.visible = false;
      isMachineRunning = false;
      if (sound.isPlaying) sound.pause();
      if (myModel) myModel.position.set(0, 0, 0);
    }
  });
}


// animacija

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth; sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height; camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height); composer.setSize(sizes.width, sizes.height);
});

renderer.setAnimationLoop(() => {
  stats.update();
  
  if (isCameraAnimating) {
    camera.lookAt(controls.target);
  } else if (controls.enabled) {
    controls.update();
  }

  // animacija za vibracii
  if (isMachineRunning && myModel) {
    myModel.position.x = (Math.random() - 0.5) * 0.003;
    myModel.position.y = (Math.random() - 0.5) * 0.003;
  }

  if (targetMarker.visible) {
    targetMarker.quaternion.copy(camera.quaternion);
  }

  if (renderer.xr.isPresenting) renderer.render(scene, camera);
  else composer.render();
});