import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(100, 100, 50); 
dirLight.castShadow = true;
scene.add(dirLight);

// ================= 3. زمین و جاده =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500), 
  new THREE.MeshStandardMaterial({ color: 0x2d6a2d })
);
ground.rotation.x = -Math.PI / 2; 
ground.userData.isGround = true;
scene.add(ground);

const roadMain = new THREE.Mesh(new THREE.PlaneGeometry(500, 20), new THREE.MeshStandardMaterial({ color: 0x333333 }));
roadMain.rotation.x = -Math.PI / 2;
roadMain.position.y = 0.05;
roadMain.userData.isGround = true;
scene.add(roadMain);

const roadSub = new THREE.Mesh(new THREE.PlaneGeometry(20, 500), new THREE.MeshStandardMaterial({ color: 0x333333 }));
roadSub.rotation.x = -Math.PI / 2;
roadSub.position.y = 0.06;
roadSub.userData.isGround = true;
scene.add(roadSub);

// خط‌کشی‌ها
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
for (let i = -200; i < 200; i += 20) {
  const lineH = new THREE.Mesh(new THREE.PlaneGeometry(10, 1), lineMat);
  lineH.rotation.x = -Math.PI / 2;
  lineH.position.set(i, 0.07, 0);
  scene.add(lineH);
}
for (let i = -200; i < 200; i += 20) {
  const lineV = new THREE.Mesh(new THREE.PlaneGeometry(1, 10), lineMat);
  lineV.rotation.x = -Math.PI / 2;
  lineV.position.set(0, 0.07, i);
  scene.add(lineV);
}

// ================= 4. ساخت ساختمون‌ها =================
const obstacles = [];
const buildingsGroup = new THREE.Group();
scene.add(buildingsGroup);

const canvas = document.createElement('canvas');
canvas.width = 128; canvas.height = 128;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#b0b0b0'; ctx.fillRect(0, 0, 128, 128); 
ctx.fillStyle = '#222'; 
for (let y = 10; y < 128; y += 30) {
  for (let x = 10; x < 128; x += 30) ctx.fillRect(x, y, 20, 20);
}
const windowTexture = new THREE.CanvasTexture(canvas);
windowTexture.wrapS = THREE.RepeatWrapping;
windowTexture.wrapT = THREE.RepeatWrapping;

function createBuilding(x, z, w, h, d, color) {
  windowTexture.repeat.set(w/5, h/5);
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), 
    new THREE.MeshStandardMaterial({ map: windowTexture, color: color, roughness: 0.8 })
  );
  b.position.set(x, h/2, z); 
  b.castShadow = true; b.receiveShadow = true;
  buildingsGroup.add(b);
  
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

const colors = [0xffcccc, 0xccffcc, 0xccccff, 0xffffcc, 0xffccff];
createBuilding(40, -40, 30, 40, 30, colors[0]);
createBuilding(80, -40, 25, 30, 25, colors[1]);
createBuilding(40, -80, 20, 50, 20, colors[2]);
createBuilding(-40, -40, 30, 45, 30, colors[3]);
createBuilding(-80, -40, 25, 35, 25, colors[4]);
createBuilding(-40, -80, 20, 60, 20, colors[0]);
createBuilding(40, 40, 30, 25, 30, colors[1]);
createBuilding(80, 40, 25, 40, 25, colors[2]);
createBuilding(40, 80, 20, 20, 20, colors[3]);
createBuilding(-40, 40, 30, 35, 30, colors[4]);
createBuilding(-80, 40, 25, 25, 25, colors[0]);
createBuilding(-40, 80, 20, 45, 20, colors[1]);

// ================= 5. ابرها =================
const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
for (let i = 0; i < 10; i++) {
  const c = new THREE.Group();
  for (let j = 0; j < 4; j++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 4, 7, 7), cloudMat);
    s.position.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 5);
    c.add(s);
  }
  c.position.set((Math.random() - 0.5) * 200, 40 + Math.random() * 20, (Math.random() - 0.5) * 200);
  scene.add(c); clouds.push(c);
}

// ================= 6. سیستم ماشین‌ها =================
const cars = [];

// تابع ساخت یک ماشین سه‌بعدی
function createCar(color, axis, speed, startPos) {
  const carGroup = new THREE.Group();
  
  // بدنه
  const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), bodyMat);
  body.position.y = 0.5; body.castShadow = true;
  carGroup.add(body);
  
  // کابین (سقف)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cabin.position.set(0, 1.4, -0.2);
  carGroup.add(cabin);
  
  // چرخ‌ها
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wheels = [[-1, 0.4, 1.2], [1, 0.4, 1.2], [-1, 0.4, -1.2], [1, 0.4, -1.2]];
  wheels.forEach(pos => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(pos[0], pos[1], pos[2]);
    carGroup.add(w);
  });

  // تنظیم جهت ماشین بر اساس محور حرکت
  if (axis === 'z') carGroup.rotation.y = Math.PI / 2;
  
  carGroup.position.copy(startPos);
  scene.add(carGroup);
  
  // ذخیره اطلاعات ماشین
  cars.push({ mesh: carGroup, axis: axis, speed: speed });
}

// ساخت چند ماشین روی جاده افقی (حرکت در محور X)
createCar(0xff0000, 'x', 0.2, new THREE.Vector3(-150, 0, 5));   // قرمز
createCar(0x0000ff, 'x', -0.15, new THREE.Vector3(150, 0, -5)); // آبی
createCar(0xffff00, 'x', 0.25, new THREE.Vector3(-50, 0, 5));   // زرد

// ساخت چند ماشین روی جاده عمودی (حرکت در محور Z)
createCar(0xffffff, 'z', 0.18, new THREE.Vector3(5, 0, -150));  // سفید
createCar(0x00ff00, 'z', -0.22, new THREE.Vector3(-5, 0, 150)); // سبز

// ================= 7. متغیرهای بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 15); 
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [];
let decals = [];
const playerRadius = 0.5; 

// ================= 8. کنترل‌ها =================
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

// ================= 10. برخورد (ساختمون‌ها + ماشین‌ها) =================
function checkCollision(newX, newZ) {
  // 1. بررسی برخورد با ساختمون‌ها
  for (let obs of obstacles) {
    if (newX + playerRadius > obs.minX && newX - playerRadius < obs.maxX &&
        newZ + playerRadius > obs.minZ && newZ - playerRadius < obs.maxZ) return true;
  }
  
  // 2. بررسی برخورد با ماشین‌ها
  for (let car of cars) {
    // ماشین‌ها به شکل یک مستطیل 2x4 در نظر گرفته میشن (با کمی حاشیه امنیت)
    const cw = 1.5, cl = 2.5; 
    const cx = car.mesh.position.x, cz = car.mesh.position.z;
    // چون ماشین‌های محور Z چرخیده‌ان، ابعادشون برعکس میشه
    const w = car.axis === 'z' ? cl : cw;
    const l = car.axis === 'z' ? cw : cl;

    if (newX + playerRadius > cx - w && newX - playerRadius < cx + w &&
        newZ + playerRadius > cz - l && newZ - playerRadius < cz + l) {
      return true; 
    }
  }
  return false;
}

// ================= 11. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  // حرکت ابرها
  clouds.forEach(c => { c.position.x += 0.1; if (c.position.x > 250) c.position.x = -250; });

  // حرکت ماشین‌ها
  cars.forEach(car => {
    if (car.axis === 'x') {
      car.mesh.position.x += car.speed;
      if (car.speed > 0 && car.mesh.position.x > 250) car.mesh.position.x = -250;
      if (car.speed < 0 && car.mesh.position.x < -250) car.mesh.position.x = 250;
    } else {
      car.mesh.position.z += car.speed;
      if (car.speed > 0 && car.mesh.position.z > 250) car.mesh.position.z = -250;
      if (car.speed < 0 && car.mesh.position.z < -250) car.mesh.position.z = 250;
    }
  });

  // حرکت بازیکن
  const moveSpeed = 0.2;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
  
  let moveX = (forward.x * moveForward + right.x * moveRight) * moveSpeed;
  let moveZ = (forward.z * moveForward + right.z * moveRight) * moveSpeed;
  
  if (!checkCollision(playerPos.x + moveX, playerPos.z)) playerPos.x += moveX;
  if (!checkCollision(playerPos.x, playerPos.z + moveZ)) playerPos.z += moveZ;
  
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
