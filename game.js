import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 200, 600); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(150, 200, 100); 
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -200;
dirLight.shadow.camera.right = 200;
dirLight.shadow.camera.top = 200;
dirLight.shadow.camera.bottom = -200;
scene.add(dirLight);

// ================= 3. زمین و جاده =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000), 
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
);
ground.rotation.x = -Math.PI / 2; 
ground.receiveShadow = true;
ground.userData.isGround = true;
scene.add(ground);

// ساخت خیابان‌ها
function createRoad(x, z, w, d, isHorizontal) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x111111 }));
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
createRoad(0, 0, 1000, 40, true);   
createRoad(0, 200, 1000, 40, true); 
createRoad(0, -200, 1000, 40, true); 
createRoad(0, 0, 40, 1000, false);   
createRoad(200, 0, 40, 1000, false); 
createRoad(-200, 0, 40, 1000, false); 

// ================= 4. فرودگاه و پایگاه فضایی =================
// باند فرودگاه
const runwayMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const runway = new THREE.Mesh(new THREE.PlaneGeometry(40, 200), runwayMat);
runway.rotation.x = -Math.PI / 2;
runway.position.set(0, 0.03, -100);
runway.receiveShadow = true;
scene.add(runway);

// خط‌کشی باند فرود
const runwayLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
for(let i = -190; i < -10; i += 20) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(2, 10), runwayLineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.04, i);
  scene.add(line);
}

// برج مراقبت
const towerGroup = new THREE.Group();
const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 20, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
towerBase.position.y = 10; towerBase.castShadow = true; towerGroup.add(towerBase);
const towerTop = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x333333, transparent: true, opacity: 0.8 }));
towerTop.position.y = 22; towerTop.castShadow = true; towerGroup.add(towerTop);
towerGroup.position.set(-30, 0, -100);
scene.add(towerGroup);

// آشیانه
const hangarMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.5, roughness: 0.5 });
const hangar = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 30), hangarMat);
hangar.position.set(35, 7.5, -100);
hangar.castShadow = true; hangar.receiveShadow = true;
scene.add(hangar);
const hangarRoof = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 40, 16, 1, false, 0, Math.PI), hangarMat);
hangarRoof.rotation.z = Math.PI / 2;
hangarRoof.position.set(35, 15, -100);
hangarRoof.castShadow = true;
scene.add(hangarRoof);

// سکوی پرتاب
const padMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.2, metalness: 0.8 });
const launchPad = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 1, 32), padMat);
launchPad.position.set(0, 0.05, -250);
launchPad.receiveShadow = true;
scene.add(launchPad);
const padLineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
for(let i = 0; i < 4; i++) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(30, 1), padLineMat);
  line.rotation.x = -Math.PI / 2;
  line.rotation.z = (Math.PI / 4) * i;
  line.position.set(0, 0.06, -250);
  scene.add(line);
}

// ================= 5. ساختمون‌های شهر =================
const obstacles = [];
const buildingsGroup = new THREE.Group();
scene.add(buildingsGroup);

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
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: windowTexture, roughness: 0.8 }));
  b.position.set(x, h/2, z); 
  b.castShadow = true; b.receiveShadow = true;
  buildingsGroup.add(b);
  obstacles.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
}

createBuilding(60, 60, 30, 100, 30);
createBuilding(100, 100, 40, 150, 40);
createBuilding(-60, 60, 30, 120, 30);
createBuilding(-100, 100, 40, 80, 40);
createBuilding(60, -60, 30, 90, 30);
createBuilding(100, -100, 40, 140, 40);
createBuilding(-60, -60, 30, 110, 30);
createBuilding(-100, -100, 40, 160, 40);

// ================= 6. ماشین‌ها (بدون ترافیک هوشمند ساده) =================
const cars = [];
function createCar(color, startX, startZ, direction) {
  const carGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: color }));
  body.position.y = 0.5; body.castShadow = true; carGroup.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cabin.position.set(0, 1.4, -0.5); cabin.castShadow = true; carGroup.add(cabin);

  if (direction === 'x') carGroup.rotation.y = Math.PI / 2;
  carGroup.position.set(startX, 0, startZ);
  scene.add(carGroup);
  cars.push({ mesh: carGroup, direction: direction, speed: 0.2 });
}
createCar(0xff0000, -300, 10, 'x');
createCar(0x0000ff, 300, -10, 'x');

// ================= 7. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, -100); // شروع در فرودگاه
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [];
let decals = [];
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
    if (touch.target === joyZone || touch.target === joyKnob) {
      joyTouchId = touch.identifier; updateJoyCenter();
    } else if (touch.target === btnFire) {
      isFiring = true;
    } else {
      if (cameraTouchId === null) {
        cameraTouchId = touch.identifier;
        lastTouchX = touch.clientX; lastTouchY = touch.clientY;
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
      joyTouchId = null; joyKnob.style.transform = 'translate(0px, 0px)';
      moveForward = 0; moveRight = 0;
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
  const intersects = raycaster.intersectObjects([buildingsGroup, towerGroup, hangar, hangarRoof, launchPad], true);

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
  return false;
}

// ================= 11. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  cars.forEach(car => {
    car.mesh.position.x += car.speed;
    if (car.mesh.position.x > 400) car.mesh.position.x = -400;
  });

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
