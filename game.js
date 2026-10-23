import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 50, 150); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50); 
dirLight.castShadow = true;
scene.add(dirLight);

// ================= 3. زمین و دیوارها (نقشه کانتر) =================
// زمین (مثل سنگ فرش)
const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMat);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
scene.add(ground);

// ساخت دیوار (برای محصور کردن نقشه و سنگر)
const obstacles = [];
const wallMat = new THREE.MeshStandardMaterial({ color: 0x886644 }); // رنگ آجری
function createWall(x, z, w, h, d) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  wall.position.set(x, h/2, z); 
  wall.castShadow = true; 
  wall.receiveShadow = true;
  scene.add(wall);
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

// دیوارهای دور (محصور کردن)
createWall(0, -50, 100, 10, 2);
createWall(0, 50, 100, 10, 2);
createWall(-50, 0, 2, 10, 100);
createWall(50, 0, 2, 10, 100);

// سنگرهای وسط
createWall(0, 0, 10, 4, 10); 
createWall(-20, -20, 15, 4, 5);
createWall(20, 20, 5, 4, 15);

// ================= 4. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 30); 
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [], decals = [];
const playerRadius = 0.5; 

// ================= 5. کنترل‌ها (جوی‌استیک و شلیک) =================
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

// ================= 6. شلیک =================
const raycaster = new THREE.Raycaster();
function shootBullet() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
  const startPos = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  b.position.copy(startPos).add(dir.multiplyScalar(1));
  b.userData = { velocity: dir.multiplyScalar(2), life: 100 };
  scene.add(b); bullets.push(b);

  raycaster.set(camera.position, dir);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    // اگه به دیوار خورد سوراخ کن
    if (hit.object.material === wallMat || hit.object === ground) {
      const decalMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), decalMat);
      decal.position.copy(hit.point);
      decal.lookAt(hit.point.clone().add(hit.face.normal));
      scene.add(decal);
      decals.push({ mesh: decal, timeCreated: performance.now() });
    }
  }
}

// ================= 7. برخورد =================
function checkCollision(newX, newZ) {
  for (let obs of obstacles) {
    if (newX + playerRadius > obs.minX && newX - playerRadius < obs.maxX &&
        newZ + playerRadius > obs.minZ && newZ - playerRadius < obs.maxZ) return true;
  }
  return false;
}

// ================= 8. حلقه بازی =================
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
