import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 80, 300); // مه دورتر برای دیدن برج‌های بلند

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(100, 200, 50); 
dirLight.castShadow = true;
scene.add(dirLight);

// ================= 3. زمین و شبکه خیابان‌ها =================
// زمین چمنی (در نقشه نیویورک کمتر دیده میشه ولی برای پایه لازمه)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600), 
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a }) // زمین تاریک
);
ground.rotation.x = -Math.PI / 2; 
ground.userData.isGround = true;
scene.add(ground);

// تابع ساخت جاده
function createRoad(x, z, w, d) {
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d), 
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0.01, z);
  road.userData.isGround = true;
  scene.add(road);

  // خط‌کشی وسط جاده
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  if (w > d) { // جاده افقی
    for (let i = x - w/2 + 10; i < x + w/2; i += 20) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(10, 1), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i, 0.02, z);
      scene.add(line);
    }
  } else { // جاده عمودی
    for (let i = z - d/2 + 10; i < z + d/2; i += 20) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 10), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.02, i);
      scene.add(line);
    }
  }
}

// ساخت خیابان‌های اصلی (شبکه شطرنجی)
createRoad(0, 0, 600, 30);   // خیابان افقی اول
createRoad(0, 100, 600, 30); // خیابان افقی دوم
createRoad(0, -100, 600, 30);// خیابان افقی سوم
createRoad(0, 0, 30, 600);   // خیابان عمودی اول
createRoad(100, 0, 30, 600); // خیابان عمودی دوم
createRoad(-100, 0, 30, 600);// خیابان عمودی سوم

// ================= 4. سیستم ساخت آسمان‌خراش =================
const obstacles = [];
const buildingsGroup = new THREE.Group();
scene.add(buildingsGroup);

// تکسچر پنجره‌های برج
const canvas = document.createElement('canvas');
canvas.width = 128; canvas.height = 256; // بوم عمودی
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#444'; ctx.fillRect(0, 0, 128, 256); 
ctx.fillStyle = '#88ccff'; // شیشه‌های آبی روشن
for (let y = 5; y < 256; y += 20) {
  for (let x = 5; x < 128; x += 20) {
    ctx.fillRect(x, y, 15, 15);
  }
}
const windowTexture = new THREE.CanvasTexture(canvas);
windowTexture.wrapS = THREE.RepeatWrapping;
windowTexture.wrapT = THREE.RepeatWrapping;

// تابع ساخت برج
function createSkyscraper(x, z, w, h, d) {
  windowTexture.repeat.set(w/5, h/10); // تنظیم تکرار پنجره‌ها
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), 
    new THREE.MeshStandardMaterial({ map: windowTexture, color: 0xcccccc, roughness: 0.5 })
  );
  b.position.set(x, h/2, z); 
  b.castShadow = true; b.receiveShadow = true;
  buildingsGroup.add(b);
  
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

// چیدمان برج‌ها در بلوک‌های شهری
// بلوک اول (بالا راست)
createSkyscraper(50, 50, 20, 80, 20);
createSkyscraper(70, 70, 15, 60, 15);
createSkyscraper(50, 90, 25, 100, 25);

// بلوک دوم (بالا چپ)
createSkyscraper(-50, 50, 25, 90, 25);
createSkyscraper(-80, 80, 20, 120, 20);
createSkyscraper(-50, 90, 15, 50, 15);

// بلوک سوم (پایین راست)
createSkyscraper(50, -50, 20, 70, 20);
createSkyscraper(80, -50, 15, 110, 15);
createSkyscraper(60, -90, 25, 60, 25);

// بلوک چهارم (پایین چپ)
createSkyscraper(-50, -50, 20, 100, 20);
createSkyscraper(-70, -80, 15, 80, 15);
createSkyscraper(-50, -90, 20, 130, 20);

// ================= 5. ابرها =================
const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
for (let i = 0; i < 15; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 6, 7, 7), cloudMat);
  c.position.set((Math.random() - 0.5) * 300, 80 + Math.random() * 40, (Math.random() - 0.5) * 300);
  scene.add(c); clouds.push(c);
}

// ================= 6. ماشین‌ها =================
const cars = [];
function createCar(color, speed, startX, startZ, axis) {
  const carGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: color }));
  body.position.y = 0.5; carGroup.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cabin.position.set(0, 1.4, -0.2); carGroup.add(cabin);
  
  if (axis === 'z') carGroup.rotation.y = Math.PI / 2; // اگه توی محور z حرکت میکنه بچرخونش
  
  carGroup.position.set(startX, 0, startZ);
  scene.add(carGroup);
  cars.push({ mesh: carGroup, speed: speed, axis: axis });
}
// ماشین روی جاده افقی
createCar(0xff0000, 0.3, -200, 5, 'x');
createCar(0x0000ff, -0.25, 200, -5, 'x');
// ماشین روی جاده عمودی
createCar(0xffffff, 0.2, 5, -200, 'z');
createCar(0x00ff00, -0.3, -5, 200, 'z');

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

// ================= 10. برخورد =================
function checkCollision(newX, newZ) {
  // برخورد با ساختمون‌ها
  for (let obs of obstacles) {
    if (newX + playerRadius > obs.minX && newX - playerRadius < obs.maxX &&
        newZ + playerRadius > obs.minZ && newZ - playerRadius < obs.maxZ) {
      return true;
    }
  }
  // برخورد با ماشین‌ها (تا ازشون رد نشی)
  for (let car of cars) {
    const cw = 1.5, cl = 2.5; 
    const cx = car.mesh.position.x, cz = car.mesh.position.z;
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

  const moveSpeed = 0.25; // سرعت راه رفتن رو یه کم بیشتر کردم که توی شهر بزرگ سریعتر حرکت کنی
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
