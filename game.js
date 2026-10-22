import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 100, 400); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی (با کیفیت) =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5)); // نور محیطی
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50); 
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
scene.add(dirLight);

// ================= 3. زمین =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500), 
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
scene.add(ground);

// ================= 4. جاده =================
const roadMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(20, 500), roadMat);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, 0);
road.receiveShadow = true;
scene.add(road);

// خط‌کشی جاده
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
for (let i = -240; i < 240; i += 30) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 15), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.02, i);
  scene.add(line);
}

// ================= 5. ساخت ساختمون‌ها (مکعب‌های باکیفیت) =================
const obstacles = [];
const buildingsGroup = new THREE.Group();
scene.add(buildingsGroup);

// ساخت تکسچر پنجره‌ها
const canvas = document.createElement('canvas');
canvas.width = 256; canvas.height = 256;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#888888'; ctx.fillRect(0, 0, 256, 256); 
ctx.fillStyle = '#222222'; 
for (let y = 10; y < 256; y += 40) {
  for (let x = 10; x < 256; x += 40) {
    ctx.fillRect(x, y, 25, 25); // پنجره‌ها
  }
}
const windowTexture = new THREE.CanvasTexture(canvas);
windowTexture.wrapS = THREE.RepeatWrapping;
windowTexture.wrapT = THREE.RepeatWrapping;

function createBuilding(x, z, w, h, d) {
  windowTexture.repeat.set(w/10, h/10); 
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), 
    new THREE.MeshStandardMaterial({ map: windowTexture, roughness: 0.7 })
  );
  b.position.set(x, h/2, z); 
  b.castShadow = true; 
  b.receiveShadow = true;
  buildingsGroup.add(b);
  
  // ثبت برخورد
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

// چیدن ساختمون‌ها دور جاده (فاصله‌دار و با ابعاد منطقی)
createBuilding(-30, -50, 20, 40, 20);
createBuilding(-30, -100, 25, 60, 25);
createBuilding(-30, -150, 20, 50, 20);

createBuilding(30, -50, 20, 45, 20);
createBuilding(30, -100, 25, 70, 25);
createBuilding(30, -150, 20, 55, 20);

// ================= 6. فرودگاه =================
// باند فرودگاه (انتهای جاده)
const runway = new THREE.Mesh(new THREE.PlaneGeometry(40, 100), new THREE.MeshStandardMaterial({ color: 0x222222 }));
runway.rotation.x = -Math.PI / 2;
runway.position.set(0, 0.03, -200);
runway.receiveShadow = true;
scene.add(runway);

// خط‌کشی باند فرود
for(let i = -240; i < -160; i += 15) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(2, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.04, i);
  scene.add(line);
}

// برج مراقبت (فرودگاه)
const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 30, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
towerBase.position.set(-25, 15, -200);
towerBase.castShadow = true; scene.add(towerBase);

const towerTop = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 5, 8), new THREE.MeshStandardMaterial({ color: 0x111111, transparent: true, opacity: 0.8 }));
towerTop.position.set(-25, 32, -200);
towerTop.castShadow = true; scene.add(towerTop);

// ================= 7. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, -180); // شروع در فرودگاه
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [];
let decals = [];
const playerRadius = 0.5; 

// ================= 8. کنترل‌ها (جوی‌استیک و شلیک) =================
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
    if (touch.target === joyZone || touch.target === joyKnob) {
      joyTouchId = touch.identifier; updateJoyCenter();
    } else if (touch.target === btnFire) {
      isFiring = true;
    } else {
      if (cameraTouchId === null) {
        cameraTouchId = touch.identifier; lastTouchX = touch.clientX; lastTouchY = touch.clientY;
      }
    }
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
  const intersects = raycaster.intersectObjects([buildingsGroup, towerBase, towerTop], true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: false }));
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

  const moveSpeed = 0.2;
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
    if (currentTime - decals[i].timeCreated > 40000) {
      scene.remove(decals[i].mesh); decals.splice(i, 1);
    }
  }
  
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; 
  camera.updateProjectionMatrix(); 
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
