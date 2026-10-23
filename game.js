import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 200, 800); // مه دور برای دیدن شهر بزرگ

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(100, 200, 100); 
dirLight.castShadow = true;
scene.add(dirLight);

// ================= 3. زمین =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000), 
  new THREE.MeshStandardMaterial({ color: 0x222222 }) // زمین خاکستری
);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
scene.add(ground);

// ================= 4. ساخت شهر (شبکه خیابان‌ها) =================
const obstacles = [];
const buildingMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });

function createBuilding(x, z, w, h, d) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);
  b.position.set(x, h/2, z); 
  b.castShadow = true; b.receiveShadow = true;
  scene.add(b);
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

// ساخت بلوک‌های شهری (چیدمان شطرنجی مثل نیویورک)
const blockSize = 20;
const roadWidth = 10;
for (let x = -200; x <= 200; x += blockSize + roadWidth) {
  for (let z = -200; z <= 200; z += blockSize + roadWidth) {
    // فقط جاهایی که جاده نیست ساختمون بساز
    const bWidth = 15 + Math.random() * 10;
    const bHeight = 20 + Math.random() * 60;
    const bDepth = 15 + Math.random() * 10;
    createBuilding(x + blockSize/2, z + blockSize/2, bWidth, bHeight, bDepth);
  }
}

// ================= 5. ساخت جاده‌ها =================
const roadMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

// جاده‌های افقی
for (let z = -200; z <= 200; z += blockSize + roadWidth) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(500, roadWidth), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, z);
  road.receiveShadow = true;
  scene.add(road);
  
  // خط‌کشی
  for (let x = -240; x < 240; x += 20) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.5), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.02, z);
    scene.add(line);
  }
}

// جاده‌های عمودی
for (let x = -200; x <= 200; x += blockSize + roadWidth) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 500), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0.01, 0);
  road.receiveShadow = true;
  scene.add(road);
}

// ================= 6. مینی‌مپ (نقشه کوچیک) =================
const mapCanvas = document.createElement('canvas');
mapCanvas.width = 150; mapCanvas.height = 150;
const mapCtx = mapCanvas.getContext('2d');
const mapElement = document.createElement('img');
mapElement.src = mapCanvas.toDataURL();
mapElement.style.position = 'absolute';
mapElement.style.top = '10px';
mapElement.style.right = '10px';
mapElement.style.width = '150px';
mapElement.style.height = '150px';
mapElement.style.borderRadius = '50%';
mapElement.style.border = '3px solid rgba(255,255,255,0.5)';
mapElement.style.zIndex = '100';
document.body.appendChild(mapElement);

// ================= 7. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 30); 
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [], decals = [];
const playerRadius = 0.5; 

// ================= 8. کنترل‌ها =================
const joyZone = document.getElementById('joystick-zone');
const joyKnob = document.getElementById('joystick-knob');
const btnFire = document.getElementById('btn-fire');

let joyTouchId = null, cameraTouchId = null;
let lastTouchX = 0, lastTouchY = 0;
let joyCenterX = 0, joyCenterY = 0, joyMaxDist = 40;

function updateJoyCenter() {
  const rect = joyZone.getBoundingClientRect();
  joyCenterX = rect.left + rect.width / 2; joyCenterY = rect.top + rect.height / 2;
}

document.addEventListener('touchstart', (e) => {
  e.preventDefault(); initAudio();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.target === joyZone || touch.target === joyKnob) { joyTouchId = touch.identifier; updateJoyCenter(); } 
    else if (touch.target === btnFire) { isFiring = true; } 
    else if (cameraTouchId === null) { cameraTouchId = touch.identifier; lastTouchX = touch.clientX; lastTouchY = touch.clientY; }
  }
}, {passive: false});

document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joyTouchId) {
      let dx = touch.clientX - joyCenterX, dy = touch.clientY - joyCenterY;
      let dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > joyMaxDist) { dx = (dx / dist) * joyMaxDist; dy = (dy / dist) * joyMaxDist; }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      moveRight = dx / joyMaxDist; moveForward = -dy / joyMaxDist;
    }
    if (touch.identifier === cameraTouchId) {
      let dx = touch.clientX - lastTouchX, dy = touch.clientY - lastTouchY;
      playerYaw -= dx * 0.005; playerPitch -= dy * 0.005;
      playerPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, playerPitch));
      lastTouchX = touch.clientX; lastTouchY = touch.clientY;
    }
  }
}, {passive: false});

document.addEventListener('touchend', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joyTouchId) {
      joyTouchId = null; joyKnob.style.transform = 'translate(0px, 0px)'; moveForward = 0; moveRight = 0;
    }
    if (touch.target === btnFire) isFiring = false;
    if (touch.identifier === cameraTouchId) cameraTouchId = null;
  }
}, {passive: false});

// ================= 9. شلیک =================
const raycaster = new THREE.Raycaster();
function shootBullet() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
  const startPos = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  b.position.copy(startPos).add(dir.multiplyScalar(1));
  b.userData = { velocity: dir.multiplyScalar(2), life: 100 };
  scene.add(b); bullets.push(b);

  raycaster.set(camera.position, dir);
  const intersects = raycaster.intersectObjects([ground, ...obstacles.map(o => o.mesh)], true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    decal.position.copy(hit.point);
    decal.lookAt(hit.point.clone().add(hit.face.normal));
    scene.add(decal);
    decals.push({ mesh: decal, timeCreated: performance.now() });
  }
}

// ================= 10. برخورد =================
function checkCollision(newX, newZ) {
  for (let obs of obstacles) {
    if (newX + playerRadius > obs.minX && newX - playerRadius < obs.maxX &&
        newZ + playerRadius > obs.minZ && newZ - playerRadius < obs.maxZ) return true;
  }
  return false;
}

// ================= 11. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  const moveSpeed = 0.3;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
  
  let moveX = (forward.x * moveForward + right.x * moveRight) * moveSpeed;
  let moveZ = (forward.z * moveForward + right.z * moveRight) * moveSpeed;
  
  if (!checkCollision(playerPos.x + moveX, playerPos.z)) playerPos.x += moveX;
  if (!checkCollision(playerPos.x, playerPos.z + moveZ)) playerPos.z += moveZ;
  
  camera.position.copy(playerPos); 
  camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');

  if (isFiring) { 
    fireCooldown--; 
    if (fireCooldown <= 0) { shootBullet(); playShootSound(); fireCooldown = 10; } 
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.position.add(b.userData.velocity); b.userData.life--;
    if (b.userData.life <= 0) { scene.remove(b); bullets.splice(i, 1); }
  }

  const currentTime = performance.now();
  for (let i = decals.length - 1; i >= 0; i--) {
    if (currentTime - decals[i].timeCreated > 40000) { scene.remove(decals[i].mesh); decals.splice(i, 1); }
  }
  
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; 
  camera.updateProjectionMatrix(); 
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
