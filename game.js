import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 100, 300); 

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
dirLight.position.set(50, 100, 50); 
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// ================= 3. زمین (چمن با کد) =================
// ساخت یه بافت چمن مصنوعی با کد (بدون نیاز به عکس)
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 512;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#2d6a2d'; // رنگ پایه چمن
ctx.fillRect(0, 0, 512, 512);
// اضافه کردن هزاران نقطه ریز برای شبیه شدن به چمن
for (let i = 0; i < 20000; i++) {
  ctx.fillStyle = Math.random() > 0.5 ? '#1f4f1f' : '#3a8a3a';
  ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
}
const grassTexture = new THREE.CanvasTexture(canvas);
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(50, 50); // تکرار روی زمین

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500), 
  new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1.0 })
);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
scene.add(ground);

// ================= 4. جاده =================
const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }); 
const road = new THREE.Mesh(new THREE.PlaneGeometry(40, 500), roadMat);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, 0);
road.receiveShadow = true;
scene.add(road);

// خط‌کشی
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
for (let i = -240; i < 240; i += 20) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 10), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.02, i);
  scene.add(line);
}

// ================= 5. ماشین‌ها =================
const cars = [];
function createCar(color, startX, startZ, direction) {
  const carGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), bodyMat);
  body.position.y = 0.5; body.castShadow = true;
  carGroup.add(body);
  
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cabin.position.set(0, 1.4, -0.5); cabin.castShadow = true;
  carGroup.add(cabin);

  if (direction === 'north') carGroup.rotation.y = 0;
  if (direction === 'south') carGroup.rotation.y = Math.PI;

  carGroup.position.set(startX, 0, startZ);
  scene.add(carGroup);
  cars.push({ mesh: carGroup, direction: direction, speed: 0.3 });
}

createCar(0xff0000, 10, 100, 'north');
createCar(0x0000ff, 10, 0, 'north');
createCar(0xffffff, -10, -100, 'south');

// ================= 6. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 30); 
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [], decals = [];
const playerRadius = 0.5; 

// ================= 7. کنترل‌ها =================
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

// ================= 8. شلیک =================
const raycaster = new THREE.Raycaster();
function shootBullet() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
  const startPos = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  b.position.copy(startPos).add(dir.multiplyScalar(1));
  b.userData = { velocity: dir.multiplyScalar(2), life: 100 };
  scene.add(b); bullets.push(b);

  raycaster.set(camera.position, dir);
  const intersects = raycaster.intersectObjects([ground, road, ...cars.map(c => c.mesh)], true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    decal.position.copy(hit.point);
    decal.lookAt(hit.point.clone().add(hit.face.normal));
    scene.add(decal);
    decals.push({ mesh: decal, timeCreated: performance.now() });
  }
}

// ================= 9. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  cars.forEach(car => {
    if (car.direction === 'north') { car.mesh.position.z -= car.speed; if (car.mesh.position.z < -250) car.mesh.position.z = 250; }
    else { car.mesh.position.z += car.speed; if (car.mesh.position.z > 250) car.mesh.position.z = -250; }
  });

  const moveSpeed = 0.25;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
  playerPos.x += (forward.x * moveForward + right.x * moveRight) * moveSpeed;
  playerPos.z += (forward.z * moveForward + right.z * moveRight) * moveSpeed;
  
  camera.position.copy(playerPos); 
  camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');

  if (isFiring) { fireCooldown--; if (fireCooldown <= 0) { shootBullet(); playShootSound(); fireCooldown = 10; } }

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
