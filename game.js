import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 150, 400); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
// تنظیم رزولوشن برای کیفیت بهتر
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // سایه‌های نرم
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(100, 200, 50); 
dirLight.castShadow = true;
// تنظیمات سایه باکیفیت
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
scene.add(dirLight);

// ================= 3. زمین و جاده =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000), 
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a }) // خاکستری تیره
);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
ground.userData.isGround = true;
scene.add(ground);

// ساخت جاده با کیفیت
function createRoad(x, z, w, d, isHorizontal) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0.01, z);
  road.receiveShadow = true;
  scene.add(road);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  if (isHorizontal) {
    for (let i = x - w/2 + 20; i < x + w/2; i += 40) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.5), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i, 0.02, z);
      scene.add(line);
    }
  } else {
    for (let i = z - d/2 + 20; i < z + d/2; i += 40) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 20), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, i);
      scene.add(line);
    }
  }
}

// خیابان‌های اصلی
createRoad(0, 0, 1000, 40, true);   
createRoad(0, 200, 1000, 40, true); 
createRoad(0, -200, 1000, 40, true); 
createRoad(0, 0, 40, 1000, false);   
createRoad(200, 0, 40, 1000, false); 
createRoad(-200, 0, 40, 1000, false); 

// ================= 4. ساختمون‌ها =================
const obstacles = [];
const buildingsGroup = new THREE.Group();
scene.add(buildingsGroup);

// تکسچر پنجره‌ها
const canvas = document.createElement('canvas');
canvas.width = 256; canvas.height = 256;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 256, 256); 
ctx.fillStyle = '#222'; 
for (let y = 10; y < 256; y += 30) {
  for (let x = 10; x < 256; x += 30) ctx.fillRect(x, y, 20, 20);
}
const windowTexture = new THREE.CanvasTexture(canvas);
windowTexture.wrapS = THREE.RepeatWrapping;
windowTexture.wrapT = THREE.RepeatWrapping;

function createBuilding(x, z, w, h, d) {
  windowTexture.repeat.set(w/10, h/10); 
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), 
    new THREE.MeshStandardMaterial({ map: windowTexture, roughness: 0.8 })
  );
  b.position.set(x, h/2, z); 
  b.castShadow = true; 
  b.receiveShadow = true;
  buildingsGroup.add(b);
  
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

// چیدمان برج‌ها
createBuilding(60, 60, 30, 100, 30);
createBuilding(100, 100, 40, 150, 40);
createBuilding(-60, 60, 30, 120, 30);
createBuilding(-100, 100, 40, 80, 40);
createBuilding(60, -60, 30, 90, 30);
createBuilding(100, -100, 40, 140, 40);
createBuilding(-60, -60, 30, 110, 30);
createBuilding(-100, -100, 40, 160, 40);

// ================= 5. ماشین‌ها (درست شده) =================
const cars = [];
function createCar(color, speed, startX, startZ, direction) {
  const carGroup = new THREE.Group();
  
  // بدنه ماشین
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: color }));
  body.position.y = 0.5; 
  body.castShadow = true;
  carGroup.add(body);
  
  // کابین
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cabin.position.set(0, 1.4, -0.5); 
  cabin.castShadow = true;
  carGroup.add(cabin);

  // تنظیم جهت ماشین بر اساس مسیر (دیگه کج نمی‌ره)
  if (direction === 'x') {
    carGroup.rotation.y = speed > 0 ? Math.PI / 2 : -Math.PI / 2; 
  } else if (direction === 'z') {
    carGroup.rotation.y = speed > 0 ? 0 : Math.PI;
  }

  carGroup.position.set(startX, 0, startZ);
  scene.add(carGroup);
  cars.push({ mesh: carGroup, speed: speed, axis: direction });
}

// ماشین‌های محور X (افقی)
createCar(0xff0000, 0.4, -300, 10, 'x');
createCar(0x0000ff, -0.3, 300, -10, 'x');
createCar(0xffff00, 0.5, -100, 10, 'x');

// ماشین‌های محور Z (عمودی)
createCar(0xffffff, 0.3, 10, -300, 'z');
createCar(0x00ff00, -0.4, -10, 300, 'z');

// ================= 6. ابرها =================
const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
for (let i = 0; i < 15; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 10, 8, 8), cloudMat);
  c.position.set((Math.random() - 0.5) * 500, 120 + Math.random() * 50, (Math.random() - 0.5) * 500);
  scene.add(c); clouds.push(c);
}

// ================= 7. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 15); 
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [];
let decals = [];
const playerRadius = 0.5; 

// ================= 8. جوی‌استیک =================
const joyZone = document.getElementById('joystick-zone');
const joyKnob = document.getElementById('joystick-knob');
let joyActive = false, joyCenterX = 0, joyCenterY = 0, joyMaxDist = 40;

joyZone.addEventListener('touchstart', (e) => {
  e.preventDefault(); initAudio(); joyActive = true;
  const rect = joyZone.getBoundingClientRect();
  joyCenterX = rect.left + rect.width / 2; joyCenterY = rect.top + rect.height / 2;
}, {passive: false});

document.addEventListener('touchmove', (e) => {
  if (joyActive) {
    e.preventDefault();
    let dx = e.touches[0].clientX - joyCenterX, dy = e.touches[0].clientY - joyCenterY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > joyMaxDist) { dx = (dx / dist) * joyMaxDist; dy = (dy / dist) * joyMaxDist; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveRight = dx / joyMaxDist; moveForward = -dy / joyMaxDist;
  } else if (e.target.tagName !== 'BUTTON') {
    let dx = e.touches[0].clientX - lastTouchX, dy = e.touches[0].clientY - lastTouchY;
    playerYaw -= dx * 0.005; playerPitch -= dy * 0.005;
    playerPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, playerPitch));
    lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
  }
}, {passive: false});

let lastTouchX = 0, lastTouchY = 0;
document.addEventListener('touchstart', (e) => {
  if (e.target.tagName !== 'BUTTON' && !joyActive) { lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
});

document.addEventListener('touchend', (e) => {
  if (joyActive) { joyActive = false; joyKnob.style.transform = 'translate(0px, 0px)'; moveForward = 0; moveRight = 0; }
});

// ================= 9. شلیک =================
document.getElementById('btn-fire').addEventListener('touchstart', (e) => { e.preventDefault(); isFiring = true; }, {passive: false});
document.getElementById('btn-fire').addEventListener('touchend', (e) => { e.preventDefault(); isFiring = false; }, {passive: false});

const raycaster = new THREE.Raycaster();
function shootBullet() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
  const startPos = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  b.position.copy(startPos).add(dir.multiplyScalar(1));
  b.userData = { velocity: dir.multiplyScalar(2), life: 100 };
  scene.add(b); bullets.push(b);

  raycaster.set(camera.position, dir);
  const intersects = raycaster.intersectObjects([buildingsGroup, ground], true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const decalMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), decalMat);
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
  for (let car of cars) {
    const cw = 1.5, cl = 2.5; 
    const cx = car.mesh.position.x, cz = car.mesh.position.z;
    const w = car.axis === 'z' ? cl : cw;
    const l = car.axis === 'z' ? cw : cl;
    if (newX + playerRadius > cx - w && newX - playerRadius < cx + w &&
        newZ + playerRadius > cz - l && newZ - playerRadius < cz + l) return true; 
  }
  return false;
}

// ================= 11. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  clouds.forEach(c => { c.position.x += 0.1; if (c.position.x > 300) c.position.x = -300; });

  cars.forEach(car => {
    if (car.axis === 'x') {
      car.mesh.position.x += car.speed;
      if (car.speed > 0 && car.mesh.position.x > 300) car.mesh.position.x = -300;
      if (car.speed < 0 && car.mesh.position.x < -300) car.mesh.position.x = 300;
    } else {
      car.mesh.position.z += car.speed;
      if (car.speed > 0 && car.mesh.position.z > 300) car.mesh.position.z = -300;
      if (car.speed < 0 && car.mesh.position.z < -300) car.mesh.position.z = 300;
    }
  });

  const moveSpeed = 0.25;
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
      scene.remove(decals[i].mesh);
      decals.splice(i, 1);
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
