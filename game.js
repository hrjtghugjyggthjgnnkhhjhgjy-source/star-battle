import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // آسمون آبی
scene.fog = new THREE.Fog(0x87CEEB, 100, 300); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50); 
dirLight.castShadow = true;
scene.add(dirLight);

// ================= 3. زمین (چمن) =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500), 
  new THREE.MeshStandardMaterial({ color: 0x2d6a2d })
);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
scene.add(ground);

// ================= 4. جاده اصلی (تمرکز اصلی ما) =================
const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
// یه جاده بزرگ و عریض که از اول تا آخر صفحه میره
const road = new THREE.Mesh(new THREE.PlaneGeometry(40, 500), roadMat);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, 0);
road.receiveShadow = true;
scene.add(road);

// خط‌کشی وسط جاده
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
for (let i = -240; i < 240; i += 20) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 10), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.02, i);
  scene.add(line);
}

// ================= 5. ماشین‌های ساده روی جاده =================
// چون جاده‌مون صافه، ماشین‌ها دیگه کج نمی‌شن
const cars = [];
function createCar(color, startX, startZ, direction) {
  const carGroup = new THREE.Group();
  
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: color }));
  body.position.y = 0.5; 
  body.castShadow = true;
  carGroup.add(body);
  
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cabin.position.set(0, 1.4, -0.5); 
  cabin.castShadow = true;
  carGroup.add(cabin);

  // تنظیم جهت ماشین
  if (direction === 'north') carGroup.rotation.y = 0; // به سمت جلو
  if (direction === 'south') carGroup.rotation.y = Math.PI; // به سمت عقب

  carGroup.position.set(startX, 0, startZ);
  scene.add(carGroup);
  cars.push({ mesh: carGroup, direction: direction, speed: 0.4 });
}

// ماشین‌های لاین راست (به سمت جلو)
createCar(0xff0000, 10, 100, 'north');
createCar(0x0000ff, 10, 0, 'north');

// ماشین‌های لاین چپ (به سمت عقب)
createCar(0xffffff, -10, -100, 'south');

// ================= 6. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 30); // شروع روی جاده
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [];
let decals = [];
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
    // ساخت سوراخ روی آسفالت یا ماشین
    const decalMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), decalMat);
    decal.position.copy(hit.point);
    decal.lookAt(hit.point.clone().add(hit.face.normal));
    scene.add(decal);
    decals.push({ mesh: decal, timeCreated: performance.now() });
  }
}

// ================= 9. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  // حرکت ماشین‌ها روی جاده
  cars.forEach(car => {
    if (car.direction === 'north') {
      car.mesh.position.z -= car.speed;
      if (car.mesh.position.z < -250) car.mesh.position.z = 250; // ریست
    } else {
      car.mesh.position.z += car.speed;
      if (car.mesh.position.z > 250) car.mesh.position.z = -250;
    }
  });

  // حرکت بازیکن
  const moveSpeed = 0.25;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
  
  let moveX = (forward.x * moveForward + right.x * moveRight) * moveSpeed;
  let moveZ = (forward.z * moveForward + right.z * moveRight) * moveSpeed;
  
  playerPos.x += moveX;
  playerPos.z += moveZ;
  
  camera.position.copy(playerPos); 
  camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');

  // شلیک
  if (isFiring) { 
    fireCooldown--; 
    if (fireCooldown <= 0) { shootBullet(); playShootSound(); fireCooldown = 10; } 
  }

  // آپدیت گلوله‌ها
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.position.add(b.userData.velocity); b.userData.life--;
    if (b.userData.life <= 0) { scene.remove(b); bullets.splice(i, 1); }
  }

  // حذف سوراخ‌ها
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
