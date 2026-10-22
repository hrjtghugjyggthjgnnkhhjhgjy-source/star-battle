import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. تنظیمات صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
// مه خیلی کم و دور برای عمق دادن
scene.fog = new THREE.Fog(0x87CEEB, 200, 600); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
hemiLight.position.set(0, 100, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(150, 200, 100); 
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
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

// ساخت خیابان‌ها (فاصله‌دار برای اینکه چهارراه داشته باشیم)
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

// تکسچر شیشه‌ای و باکیفیت
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 512;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#555c66'; ctx.fillRect(0, 0, 512, 512); // رنگ بدنه
ctx.fillStyle = '#88ccff'; // شیشه‌های آبی
for (let y = 10; y < 512; y += 40) {
  for (let x = 10; x < 512; x += 40) {
    ctx.fillRect(x, y, 30, 25);
    // افکت درخشش روی شیشه
    ctx.fillStyle = '#bbeeff';
    ctx.fillRect(x, y, 30, 5);
    ctx.fillStyle = '#88ccff';
  }
}
const windowTexture = new THREE.CanvasTexture(canvas);
windowTexture.wrapS = THREE.RepeatWrapping;
windowTexture.wrapT = THREE.RepeatWrapping;
windowTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

function createBuilding(x, z, w, h, d) {
  windowTexture.repeat.set(w/20, h/20); 
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), 
    new THREE.MeshStandardMaterial({ map: windowTexture, roughness: 0.2, metalness: 0.8 }) // براق و فلزی
  );
  b.position.set(x, h/2, z); 
  b.castShadow = true; 
  b.receiveShadow = true;
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

// ================= 5. چراغ راهنمایی =================
function createTrafficLight(x, z) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6), poleMat);
  pole.position.set(x, 3, z);
  pole.castShadow = true;
  scene.add(pole);

  const lightBoxMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.5), lightBoxMat);
  box.position.set(x, 7, z);
  scene.add(box);

  // چراغ قرمز و سبز (ساده)
  const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  redLight.position.set(x, 7.8, z + 0.8);
  scene.add(redLight);

  const greenLight = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
  greenLight.position.set(x, 6.2, z + 0.8);
  scene.add(greenLight);
}

// چراغ‌ها توی چهارراه‌های اصلی
createTrafficLight(10, 10);
createTrafficLight(-10, -10);
createTrafficLight(210, 10);
createTrafficLight(190, -10);

// ================= 6. ماشین‌ها (باکیفیت و با ترافیک) =================
const cars = [];
function createCar(color, startX, startZ, axis, direction) {
  const carGroup = new THREE.Group();
  
  // بدنه ماشین
  const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.7, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4.5), bodyMat);
  body.position.y = 0.5; 
  body.castShadow = true;
  carGroup.add(body);
  
  // کابین شیشه‌ای
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 2.5), cabinMat);
  cabin.position.set(0, 1.4, -0.2); 
  cabin.castShadow = true;
  carGroup.add(cabin);

  // چراغ‌های ماشین
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const headlight1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headlightMat);
  headlight1.position.set(-0.6, 0.5, 2.25);
  carGroup.add(headlight1);
  const headlight2 = headlight1.clone();
  headlight2.position.set(0.6, 0.5, 2.25);
  carGroup.add(headlight2);

  // چرخ‌ها
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const wheels = [[-1, 0.4, 1.5], [1, 0.4, 1.5], [-1, 0.4, -1.5], [1, 0.4, -1.5]];
  wheels.forEach(pos => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(pos[0], pos[1], pos[2]);
    carGroup.add(w);
  });

  // چرخش اولیه برای اینکه ماشین در مسیر درست قرار بگیره
  if (axis === 'x') carGroup.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2; 
  else if (axis === 'z') carGroup.rotation.y = direction > 0 ? 0 : Math.PI;

  carGroup.position.set(startX, 0, startZ);
  scene.add(carGroup);
  
  // ذخیره اطلاعات ماشین
  cars.push({ 
    mesh: carGroup, 
    axis: axis, 
    direction: direction,
    speed: 0.2 + Math.random() * 0.2, // سرعت رندوم
    currentSpeed: 0 // سرعت فعلی (برای توقف و حرکت)
  });
}

// ماشین‌های محور X (افقی)
createCar(0xff3333, -300, 10, 'x', 1);
createCar(0x3333ff, -150, 10, 'x', 1);
createCar(0xffff33, 150, -10, 'x', -1);
createCar(0xffffff, 300, -10, 'x', -1);

// ماشین‌های محور Z (عمودی)
createCar(0x33ff33, 10, -300, 'z', 1);
createCar(0xff33ff, 10, -150, 'z', 1);
createCar(0x00ffff, -10, 150, 'z', -1);
createCar(0xaaaaaa, -10, 300, 'z', -1);

// ================= 7. ابرها =================
const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
for (let i = 0; i < 15; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 15, 8, 8), cloudMat);
  c.position.set((Math.random() - 0.5) * 500, 120 + Math.random() * 50, (Math.random() - 0.5) * 500);
  scene.add(c); clouds.push(c);
}

// ================= 8. بازیکن =================
let playerPos = new THREE.Vector3(0, 1.6, 15); 
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0;
let bullets = [];
let decals = [];
const playerRadius = 0.5; 

// ================= 9. سیستم کنترل چند لمسی =================
const joyZone = document.getElementById('joystick-zone');
const joyKnob = document.getElementById('joystick-knob');
const btnFire = document.getElementById('btn-fire');

let joyTouchId = null, cameraTouchId = null;
let lastTouchX = 0, lastTouchY = 0;
let joyCenterX = 0, joyCenterY = 0, joyMaxDist = 40;

function updateJoyCenter() {
  const rect = joyZone.getBoundingClientRect();
  joyCenterX = rect.left + rect.width / 2; 
  joyCenterY = rect.top + rect.height / 2;
}

document.addEventListener('touchstart', (e) => {
  e.preventDefault(); initAudio();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.target === joyZone || touch.target === joyKnob) {
      joyTouchId = touch.identifier;
      updateJoyCenter();
    } else if (touch.target === btnFire) {
      isFiring = true;
    } else {
      if (cameraTouchId === null) {
        cameraTouchId = touch.identifier;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
      }
    }
  }
}, {passive: false});

document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joyTouchId) {
      let dx = touch.clientX - joyCenterX;
      let dy = touch.clientY - joyCenterY;
      let dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > joyMaxDist) { dx = (dx / dist) * joyMaxDist; dy = (dy / dist) * joyMaxDist; }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      moveRight = dx / joyMaxDist; 
      moveForward = -dy / joyMaxDist;
    }
    if (touch.identifier === cameraTouchId) {
      let dx = touch.clientX - lastTouchX;
      let dy = touch.clientY - lastTouchY;
      playerYaw -= dx * 0.005; 
      playerPitch -= dy * 0.005;
      playerPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, playerPitch));
      lastTouchX = touch.clientX; 
      lastTouchY = touch.clientY;
    }
  }
}, {passive: false});

document.addEventListener('touchend', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joyTouchId) {
      joyTouchId = null;
      joyKnob.style.transform = 'translate(0px, 0px)';
      moveForward = 0; moveRight = 0;
    }
    if (touch.target === btnFire) {
      isFiring = false;
    }
    if (touch.identifier === cameraTouchId) {
      cameraTouchId = null;
    }
  }
}, {passive: false});

document.addEventListener('touchcancel', () => {
  joyTouchId = null; cameraTouchId = null;
  joyKnob.style.transform = 'translate(0px, 0px)';
  moveForward = 0; moveRight = 0;
  isFiring = false;
});

// ================= 10. شلیک =================
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

// ================= 11. برخورد =================
function checkCollision(newX, newZ) {
  for (let obs of obstacles) {
    if (newX + playerRadius > obs.minX && newX - playerRadius < obs.maxX &&
        newZ + playerRadius > obs.minZ && newZ - playerRadius < obs.maxZ) return true;
  }
  return false;
}

// ================= 12. هوش مصنوعی ترافیک (جلوگیری از تصادف) =================
function updateTraffic() {
  for (let i = 0; i < cars.length; i++) {
    let car = cars[i];
    let shouldStop = false;
    
    // 1. بررسی فاصله با ماشین‌های دیگه در همون مسیر
    for (let j = 0; j < cars.length; j++) {
      if (i === j) continue;
      let other = cars[j];
      
      // اگه هر دو توی یک محور بودن
      if (car.axis === other.axis) {
        let dist = 0;
        if (car.axis === 'x') {
          // بررسی اینکه آیا ماشین جلوییه یا نه
          let isAhead = (car.direction > 0 && other.mesh.position.x > car.mesh.position.x) || 
                        (car.direction < 0 && other.mesh.position.x < car.mesh.position.x);
          let sameLane = Math.abs(car.mesh.position.z - other.mesh.position.z) < 2; // توی یک لاین
          
          if (isAhead && sameLane) {
            dist = Math.abs(other.mesh.position.x - car.mesh.position.x);
            if (dist < 10) shouldStop = true; // فاصله کمتر از ۱۰ متر -> ترمز
          }
        } else {
          let isAhead = (car.direction > 0 && other.mesh.position.z > car.mesh.position.z) || 
                        (car.direction < 0 && other.mesh.position.z < car.mesh.position.z);
          let sameLane = Math.abs(car.mesh.position.x - other.mesh.position.x) < 2;
          
          if (isAhead && sameLane) {
            dist = Math.abs(other.mesh.position.z - car.mesh.position.z);
            if (dist < 10) shouldStop = true;
          }
        }
      }
    }
    
    // 2. بررسی چهارراه (اگر به چهارراه نزدیک شد و چراغ قرمز بود - ساده شده)
    // اینجا فقط یه ترمز ساده نزدیک چهارراه اصلی گذاشتیم
    let distToIntersection = 999;
    if (car.axis === 'x') distToIntersection = Math.abs(car.mesh.position.x);
    else distToIntersection = Math.abs(car.mesh.position.z);
    
    if (distToIntersection < 15 && distToIntersection > 5) {
      // توی محدوده چهارراهه، یه مکث کوتاه بکنه
      if (Math.random() < 0.1) shouldStop = true;
    }

    // اعمال سرعت
    if (shouldStop) {
      car.currentSpeed = Math.max(0, car.currentSpeed - 0.05); // ترمز نرم
    } else {
      car.currentSpeed = Math.min(car.speed, car.currentSpeed + 0.05); // گاز دادن نرم
    }

    // حرکت
    if (car.axis === 'x') {
      car.mesh.position.x += car.currentSpeed * car.direction;
      if (car.direction > 0 && car.mesh.position.x > 400) car.mesh.position.x = -400;
      if (car.direction < 0 && car.mesh.position.x < -400) car.mesh.position.x = 400;
    } else {
      car.mesh.position.z += car.currentSpeed * car.direction;
      if (car.direction > 0 && car.mesh.position.z > 400) car.mesh.position.z = -400;
      if (car.direction < 0 && car.mesh.position.z < -400) car.mesh.position.z = 400;
    }
  }
}

// ================= 13. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);

  clouds.forEach(c => { c.position.x += 0.1; if (c.position.x > 300) c.position.x = -300; });

  // آپدیت هوشمند ترافیک
  updateTraffic();

  // حرکت بازیکن
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
