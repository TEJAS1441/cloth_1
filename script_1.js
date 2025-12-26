import * as THREE from "https://unpkg.com/three@0.155.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://unpkg.com/three@0.155.0/examples/jsm/controls/OrbitControls.js";

/* =========================================================
   GLOBAL STATE (FIX: DECLARED AT TOP LEVEL)
========================================================= */

let skeleton = null;

// studio lights that specifically illuminate the loaded model
let modelStudioLights = [];

// FIX: must be global
const bones = {};
const boneRestQuat = {};

/* =========================================================
   BASIC THREE.JS SETUP
========================================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f5f9);

const camera = new THREE.PerspectiveCamera(
   45, // slightly narrower FOV for more scene context
   window.innerWidth / window.innerHeight,
   0.1, 200 );

// start a bit further back so avatar + studio are visible on first load
camera.position.set(0, 2.0, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Attach renderer to the scene container so overlay can cover it reliably
const sceneContainer = document.getElementById("scene-container");
function resizeRendererToDisplaySize() {
  const w = sceneContainer.clientWidth;
  const h = sceneContainer.clientHeight;
  renderer.setSize(w, h);
}
resizeRendererToDisplaySize();
sceneContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.update();
// allow zooming out more and clamp vertical angle to keep eye-level perspective
controls.minDistance = 1.0;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI / 2.2;

/* =========================================================
   LIGHTING
========================================================= */

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

/* =========================================================
   STUDIO BACKDROP + BRANDING
   - Soft natural lighting from side windows
   - Warm wooden flooring
   - Neutral pastel walls
   - Indoor plants
   - Minimal, peaceful aesthetic
========================================================= */

// Calm yoga studio color palette
const PALETTE = {
  wallLeft: 0xf5f3f0,      // cream white
  wallRight: 0xf5f3f0,     // cream white
  wallBack: 0xf5f3f0,      // cream white
  floorWood: 0xd4a574,     // warm wood tone
  mat: 0xa8c5b8,           // sage green mat
  plant: 0x5a7a6a,         // muted forest green
  window: 0xe8f4f8,        // soft window light
  accent: 0xd9ccc3         // warm taupe accent
};

// ===== LIGHTING: Soft natural daylight from windows =====
// Remove old lights and add soft natural lighting
scene.children = scene.children.filter(child => !(child instanceof THREE.Light));

// Soft ambient light (simulating diffused daylight)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

// Soft directional light from upper left (window)
const windowLight = new THREE.DirectionalLight(0xffd9b3, 0.7);
windowLight.position.set(-8, 8, 4);
windowLight.castShadow = true;
windowLight.shadow.mapSize.width = 2048;
windowLight.shadow.mapSize.height = 2048;
scene.add(windowLight);

// Soft fill light from upper right (opposing window)
const fillLight = new THREE.DirectionalLight(0xb3d9ff, 0.35);
fillLight.position.set(8, 6, 3);
scene.add(fillLight);

// ===== WALLS: Neutral pastel, symmetrical =====
// Back wall (main backdrop)
const backWallGeom = new THREE.PlaneGeometry(20, 10);
const backWallMat = new THREE.MeshStandardMaterial({
  color: PALETTE.wallBack,
  roughness: 0.85,
  metalness: 0
});
const backWall = new THREE.Mesh(backWallGeom, backWallMat);
backWall.position.set(0, 4, -12);
backWall.receiveShadow = true;
scene.add(backWall);

// Left wall (cream white)
const leftWallGeom = new THREE.PlaneGeometry(2, 10);
const leftWallMat = new THREE.MeshStandardMaterial({
  color: PALETTE.wallLeft,
  roughness: 0.85
});
const leftWall = new THREE.Mesh(leftWallGeom, leftWallMat);
leftWall.position.set(-10, 4, 0);
leftWall.rotation.y = Math.PI / 2;
leftWall.receiveShadow = true;
scene.add(leftWall);

// Right wall (warm off-white)
const rightWallGeom = new THREE.PlaneGeometry(2, 10);
const rightWallMat = new THREE.MeshStandardMaterial({
  color: PALETTE.wallRight,
  roughness: 0.85
});
const rightWall = new THREE.Mesh(rightWallGeom, rightWallMat);
rightWall.position.set(10, 4, 0);
rightWall.rotation.y = -Math.PI / 2;
rightWall.receiveShadow = true;
scene.add(rightWall);

const ceilingGeom = new THREE.PlaneGeometry(24, 24);
const ceilingMat = new THREE.MeshStandardMaterial({
  color: 0xFFFFFF,   // pearl white
  roughness: 0.6,
  metalness: 0.2
});
const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 8;
ceiling.receiveShadow = true;
scene.add(ceiling);


// Ceiling panel (PVC) lights — soft, diffused rectangular panels
function createCeilingPanel(x, z, width = 6.5, height = 2.2, intensity = 1.2, tint = 0xfff7e6) {
  const geom = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: tint,
    emissiveIntensity: intensity,
    roughness: 1.0,
    metalness: 0
  });
  const panel = new THREE.Mesh(geom, mat);
  // place panels slightly below the ceiling so they read as recessed light sources
  panel.rotation.x = Math.PI / 2;
  panel.position.set(x, 7.96, z);
  panel.receiveShadow = false;
  panel.castShadow = false;
  return panel;
}
function addCeilingPanelLights() {
  const panelGroup = new THREE.Group();
  const panelPositions = [
    // back row (towards back wall)
    { x: -7.5, z: -4.5, w: 6.0, h: 2.0, inten: 0.7 },
    { x:  0.0, z: -4.5, w: 8.0, h: 2.4, inten: 0.9 },
    { x:  7.5, z: -4.5, w: 6.0, h: 2.0, inten: 0.7 },
    // center row (over avatar / mat) - existing row
    { x: -7.5, z: -1.5, w: 6.0, h: 2.0, inten: 0.85 },
    { x:  0.0, z: -1.5, w: 8.0, h: 2.4, inten: 1.0 },
    { x:  7.5, z: -1.5, w: 6.0, h: 2.0, inten: 0.85 },
    // front row (towards camera)
    { x: -7.5, z: 1.5, w: 6.0, h: 2.0, inten: 0.6 },
    { x:  0.0, z: 1.5, w: 8.0, h: 2.4, inten: 0.75 },
    { x:  7.5, z: 1.5, w: 6.0, h: 2.0, inten: 0.6 },
  ];

  const panelFills = [];

  panelPositions.forEach((p, i) => {
    const panel = createCeilingPanel(p.x, p.z, p.w, p.h, p.inten, 0xfff8ea);
    panelGroup.add(panel);

    // Add a subtle fill light under each panel to simulate diffusion
    const point = new THREE.PointLight(0xfff8e6, Math.min(p.inten * 0.25, 0.35), 10);
    // place fill slightly below the panels so it lights the scene softly
    point.position.set(p.x, 6.2, p.z);
    panelFills.push(point);
    scene.add(point);
  });

  // slightly group rotation for natural look (keeps them aligned)
  panelGroup.position.y = 0;
  scene.add(panelGroup);
  return { panelGroup, panelFills };
}

// Remove any previously added individual panelGroup / panelFills if they exist
// (safe to call on reload)
if (typeof existingPanelGroup !== 'undefined' && existingPanelGroup) {
  scene.remove(existingPanelGroup);
}
const { panelGroup: existingPanelGroupNew, panelFills: existingPanelFillsNew } = addCeilingPanelLights();

// Add a row of three long panel lights centered over the mat / avatar area
const panelGroup = new THREE.Group();
panelGroup.add(createCeilingPanel(0, -1.5, 8.0, 2.4, 1.0, 0xfff8ea));   // center
panelGroup.add(createCeilingPanel(-7.5, -1.5, 6.0, 2.0, 0.85, 0xfff8ea)); // left
panelGroup.add(createCeilingPanel(7.5, -1.5, 6.0, 2.0, 0.85, 0xfff8ea));  // right
scene.add(panelGroup);

// (Optional) subtle warm fill lights under each panel to simulate diffusion
const panelFills = [
  new THREE.PointLight(0xfff8e6, 0.25, 8),
  new THREE.PointLight(0xfff8e6, 0.20, 8),
  new THREE.PointLight(0xfff8e6, 0.20, 8)
];
panelFills[0].position.set(0, 6.2, -1.5);
panelFills[1].position.set(-7.5, 6.2, -1.5);
panelFills[2].position.set(7.5, 6.2, -1.5);
panelFills.forEach((pl) => scene.add(pl));

// ===== FLOORING: Warm wooden texture =====
function createWoodenFloorTexture() {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base wood color
  ctx.fillStyle = '#d4a574';
  ctx.fillRect(0, 0, size, size);

  // Wood grain pattern
  for (let i = 0; i < 30; i++) {
    const y = (i / 30) * size;
    const grainVariation = Math.sin(i * 0.3) * 0.1;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.03 + grainVariation})`;
    ctx.fillRect(0, y, size, 8);
  }

  // Subtle plank lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 3;
  const plankHeight = 256;
  for (let i = 1; i < size / plankHeight; i++) {
    const y = i * plankHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

const woodFloorTexture = createWoodenFloorTexture();
woodFloorTexture.wrapS = woodFloorTexture.wrapT = THREE.RepeatWrapping;
woodFloorTexture.repeat.set(2, 2);

const floorGeom = new THREE.PlaneGeometry(24, 24);
const floorMat = new THREE.MeshStandardMaterial({
  map: woodFloorTexture,
  roughness: 0.8,
  metalness: 0.05
});
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// ===== YOGA MAT: Centered under avatar =====
const matLength = 6.5;
const matWidth = 3.0;
const matGeom = new THREE.PlaneGeometry(matWidth, matLength);

function createMatTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Sage green base
  ctx.fillStyle = '#a8c5b8';
  ctx.fillRect(0, 0, size, size);

  // Subtle fabric texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  for (let i = 0; i < 100; i++) {
    const x = (i / 100) * size;
    ctx.fillRect(x, 0, 1, size);
  }

  // Soft edge border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  return new THREE.CanvasTexture(canvas);
}

const matTexture = createMatTexture();
const matMaterial = new THREE.MeshStandardMaterial({
  map: matTexture,
  roughness: 0.7,
  metalness: 0
});
const matPlane = new THREE.Mesh(matGeom, matMaterial);
matPlane.rotation.x = -Math.PI / 2;
matPlane.position.set(0, 0.01, 0.2);
matPlane.castShadow = true;
matPlane.receiveShadow = true;
scene.add(matPlane);


// ===== WINDOW GLOW PLANE (left side) =====
const windowGeom = new THREE.PlaneGeometry(2, 8);
const windowMat = new THREE.MeshBasicMaterial({
  color: PALETTE.window,
  transparent: true,
  opacity: 0.15
});
const windowGlow = new THREE.Mesh(windowGeom, windowMat);
windowGlow.position.set(-9.8, 4, -0.5);
windowGlow.rotation.y = Math.PI / 2;
scene.add(windowGlow);

// ===== NU7 BRANDING: Clean, modern text on back wall =====
function createBrandingTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // NU7 text: clean, modern sans-serif
  const cx = size / 2;
  const cy = size / 2 - 150;
  const fontSize = 480;

  ctx.font = `bold ${fontSize}px '  ', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Bold black border (stroke)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 25;
  ctx.strokeText('NU7', cx, cy);

  // White fill for clean look
  ctx.fillStyle = '#ffffff';
  ctx.fillText('NU7', cx, cy);

  // Subtitle: YOGA STUDIO (now white, larger font)
  ctx.font = `400 150px 'Segoe UI', Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('YOGA STUDIO', cx, cy + 240);

  return new THREE.CanvasTexture(canvas);
}
const brandTexture = createBrandingTexture();
const brandMat = new THREE.MeshBasicMaterial({
  map: brandTexture,
  transparent: true,
  opacity: 1.0
});
const brandPlane = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), brandMat);
brandPlane.position.set(0, 5.5, -11.9);
scene.add(brandPlane);

// ===== DUMBBELL RACKS: Both sides of studio =====
function createDumbbellRack(x, z, numTiers = 3, numPerTier = 5) {
  const group = new THREE.Group();

  // Materials
  const metalMat = new THREE.MeshStandardMaterial({ 
    color: 0x2f3438, 
    roughness: 0.35, 
    metalness: 0.8 
  });
  const woodMat = new THREE.MeshStandardMaterial({ 
    color: 0x6b4f36, 
    roughness: 0.7 
  });
  const plateMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111, 
    roughness: 0.6, 
    metalness: 0.6 
  });

  // Vertical supports (pillars)
  const supportGeom = new THREE.BoxGeometry(0.12, 2.0, 0.12);
  const supportLeft = new THREE.Mesh(supportGeom, metalMat);
  const supportRight = supportLeft.clone();
  supportLeft.position.set(-0.8, 1.0, 0);
  supportRight.position.set(0.8, 1.0, 0);
  supportLeft.castShadow = supportLeft.receiveShadow = true;
  supportRight.castShadow = supportRight.receiveShadow = true;
  group.add(supportLeft, supportRight);

  // Horizontal shelves/rails (tiers)
  const tierHeights = [0.4, 1.0, 1.6];
  tierHeights.forEach((tierY, tierIdx) => {
    const railGeom = new THREE.BoxGeometry(1.8, 0.08, 0.18);
    const rail = new THREE.Mesh(railGeom, woodMat);
    rail.position.set(0, tierY, 0);
    rail.castShadow = rail.receiveShadow = true;
    group.add(rail);

    // Rubber strip (to hold dumbbells in place)
    const stripGeom = new THREE.BoxGeometry(1.75, 0.025, 0.055);
    const strip = new THREE.Mesh(stripGeom, new THREE.MeshStandardMaterial({ 
      color: 0x222222, 
      roughness: 0.95 
    }));
    strip.position.set(0, tierY + 0.045, 0.055);
    strip.receiveShadow = true;
    group.add(strip);

    // Place dumbbells on this tier
    const dumbellSizes = [0.10, 0.12, 0.14, 0.16, 0.18];
    const spacing = 1.6 / numPerTier;
    
    for (let i = 0; i < numPerTier; i++) {
      const sizeIdx = Math.min(i, dumbellSizes.length - 1);
      const radius = dumbellSizes[sizeIdx];
      const db = createDumbbell(radius, 0.48 - tierIdx * 0.06, 0.032);
      
      const offset = (i - (numPerTier - 1) / 2) * spacing;
      db.position.set(offset, tierY + 0.08, 0.12);
      db.rotation.y = (Math.random() - 0.5) * 0.08; // slight random rotation
      group.add(db);
    }
  });

  group.position.set(x, 0, z);
  group.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return group;
}

// Helper: Create a single dumbbell
function createDumbbell(weightRadius = 0.14, handleLength = 0.5, handleRadius = 0.032) {
  const db = new THREE.Group();

  // Materials
  const metalMat = new THREE.MeshStandardMaterial({ 
    color: 0x2f3438, 
    roughness: 0.35, 
    metalness: 0.8 
  });
  const plateMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111, 
    roughness: 0.6, 
    metalness: 0.6 
  });

  // Handle (horizontal bar)
  const handleGeom = new THREE.CylinderGeometry(handleRadius, handleRadius, handleLength, 12);
  const handleMesh = new THREE.Mesh(handleGeom, metalMat);
  handleMesh.rotation.z = Math.PI / 2;
  handleMesh.castShadow = true;
  db.add(handleMesh);

  // Left weight plate
  const plateGeom = new THREE.CylinderGeometry(weightRadius, weightRadius, 0.065, 24);
  const leftPlate = new THREE.Mesh(plateGeom, plateMat);
  leftPlate.position.set(-handleLength / 2, 0, 0);
  leftPlate.rotation.z = Math.PI / 2;
  leftPlate.castShadow = true;
  db.add(leftPlate);

  // Right weight plate
  const rightPlate = leftPlate.clone();
  rightPlate.position.set(handleLength / 2, 0, 0);
  rightPlate.castShadow = true;
  db.add(rightPlate);

  return db;
}

// LEFT SIDE: Dumbbell rack from left pillar to back corner
scene.add(createDumbbellRack(-8.0, -7.5, 3, 5));

// RIGHT SIDE: Dumbbell rack from right pillar to back corner
scene.add(createDumbbellRack(8.0, -7.5, 3, 5));

function removeModelStudioLights() {
  modelStudioLights.forEach(l => {
    if (l.target) scene.remove(l.target);
    scene.remove(l);
  });
  modelStudioLights = [];
}

/**
 * Add soft studio lighting focused on the given model.
 * Creates a warm key spotlight, cool fill, and a subtle rim/back light.
 */
function addModelStudioLights(model) {
  removeModelStudioLights();

  // compute model center
  const bbox = new THREE.Box3().setFromObject(model);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());

  // KEY SPOT: warm, soft, casts gentle shadows
  const key = new THREE.SpotLight(0xfff1e6, 1.1, 18, Math.PI / 8, 0.6, 1.5);
  key.position.set(center.x + Math.max(1.2, size.x), center.y + Math.max(2.2, size.y * 1.2), center.z + Math.max(1.5, size.z));
  key.target = new THREE.Object3D();
  key.target.position.copy(center);
  scene.add(key.target);
  key.castShadow = true;
  key.shadow.bias = -0.0005;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);
  modelStudioLights.push(key);

  // FILL LIGHT: cool, low-intensity to soften shadows
  const fill = new THREE.PointLight(0xdfefff, 0.55, 14, 2.0);
  fill.position.set(center.x - Math.max(1.6, size.x), center.y + Math.max(1.0, size.y * 0.6), center.z + Math.max(0.8, size.z * 0.5));
  scene.add(fill);
  modelStudioLights.push(fill);

  // RIM LIGHT (back): subtle colored rim to separate model from background
  const rim = new THREE.DirectionalLight(0xffe6f0, 0.35);
  rim.position.set(center.x, center.y + Math.max(1.8, size.y), center.z - Math.max(3.0, size.z * 2.0));
  rim.castShadow = false;
  scene.add(rim);
  modelStudioLights.push(rim);

  // SOFT UNDER-FILL: low warm point below to simulate reflected floor light
  const under = new THREE.PointLight(0xffefdf, 0.18, 8, 2.0);
  under.position.set(center.x, Math.max(0.3, center.y * 0.1), center.z + 0.5);
  scene.add(under);
  modelStudioLights.push(under);

// place the soft highlight plane at the ceiling level (not near the model waist)
  const planeMat = new THREE.MeshStandardMaterial({
   color: 0xffffff,
    emissive: 0xfffbf2,
    emissiveIntensity: 0.12,
    roughness: 1
  });
  // make plane large enough to cover model but match ceiling orientation
  const planeW = Math.max(2.5, size.x * 1.6);
  const planeH = Math.max(1.2, size.z * 1.2);
  const lightPlane = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), planeMat);
  // align with ceiling (ceiling.rotation.x = Math.PI/2); keep plane horizontal and facing down
  lightPlane.rotation.x = -Math.PI / 2;
  // place just below the ceiling to simulate recessed area light
  const ceilingY = (typeof ceiling !== 'undefined' && ceiling.position) ? ceiling.position.y : 8.0;
  lightPlane.position.set(center.x, ceilingY - 0.06, center.z);
  lightPlane.renderOrder = 999;
  lightPlane.material.depthWrite = false;
  scene.add(lightPlane);
  modelStudioLights.push(lightPlane);
}

// ===== FLOWER POTS WITH PLANTS: Both sides for greenery =====
function createFlowerPot(x, z, height = 1.2, leafCount = 6, potColor = 0xc9a876) {
  const group = new THREE.Group();

  // Pot (ceramic) - round cylinder shape
  const potGeom = new THREE.CylinderGeometry(0.35, 0.38, 0.5, 24);
  const potMat = new THREE.MeshStandardMaterial({
    color: potColor,
    roughness: 0.75,
    metalness: 0.05
  });
  const pot = new THREE.Mesh(potGeom, potMat);
  pot.position.y = 0.25;
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  // Pot rim (slight lip)
  const rimGeom = new THREE.CylinderGeometry(0.36, 0.35, 0.05, 24);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xb8956a,
    roughness: 0.7
  });
  const rim = new THREE.Mesh(rimGeom, rimMat);
  rim.position.y = 0.5;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  // Soil surface (slight mound)
  const soilGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16);
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x6b5344,
    roughness: 0.8
  });
  const soil = new THREE.Mesh(soilGeom, soilMat);
  soil.position.y = 0.55;
  soil.receiveShadow = true;
  group.add(soil);

  // Snake plant: tall, upright, pointed leaves clustered in center
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2;
    const offsetX = Math.cos(angle) * 0.12; // slight radial offset for clustering
    const offsetZ = Math.sin(angle) * 0.12;

    // Snake plant leaf: very tall, narrow, pointed blade
    const leafGeom = new THREE.PlaneGeometry(0.12, height * 0.95);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x3d5a3d, // deep forest green
      side: THREE.DoubleSide,
      roughness: 0.65
    });
    const leaf = new THREE.Mesh(leafGeom, leafMat);
    
    // Position at soil level, standing upright with slight outward lean
    leaf.position.set(offsetX, height * 0.47 + 0.55, offsetZ);
    leaf.rotation.x = -Math.PI / 12; // slight forward tilt
    leaf.rotation.y = angle + (Math.random() - 0.5) * 0.15; // slight angle variation
    leaf.rotation.z = (Math.random() - 0.5) * 0.2; // natural twist
    leaf.castShadow = true;
    group.add(leaf);

    // Center vein (slightly lighter) running down the leaf
    const veinGeom = new THREE.PlaneGeometry(0.018, height * 0.9);
    const veinMat = new THREE.MeshStandardMaterial({
      color: 0x5a7a5a, // lighter green vein
      side: THREE.DoubleSide,
      roughness: 0.7
    });
    const vein = new THREE.Mesh(veinGeom, veinMat);
    vein.position.set(offsetX, height * 0.47 + 0.55, offsetZ + 0.002);
    vein.rotation.x = -Math.PI / 12;
    vein.rotation.y = angle + (Math.random() - 0.5) * 0.15;
    vein.rotation.z = (Math.random() - 0.5) * 0.2;
    group.add(vein);

    // Optional: pale yellow/cream stripe along edge (snake plant characteristic)
    const stripeGeom = new THREE.PlaneGeometry(0.018, height * 0.9);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xd4c896, // pale yellow stripe
      side: THREE.DoubleSide,
      roughness: 0.75
    });
    const stripe = new THREE.Mesh(stripeGeom, stripeMat);
    stripe.position.set(offsetX + 0.055, height * 0.47 + 0.55, offsetZ + 0.003);
    stripe.rotation.x = -Math.PI / 12;
    stripe.rotation.y = angle + (Math.random() - 0.5) * 0.15;
    stripe.rotation.z = (Math.random() - 0.5) * 0.2;
    group.add(stripe);
  }

  group.position.set(x, 0, z);
  group.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return group;
}

// LEFT SIDE: Flower pots near left wall (forward area)
scene.add(createFlowerPot(-7.5, 3.5, 1.3, 10, 0xc9a876));  // front left
scene.add(createFlowerPot(-7.5, 1.0, 1.0, 8, 0xb8956a));   // mid left
scene.add(createFlowerPot(-7.5, -2.5, 1.2, 9, 0xd4a574));  // back left

// RIGHT SIDE: Flower pots near right wall (forward area)
scene.add(createFlowerPot(7.5, 3.5, 1.3, 10, 0xc9a876));   // front right
scene.add(createFlowerPot(7.5, 1.0, 1.0, 8, 0xb8956a));    // mid right
scene.add(createFlowerPot(7.5, -2.5, 1.2, 9, 0xd4a574));   // back right

// ===== LARGE SIDE WINDOWS (left + right) =====
function createLargeWindow(x, z, width = 3.5, height = 7.5, side = 'left') {
  const group = new THREE.Group();

  // glass
  const glassGeom = new THREE.PlaneGeometry(width, height);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.06,
    transmission: 0.9,    // glass transmission (realistic)
    transparent: true,
    opacity: 0.65,
    clearcoat: 0.1,
    clearcoatRoughness: 0.2,
    reflectivity: 0.3
  });
  const glass = new THREE.Mesh(glassGeom, glassMat);
  glass.castShadow = false;
  glass.receiveShadow = false;
  glass.position.set(0, height / 2 + 0.5, 0);
  group.add(glass);

  // thin mullions / frame (vertical + horizontal)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.1 });
  const mullionV = new THREE.BoxGeometry(0.06, height, 0.06);
  const mullionH = new THREE.BoxGeometry(width, 0.06, 0.06);

  // outer frame edges (top/bottom/left/right)
  const leftEdge = new THREE.Mesh(mullionV, frameMat);
  leftEdge.position.set(-width / 2, height / 2 + 0.5, 0.03);
  const rightEdge = leftEdge.clone();
  rightEdge.position.set(width / 2, height / 2 + 0.5, 0.03);
  const topEdge = new THREE.Mesh(mullionH, frameMat);
  topEdge.position.set(0, height + 0.5, 0.03);
  const bottomEdge = new THREE.Mesh(mullionH, frameMat);
  bottomEdge.position.set(0, 0.5, 0.03);

  group.add(leftEdge, rightEdge, topEdge, bottomEdge);

  // optional central mullion and middle horizontal bar for realism
  const centerV = new THREE.Mesh(mullionV, frameMat);
  centerV.position.set(0, height / 2 + 0.5, 0.03);
  const midH = new THREE.Mesh(mullionH, frameMat);
  midH.position.set(0, height / 2 + 0.5, 0.03);
  group.add(centerV, midH);

  // subtle internal light shaft (soft plane with low opacity) to suggest daylight
  const shaftGeom = new THREE.PlaneGeometry(width * 0.95, height * 0.95);
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.06,
    depthWrite: false
  });
  const shaft = new THREE.Mesh(shaftGeom, shaftMat);
  shaft.position.set(0, height / 2 + 0.5, 0.02);
  group.add(shaft);

  // place the whole window at the wall
  group.position.set(x, 0, z);

  // rotate so window is flush with wall
  const rot = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  group.rotation.y = rot;

  // add a soft fill point light inside near the window
  const fillColor = 0xfff8f2;
  const fill = new THREE.PointLight(fillColor, 0.8, 20, 2.0);
  // position slightly inside the room to illuminate floor & mat
  const lightX = x + (side === 'left' ? 1.2 : -1.2);
  fill.position.set(lightX, 5.2, z - 1.2);
  scene.add(fill);

  // subtle rim highlight behind glass (emphasize daylight)
  const backGlowGeom = new THREE.PlaneGeometry(width * 1.05, height * 0.5);
  const backGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffbf7, transparent: true, opacity: 0.035 });
  const backGlow = new THREE.Mesh(backGlowGeom, backGlowMat);
  backGlow.position.set(0, height * 0.75 + 0.5, -0.1);
  backGlow.rotation.y = Math.PI; // face inward
  group.add(backGlow);

  // enable shadows on frame parts
  [leftEdge, rightEdge, topEdge, bottomEdge, centerV, midH].forEach(m => { m.castShadow = true; m.receiveShadow = true; });

  return group;
}

// add large windows on both sides (symmetrical)
scene.add(createLargeWindow(-9.8, -0.5, 3.5, 7.5, 'left'));
scene.add(createLargeWindow(9.8, -0.5, 3.5, 7.5, 'right'));
// scene.add(createLargeWindow(9.8, -0.5, 3.5, 7.5, 'right'));

// ===== SMALL ACCESSORY: 2L WATER BOTTLES (left side of avatar) =====
function createWaterBottle(x, z, height = 0.34, color = 0x4aa3ff) {
  const bottle = new THREE.Group();

  // Body (slightly tapered cylinder)
  const bodyGeom = new THREE.CylinderGeometry(0.06, 0.065, height, 32);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: color,
    transmission: 0.9,
    transparent: true,
    opacity: 0.48,
    roughness: 0.15,
    metalness: 0.02,
    clearcoat: 0.1
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = height / 2 + 0.02;
  body.castShadow = true;
  body.receiveShadow = true;
  bottle.add(body);

  // Neck
  const neckGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.08, 20);
  const neckMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.05 });
  const neck = new THREE.Mesh(neckGeom, neckMat);
  neck.position.y = height + 0.06;
  neck.castShadow = true;
  neck.receiveShadow = true;
  bottle.add(neck);

  // Cap
  const capGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.2 });
  const cap = new THREE.Mesh(capGeom, capMat);
  cap.position.y = height + 0.11;
  cap.castShadow = true;
  cap.receiveShadow = true;
  bottle.add(cap);

  // Label (canvas texture applied to a thin plane)
  const labelSize = 256;
  const canvas = document.createElement('canvas');
  canvas.width = labelSize;
  canvas.height = labelSize;
  const ctx = canvas.getContext('2d');
  // background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, labelSize, labelSize);
  // stripe
  ctx.fillStyle = '#ff8a00';
  ctx.fillRect(14, labelSize * 0.55 - 20, labelSize - 28, 72);
  // text '2L'
  ctx.font = 'bold 96px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('2L', labelSize / 2, labelSize * 0.55 + 36);
  // subtle brand text
  ctx.font = '400 32px Arial';
  ctx.fillStyle = '#444';
  ctx.fillText('NU7', labelSize / 2, labelSize * 0.8);

  const labelTex = new THREE.CanvasTexture(canvas);
  labelTex.encoding = THREE.sRGBEncoding;
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    side: THREE.DoubleSide,
    transparent: true,
    roughness: 0.6
  });
  const labelGeom = new THREE.PlaneGeometry(0.12, height * 0.45);
  const label = new THREE.Mesh(labelGeom, labelMat);
  label.position.set(0.065, height * 0.55, 0); // slightly offset on bottle side
  label.rotation.y = Math.PI / 8;
  label.castShadow = false;
  label.receiveShadow = true;
  bottle.add(label);

  // small base disc for stability
  const baseGeom = new THREE.CircleGeometry(0.07, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.01;
  base.castShadow = true;
  base.receiveShadow = true;
  bottle.add(base);

  bottle.position.set(x, 0, z);
  bottle.scale.set(1, 1, 1);

  // ensure shadow flags
  bottle.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = m.receiveShadow = true;
    }
  });

  return bottle;
}

// Add two 2L water bottles at the left side of the avatar (near the mat)
scene.add(createWaterBottle(-1.15, -1.5, 0.36, 0x4aa3ff)); // blue bottle
scene.add(createWaterBottle(-1.35, -1.5, 0.36, 0xffa500)); // orange-accent bottle


// ===== SKIRTINGS: Green granite baseboards along walls =====

function createGraniteTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // base green color
  ctx.fillStyle = '#2f6b57';
  ctx.fillRect(0, 0, size, size);

  // add subtle speckle / grain for granite look
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = Math.random() * 0.25;
    const r = 20 + Math.floor(Math.random() * 40);
    const g = 80 + Math.floor(Math.random() * 70);
    const b = 65 + Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // subtle darker veins
  for (let v = 0; v < 6; v++) {
    ctx.strokeStyle = `rgba(20,40,35,${0.05 + Math.random() * 0.05})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const startY = Math.random() * size;
    ctx.moveTo(0, startY);
    for (let x = 0; x < size; x += 20) {
      ctx.lineTo(x, startY + Math.sin((x / size) * Math.PI * (1 + Math.random())) * (10 + Math.random() * 20));
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 0.25); // stretch horizontally vs vertically for thin skirting
  return tex;
}

const graniteTex = createGraniteTexture();
const graniteMat = new THREE.MeshStandardMaterial({
  map: graniteTex,
  color: 0x2f6b57,
  roughness: 0.6,
  metalness: 0.05
});

/**
 * Add skirting as a long thin box flush to a wall.
 * orientation: 'back' | 'left' | 'right'
 */
function addSkirting(orientation, length = 24, height = 0.15, depth = 0.08, offset = 0.06) {
  const geom = new THREE.BoxGeometry(length, height, depth);
  const mesh = new THREE.Mesh(geom, graniteMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // position & rotation based on wall
  if (orientation === 'back') {
    mesh.position.set(0, height / 2, -11.92 + offset); // slightly in front of back wall
    mesh.rotation.y = 0;
  } else if (orientation === 'left') {
    mesh.geometry = new THREE.BoxGeometry(depth, height, length); // swap dims for vertical orientation
    mesh.position.set(-9.92 + offset, height / 2, 0);
    mesh.rotation.y = Math.PI / 2;
  } else if (orientation === 'right') {
    mesh.geometry = new THREE.BoxGeometry(depth, height, length);
    mesh.position.set(9.92 - offset, height / 2, 0);
    mesh.rotation.y = -Math.PI / 2;
  }

  scene.add(mesh);
  return mesh;
}

// Add skirtings to back and both side walls
addSkirting('back', 20.0, 0.15, 0.08, 0.04);
// addSkirting('left', 24.0, 0.15, 0.08, 0.04);
// addSkirting('right', 24.0, 0.15, 0.08, 0.04);


// ===== BACK-WALL CORNER WINDOWS (aligned with back wall) =====
// Create windows flush with the back wall, placed near the left/right corners.
// These match the style of the side windows but are oriented to face the camera/backdrop.
function createBackWindow(x, width = 2.8, height = 4.0) {
  const group = new THREE.Group();

  // glass (painted sky-blue tint)
  const glassGeom = new THREE.PlaneGeometry(width, height);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x87CEEB,        // sky blue
    metalness: 0.04,
    roughness: 0.08,
    transmission: 0.65,
    transparent: true,
    opacity: 0.85,
    clearcoat: 0.08,
    clearcoatRoughness: 0.25,
    reflectivity: 0.25,
    // slight emissive tint to make the sky color read clearly in diffuse lighting
    emissive: 0x87bfe8,
    emissiveIntensity: 0.06
  });
  const glass = new THREE.Mesh(glassGeom, glassMat);
  glass.castShadow = false;
  glass.receiveShadow = false;
  glass.position.set(0, height / 2 + 0.5, 0.02);
  group.add(glass);

  // frame / mullions
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.1 });
  const mullionV = new THREE.BoxGeometry(0.06, height, 0.06);
  const mullionH = new THREE.BoxGeometry(width, 0.06, 0.06);

  const leftEdge = new THREE.Mesh(mullionV, frameMat);
  leftEdge.position.set(-width / 2, height / 2 + 0.5, 0.03);
  const rightEdge = leftEdge.clone();
  rightEdge.position.set(width / 2, height / 2 + 0.5, 0.03);
  const topEdge = new THREE.Mesh(mullionH, frameMat);
  topEdge.position.set(0, height + 0.5, 0.03);
  const bottomEdge = new THREE.Mesh(mullionH, frameMat);
  bottomEdge.position.set(0, 0.5, 0.03);
  group.add(leftEdge, rightEdge, topEdge, bottomEdge);

  // middle mullions for realism
  const centerV = new THREE.Mesh(mullionV, frameMat);
  centerV.position.set(0, height / 2 + 0.5, 0.03);
  const midH = new THREE.Mesh(mullionH, frameMat);
  midH.position.set(0, height / 2 + 0.5, 0.03);
  group.add(centerV, midH);

  // subtle back-glow to blend with backdrop (soft sky tint)
  const backGlowGeom = new THREE.PlaneGeometry(width * 1.05, height * 0.45);
  const backGlowMat = new THREE.MeshBasicMaterial({ color: 0xCAE9FF, transparent: true, opacity: 0.06 });
  const backGlow = new THREE.Mesh(backGlowGeom, backGlowMat);
  backGlow.position.set(0, height * 0.75 + 0.5, -0.1);
  backGlow.rotation.y = Math.PI;
  group.add(backGlow);

  // place flush with back wall (slightly in front to avoid z-fighting)
  group.position.set(x, 0, -11.88);
  group.rotation.y = 0;

  // small soft point light behind window to suggest exterior light (cooler tone)
  const fill = new THREE.PointLight(0xe8f6ff, 0.45, 12, 2.0);
  fill.position.set(x, 5.2, -10.5);
  scene.add(fill);

  // enable shadows on frame parts
  [leftEdge, rightEdge, topEdge, bottomEdge, centerV, midH].forEach(m => { m.castShadow = true; m.receiveShadow = true; });

  return group;
}

// add two back-corner windows aligned with the backdrop (left & right)
scene.add(createBackWindow(-6.2, 2.8, 4.0)); // left-back corner window
scene.add(createBackWindow(6.2, 2.8, 4.0));  // right-back corner window


/* =========================================================
   LOAD AVATAR + BUILD SKELETON MAP
========================================================= */

const loader = new GLTFLoader();

// Loading UI elements / flags
const overlay = document.getElementById("overlay");
let modelLoaded = false;
let wsConnected = false;
// Calibration state
const calibration = {}; // imuKey -> THREE.Quaternion to apply before imuQuat
let latestSensors = null; // store most recent sensors payload for calibration/sample

// Small UI for calibration
const ui = document.createElement('div');
ui.className = 'ui';
ui.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Calibration</div><button id="cal-btn" class="btn">Calibrate Pose (C)</button><div id="cal-status" style="margin-top:8px;font-size:0.9rem;color:#334155">Not calibrated</div>`;
document.body.appendChild(ui);
const calBtn = document.getElementById('cal-btn');
const calStatus = document.getElementById('cal-status');

function setCalStatus(msg) {
  if (calStatus) calStatus.innerText = msg;
}

calBtn.onclick = () => doCalibration();
window.addEventListener('keydown', (e) => { if (e.key === 'c' || e.key === 'C') doCalibration(); });

function doCalibration() {
  if (!latestSensors) {
    setCalStatus('No IMU data yet');
    return;
  }
  // For each imu in the mapping, compute calibration = imuQuat^{-1}
  let count = 0;
  for (const imuKey in imuToBone) {
    const q = latestSensors[imuKey];
    if (!q) continue;
    const imuQuat = new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
    const inv = imuQuat.clone().invert();
    calibration[imuKey] = inv;
    count++;
  }
  setCalStatus(`Calibrated ${count} IMUs`);
  console.log('Calibration map:', calibration);
}

function hideOverlay() {
  if (!overlay) return;
  overlay.classList.add("hidden");
}

function checkReady() {
  // Hide only when both model and websocket/backend are ready
  if (modelLoaded && wsConnected) hideOverlay();
}

function frameScene(object = scene, padding = 1.2) {
  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fov = (camera.fov * Math.PI) / 180;
    // distance required to fit object height in view
    let distance = (maxSize * padding) / (2 * Math.tan(fov / 2));
    distance = Math.max(distance, 14.0); // don't go too close
    // position camera slightly above center and behind
    const verticalOffset = Math.max(size.y * 0.4, 1.2); 
    const newPos = new THREE.Vector3(center.x, center.y + verticalOffset, center.z + distance);
    camera.position.copy(newPos);
    const lookAtY = center.y + Math.max(size.y * 0.35, 0.9);
    camera.lookAt(center.x, lookAtY, center.z);
    controls.target.set(center.x, lookAtY, center.z);
    controls.update();
  }
}

loader.load(
  "/avatar/avatar_3.glb",
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    model.traverse((obj) => {
      if (obj.isSkinnedMesh && obj.skeleton && !skeleton) {
        skeleton = obj.skeleton;

        skeleton.bones.forEach((bone) => {
          bones[bone.name] = bone;
          boneRestQuat[bone.name] = bone.quaternion.clone();
        });

        console.log("Bones:", Object.keys(bones));
      }
    });

    // Frame the model + studio so avatar and surrounding studio are visible
    frameScene(model);

    // add model-focused studio lighting for better photoreal look
    addModelStudioLights(model);

    modelLoaded = true;
    if (overlay) overlay.innerText = "Model loaded — waiting for backend...";
    checkReady();

    // Fallback: if websocket doesn't connect within 6s, hide overlay anyway
    setTimeout(() => {
      if (modelLoaded && !wsConnected) {
        console.warn("Websocket not connected in time — hiding loading overlay.");
        hideOverlay();
      }
    }, 6000);
  },
  // onProgress
  (xhr) => {
    if (!overlay) return;
    if (xhr.lengthComputable) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      overlay.innerText = `Loading 3D Character... ${pct}%`;
    }
  },
  (err) => {
    console.error("Failed to load model.glb", err);
    if (overlay) overlay.innerText = "Failed to load model.";
  }
);

/* =========================================================
   IMU → BONE MAPPING (BOTTOM WEARABLE)
========================================================= */

const imuToBone = {
  IMU1: "ORG-thighL",        // Left thigh (pelvis)
  IMU2: "ORG-shinL",         // Left shin (knee)
  IMU3: "foot_ik.L",         // Left foot
  IMU4: "ORG-thighR",        // Right thigh (pelvis)
  IMU5: "ORG-shinR",         // Right shin (knee)
  IMU6: "foot_ik.R",         // Right foot
};
// const imuToBone = {
//   IMU1: "mixamorig1LeftLeg",      // Left foot
//   IMU2: "mixamorig1LeftFoot",     // Right foot
//   IMU3: "mixamorig1RightLeg",     // Left pelvis
//   IMU4: "mixamorig1RightFoot",       // Left knee (working fine, keep as is)
//   IMU5: "mixamorig1LeftUpLeg",    // Right pelvis
//   IMU6: "mixamorig1RightUpLeg",      // Right knee
// };
/*'''
Wearable Labelling 
IMU 1 : left knee 
IMU 2 : left foot 
IMU 3 : right knee
IMU 4 : right foot
IMU 5 : left pelvis
IMU 6 : right pelvis

mapping
const imuToBone = {
  IMU1: "mixamorig1LeftLeg",      // Left foot
  IMU2: "mixamorig1LeftFoot",     // Right foot
  IMU3: "mixamorig1RightLeg",     // Left pelvis
  IMU4: "mixamorig1RightFoot",       // Left knee (working fine, keep as is)
  IMU5: "mixamorig1LeftUpLeg",    // Right pelvis
  IMU6: "mixamorig1RightUpLeg",      // Right knee
};
'''*/

/* =========================================================
   WEBSOCKET (LIVE IMU STREAM)
========================================================= */

const ws = new WebSocket(`ws://${location.hostname}:8001/ws`);

ws.onopen = () => {
  console.log("Avatar WebSocket connected");
//   ws.onmessage = (evt) => {
//   console.log("WS RECEIVED:", evt.data);
// };
  wsConnected = true;
  if (overlay) overlay.innerText = "Backend connected — finalizing...";
  checkReady();
};

ws.onmessage = (event) => {
  if (!skeleton) return;
  console.log("WS RECEIVED:", event.data);

  const data = JSON.parse(event.data);
  const sensors = data.sensors;
  // store latest sensors for calibration sampling
  latestSensors = sensors;

  for (const imuKey in imuToBone) {
    const boneName = imuToBone[imuKey];
    const bone = bones[boneName];
    const q = sensors[imuKey];

    if (!bone || !q) continue;

    const imuQuat = new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();

    // apply calibration if available: bone = rest * calibration * imuQuat
    const cal = calibration[imuKey];
    if (cal) {
      bone.quaternion.copy(boneRestQuat[boneName]).multiply(cal).multiply(imuQuat);
    } else {
      bone.quaternion.copy(boneRestQuat[boneName]).multiply(imuQuat);
    }
  }
};

/* =========================================================
   RENDER LOOP
========================================================= */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  // Ensure branding plane faces the camera
  try {
    if (brandPlane) brandPlane.lookAt(camera.position);
    // subtle parallax on mat and wall for depth (optional)
    if (matPlane) matPlane.position.z = 0.2 + Math.sin(Date.now() * 0.0005) * 0.002;
  } catch (e) {
    // ignore if brandPlane / matPlane not defined yet
  }

  renderer.render(scene, camera);
}

animate();

/* =========================================================
   RESIZE HANDLING
========================================================= */

window.addEventListener("resize", () => {
  camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
  camera.updateProjectionMatrix();
  resizeRendererToDisplaySize();
});
