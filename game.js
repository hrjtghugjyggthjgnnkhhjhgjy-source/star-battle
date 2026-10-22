import * as THREE from 'three';
import { initAudio, playShootSound } from './audio.js';

// ================= 1. راه‌اندازی صحنه =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); 
scene.fog = new THREE.Fog(0x87CEEB, 30, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ================= 2. نورپردازی =================
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50); 
scene.add(dirLight);

// ================= 3. زمین و ابرها =================
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x3a8a3a }));
ground.rotation.x = -Math.PI / 2; 
scene.add(ground);

const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
function createCloud(x, y, z) {
  const c = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 3, 8, 8), cloudMat);
    s.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4);
    c.add(s);
  }
  c.position.set(x, y, z); scene.add(c); clouds.push(c);
}
createCloud(-20, 20, -30); createCloud(30, 25, -50); createCloud(0, 30, -80);

// ================= 4. ساختمون‌ها =================
function createBuilding(x, z, w, h, d) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
  b.position.set(x, h/2, z); scene.add(b);
}
createBuilding(-15, -20, 10, 25, 10); createBuilding(20, -30, 15, 35, 15);
createBuilding(-25, 15, 12, 20, 12); createBuilding(25, 20, 10, 45, 10);

// ================= 5. متغیرها =================
let playerPos = new THREE.Vector3(0, 1.6, 15);
let playerYaw = 0, playerPitch = 0;
let moveForward = 0, moveRight = 0;
let isFiring = false, fireCooldown = 0, bullets = [];

// ================= 6. جوی‌استیک =================
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

// ================= 7. دکمه شلیک =================
document.getElementById('btn-fire').addEventListener('touchstart', (e) => { e.preventDefault(); isFiring = true; }, {passive: false});
document.getElementById('btn-fire').addEventListener('touchend', (e) => { e.preventDefault(); isFiring = false; }, {passive: false});

// ================= 8. شلیک =================
function shootBullet() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
  const startPos = camera.position.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  b.position.copy(startPos).add(dir.multiplyScalar(1));
  b.userData = { velocity: dir.multiplyScalar(1.5), life: 100 };
  scene.add(b); bullets.push(b);
}

// ================= 9. حلقه بازی =================
function animate() {
  requestAnimationFrame(animate);
  
  for (let c of clouds) { c.position.x += 0.05; if (c.position.x > 100) c.position.x = -100; }

  const moveSpeed = 0.15;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
  playerPos.add(forward.multiplyScalar(moveForward * moveSpeed)).add(right.multiplyScalar(moveRight * moveSpeed));
  
  camera.position.copy(playerPos); camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');

  if (isFiring) { 
    fireCooldown--; 
    if (fireCooldown <= 0) { shootBullet(); playShootSound(); fireCooldown = 10; } 
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.position.add(b.userData.velocity); b.userData.life--;
    if (b.userData.life <= 0) { scene.remove(b); bullets.splice(i, 1); }
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});
animate();
