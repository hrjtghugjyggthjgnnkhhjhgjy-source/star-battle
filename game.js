import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. راه‌اندازی صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 50, 200); // مه رو کمی دورتر کردم که شهر بهتر دیده بشه

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50); 
scene.add(dirLight);

// ================= 3. زمین (چمن) =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300), 
  new THREE.MeshStandardMaterial({ color: 0x3a8a3a })
);
ground.rotation.x = -Math.PI / 2; 
ground.userData.isGround = true;
scene.add(ground);

// ================= 4. ساخت جاده آسفالت =================
// یه مستطیل بلند برای جاده
const roadGeo = new THREE.PlaneGeometry(15, 200); 
const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.05, -50); // جاده از مرکز به سمت جلو (منفی Z) میره
road.userData.isGround = true; // گلوله بهش بخوره سوراخ میشه
scene.add(road);

// خط‌کشی وسط جاده
const lineGeo = new THREE.PlaneGeometry(1, 200);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const centerLine = new THREE.Mesh(lineGeo, lineMat);
centerLine.rotation.x = -Math.PI / 2;
centerLine.position.set(0, 0.06, -50);
scene.add(centerLine);

// ================= 5. ساخت فرودگاه (نقطه شروع) =================
// یه سکوی دایره‌ای بزرگ برای فرودگاه
const airportGeo = new THREE.CircleGeometry(20, 32);
const airportMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
const airport = new THREE.Mesh(airportGeo, airportMat);
airport.rotation.x = -Math.PI / 2;
airport.position.set(0, 0.07, 20); // پشت سر بازیکن
airport.userData.isGround = true;
scene.add(airport);

// خطوط سفید فرودگاه (حرف H)
const hGeo = new THREE.PlaneGeometry(2, 15);
const hMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const h1 = new THREE.Mesh(hGeo, hMat); h1.rotation.x = -Math.PI/2; h1.position.set(-5, 0.08, 20); scene.add(h1);
const h2 = new THREE.Mesh(hGeo, hMat); h2.rotation.x = -Math.PI/2; h2.position.set(5, 0.08, 20); scene.add(h2);
const h3 = new THREE.Mesh(new THREE.PlaneGeometry(10, 2), hMat); h3.rotation.x = -Math.PI/2; h3.position.set(0, 0.08, 20); scene.add(h3);

// ================= 6. ساخت ساختمون‌ها (مغازه‌ها) =================
const obstacles = [];
const buildingsGroup = new THREE.Group();
scene.add(buildingsGroup);

// تکسچر پنجره
const canvas = document.createElement('canvas');
canvas.width = 128; canvas.height = 128;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ccbbaa'; ctx.fillRect(0, 0, 128, 128); // رنگ دیوار (کرم)
ctx.fillStyle = '#333'; // پنجره
for (let y = 10; y < 128; y += 30) {
  for (let x = 10; x < 128; x += 30) {
    ctx.fillRect(x, y, 20, 20);
  }
}
const windowTexture = new THREE.CanvasTexture(canvas);
windowTexture.wrapS = THREE.RepeatWrapping;
windowTexture.wrapT = THREE.RepeatWrapping;

// تابع ساخت مغازه/ساختمون
function createBuilding(x, z, w, h, d, color) {
  windowTexture.repeat.set(w/5, h/5);
  
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), 
    new THREE.MeshStandardMaterial({ map: windowTexture, roughness: 0.8 })
  );
  b.position.set(x, h/2, z); 
  b.userData.isBuilding = true;
  buildingsGroup.add(b);
  
  // اضافه کردن به لیست برخورد
  obstacles.push({
    minX: x - w/2, maxX: x + w/2,
    minZ: z - d/2, maxZ: z + d/2
  });
}

// چیدن مغازه‌ها در دو طرف جاده (به سمت جلو)
// سمت راست جاده
createBuilding(15, 0, 10, 15, 10); 
createBuilding(15, -30, 12, 20, 12);
createBuilding(18, -60, 8, 25, 8); 
createBuilding(15, -90, 15, 10, 15); 

// سمت چپ جاده
createBuilding(-15, -10, 10, 12, 10); 
createBuilding(-18, -40, 12, 25, 12);
createBuilding(-15, -70, 10, 18, 10); 
createBuilding(-20, -100, 15, 30, 15); 

// ساختمون‌های دورتر برای پر کردن پس‌زمینه
createBuilding(40, -50, 20, 40, 20);
createBuilding(-40, -50, 20, 45, 20);

// ================= 7. متغیرها =================
// بازیکن از فرودگاه شروع میکنه
let playerPos = new THREE.Vector3(0, 1.6, 25); 
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [];
let decals = [];
const playerRadius = 0.5; 

// ================= 8. جوی‌استیک =================
const joyZone = document.getElementById('joystick-zone');
const joyKnob = document.getElementById('joystick-knob');
let joyActive = false, joyCenterX = 0, joyCenterY = 0, joyMaxDist = 50;

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

// ================= 9. دکمه شلیک =================
document.getElementById('btn-fire').addEventListener('touchstart', (e) => { e.preventDefault(); isFiring = true; }, {passive: false});
document.getElementById('btn-fire').addEventListener('touchend', (e) => { e.preventDefault(); isFiring = false; }, {passive: false});

// ================= 10. شلیک =================
const raycaster = new THREE.Raycaster();

function shootBullet() {
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 4, 4), 
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  const startPos = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  b.position.copy(startPos).add(dir.multiplyScalar(1));
  b.userData = { velocity: dir.multiplyScalar(1.5), life: 100 };
  scene.add(b); bullets.push(b);

  raycaster.set(camera.position, dir);
  // بررسی برخورد با ساختمون‌ها، زمین، جاده و فرودگاه
  const intersects = raycaster.intersectObjects([buildingsGroup, ground, road, airport], true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const decalGeo = new THREE.PlaneGeometry(0.4, 0.4);
    const decalMat = new THREE.MeshBasicMaterial({ 
      color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false 
    });
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.position.copy(hit.point);
    decal.lookAt(hit.point.clone().add(hit.face.normal));
    scene.add(decal);
    
    decals.push({ mesh: decal, timeCreated: performance.now() });
  }
}

// ================= 11. برخورد =================
function checkCollision(newX, newZ) {
  for (let obs of obstacles) {
    if (newX + playerRadius > obs.minX && newX - playerRadius < obs.maxX &&
        newZ + playerRadius > obs.minZ && newZ - playerRadius < obs.maxZ) {
      return true;
    }
  }
  return false;
}

// ================= 12. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  const moveSpeed = 0.15;
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
