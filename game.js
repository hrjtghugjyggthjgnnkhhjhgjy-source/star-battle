import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه (شب ترسناک) =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510); // تاریکی مطلق
scene.fog = new THREE.FogExp2(0x050510, 0.02); // مه غلیظ و تاریک

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی (ماه و چراغ قوه) =================
// نور ماه (خیلی کم)
const moonLight = new THREE.DirectionalLight(0x8899ff, 0.5); 
moonLight.position.set(100, 200, -100);
moonLight.castShadow = true;
scene.add(moonLight);

// چراغ‌قوه (نوری که همراه بازیکنه)
const flashlight = new THREE.SpotLight(0xffffff, 2, 50, Math.PI/6, 0.5, 1);
flashlight.position.set(0, 0, 0);
scene.add(flashlight);
scene.add(flashlight.target);

// ================= 3. ماه توی آسمون =================
const moonGeo = new THREE.SphereGeometry(20, 32, 32);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
moonMesh.position.set(100, 150, -300);
scene.add(moonMesh);

// ================= 4. زمین (خاکی) =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500), 
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a }) 
);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
scene.add(ground);

// ================= 5. ساخت روستای متروکه =================
const obstacles = [];
const houseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

function createHouse(x, z, w, h, d) {
  const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), houseMat);
  house.position.set(x, h/2, z); 
  house.castShadow = true; house.receiveShadow = true;
  scene.add(house);
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

// چیدن چند خونه متروکه
createHouse(-20, -30, 10, 15, 10);
createHouse(25, -40, 15, 20, 15);
createHouse(-40, 20, 12, 18, 12);
createHouse(30, 25, 10, 12, 10);

// ================= 6. دشمن‌ها (جن) =================
let enemies = [];
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }); // سفید و شبح وار
const enemyGeo = new THREE.BoxGeometry(1, 2, 1);

function spawnEnemy() {
  const enemy = new THREE.Mesh(enemyGeo, enemyMat);
  let x = (Math.random() - 0.5) * 100;
  let z = (Math.random() - 0.5) * 100;
  if (Math.abs(x) < 10 && Math.abs(z) < 10) { x += 30; z += 30; }
  enemy.position.set(x, 1, z);
  scene.add(enemy);
  enemies.push(enemy);
}

for (let i = 0; i < 4; i++) spawnEnemy();

// ================= 7. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 20); 
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
  const intersects = raycaster.intersectObjects([ground, ...obstacles.map(o => o.mesh), ...enemies], true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    
    // اگه به جن خورد
    if (enemies.includes(hit.object)) {
      scene.remove(hit.object);
      enemies.splice(enemies.indexOf(hit.object), 1);
    } 
    // اگه به دیوار خورد
    else if (hit.object.material === houseMat || hit.object === ground) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      decal.position.copy(hit.point);
      decal.lookAt(hit.point.clone().add(hit.face.normal));
      scene.add(decal);
      decals.push({ mesh: decal, timeCreated: performance.now() });
    }
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

  // حرکت جنی‌ها به سمت بازیکن
  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];
    let dir = new THREE.Vector3().subVectors(playerPos, enemy.position).normalize();
    enemy.position.add(dir.multiplyScalar(0.05)); // سرعت کم و ترسناک
    enemy.lookAt(playerPos.x, enemy.position.y, playerPos.z);
  }

  if (enemies.length < 4 && Math.random() < 0.01) spawnEnemy();

  const moveSpeed = 0.25;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
  
  let moveX = (forward.x * moveForward + right.x * moveRight) * moveSpeed;
  let moveZ = (forward.z * moveForward + right.z * moveRight) * moveSpeed;
  
  if (!checkCollision(playerPos.x + moveX, playerPos.z)) playerPos.x += moveX;
  if (!checkCollision(playerPos.x, playerPos.z + moveZ)) playerPos.z += moveZ;
  
  camera.position.copy(playerPos); 
  camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');

  // چراغ قوه همراه دوربین
  flashlight.position.copy(camera.position);
  flashlight.target.position.copy(camera.position).add(forward);
  flashlight.target.updateMatrixWorld();

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
