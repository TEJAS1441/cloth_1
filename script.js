import * as THREE from "https://unpkg.com/three@0.155.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://unpkg.com/three@0.155.0/examples/jsm/controls/OrbitControls.js";

/* =========================================================
   GLOBAL STATE (FIX: DECLARED AT TOP LEVEL)
========================================================= */

let skeleton = null;

// FIX: must be global
const bones = {};
const boneRestQuat = {};

/* =========================================================
   BASIC THREE.JS SETUP
========================================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f5f9);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.6, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.update();

/* =========================================================
   LIGHTING
========================================================= */

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

/* =========================================================
   LOAD AVATAR + BUILD SKELETON MAP
========================================================= */

const loader = new GLTFLoader();
loader.load(
  "/avatar/avatar.glb",
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
  },
  undefined,
  (err) => {
    console.error("Failed to load model.glb", err);
  }
);

/* =========================================================
   IMU → BONE MAPPING (BOTTOM WEARABLE)
========================================================= */

const imuToBone = {
  IMU1: "mixamorig1LeftFoot",
  IMU2: "mixamorig1RightFoot",
  IMU3: "mixamorig1LeftUpLeg",
  IMU4: "mixamorig1LeftLeg",
  IMU5: "mixamorig1RightUpLeg",
  IMU6: "mixamorig1RightLeg",
};

/* =========================================================
   WEBSOCKET (LIVE IMU STREAM)
========================================================= */

const ws = new WebSocket(`ws://${location.hostname}:8001/ws`);

ws.onopen = () => {
  console.log("Avatar WebSocket connected");
};

ws.onmessage = (event) => {
  if (!skeleton) return;

  const data = JSON.parse(event.data);
  const sensors = data.sensors;

  for (const imuKey in imuToBone) {
    const boneName = imuToBone[imuKey];
    const bone = bones[boneName];
    const q = sensors[imuKey];

    if (!bone || !q) continue;

    const imuQuat = new THREE.Quaternion(
      q.x,
      q.y,
      q.z,
      q.w
    ).normalize();

    bone.quaternion
      .copy(boneRestQuat[boneName])
      .multiply(imuQuat);
  }
};

/* =========================================================
   RENDER LOOP
========================================================= */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

/* =========================================================
   RESIZE HANDLING
========================================================= */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
