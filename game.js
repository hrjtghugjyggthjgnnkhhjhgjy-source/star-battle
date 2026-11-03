import { initAudio, playShoot, playExplosion, playHit } from './audio.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);

const COLORS = {
  bg: '#06060f', white: '#ffffff', red: '#dc3232', blue: '#5096ff',
  yellow: '#ffdc3c', green: '#3cc85a', purple: '#b450dc', orange: '#ff9632',
  cyan: '#50dcdc',
};

const STATE = { MENU: 'menu', PLAY: 'play', SKIN: 'skin', HELP: 'help', GAMEOVER: 'gameover' };
let state = STATE.MENU;
let currentShip = 'jet'; 
let bestScore = parseInt(localStorage.getItem('sb_best') || '0');

const input = { left: false, right: false, up: false, down: false, fire: false, auto: false };

// کیبورد
window.addEventListener('keydown', e => {
  if (e.code === 'Space') { input.fire = true; e.preventDefault(); }
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') input.left = true;
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') input.right = true;
  if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') input.up = true;
  if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') input.down = true;
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') input.fire = false;
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') input.left = false;
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') input.right = false;
  if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') input.up = false;
  if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') input.down = false;
});

// رسم سفینه
function drawShip(x, y, w, h, type) {
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  
  if (type === 'jet') {
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.moveTo(0, -h/2); ctx.lineTo(-w/4, 0); ctx.lineTo(-w/2, h/3);
    ctx.lineTo(-w/6, h/4); ctx.lineTo(-w/6, h/2); ctx.lineTo(w/6, h/2);
    ctx.lineTo(w/6, h/4); ctx.lineTo(w/2, h/3); ctx.lineTo(w/4, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#004488';
    ctx.beginPath(); ctx.arc(0, -h/6, w/8, 0, Math.PI*2); ctx.fill();
  } else if (type === 'spaceship') {
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.moveTo(0, -h/2); ctx.lineTo(w/4, -h/6); ctx.lineTo(w/2, h/4);
    ctx.lineTo(w/6, h/4); ctx.lineTo(w/6, h/2); ctx.lineTo(-w/6, h/2);
    ctx.lineTo(-w/6, h/4); ctx.lineTo(-w/2, h/4); ctx.lineTo(-w/4, -h/6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(-w/4, h/2 - 5, w/6, 8); ctx.fillRect(w/12, h/2 - 5, w/6, 8);
  } else if (type === 'heli') {
    ctx.fillStyle = COLORS.green;
    ctx.beginPath(); ctx.ellipse(0, 0, w/3, h/2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = COLORS.gray;
    ctx.fillRect(-w/2, -h/2, w, 4);
    ctx.beginPath(); ctx.arc(0, -h/2 + 2, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(-4, h/4, 8, h/3);
    ctx.fillRect(-w/4, h/2 + h/6, w/2, 4);
  } else if (type === 'ufo') {
    ctx.fillStyle = COLORS.purple;
    ctx.beginPath(); ctx.ellipse(0, h/4, w/2, h/3, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath(); ctx.arc(0, h/4 - h/4, w/4, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.yellow;
    for(let i=-1; i<=1; i++) { ctx.beginPath(); ctx.arc(i*w/3, h/4, 3, 0, Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}

class Player {
  constructor() {
    this.w = 45; this.h = 55;
    this.x = canvas.width / 2 - this.w / 2;
    this.y = canvas.height - 300;
    this.hp = 10; this.maxHp = 10;
    this.cooldown = 0; this.bombs = 5;
  }
  update() {
    const s = 7;
    if (input.left)  this.x -= s;
    if (input.right) this.x += s;
    if (input.up)    this.y -= s;
    if (input.down)  this.y += s;
    this.x = Math.max(5, Math.min(canvas.width - this.w - 5, this.x));
    this.y = Math.max(60, Math.min(canvas.height - 180, this.y));
    if (this.cooldown > 0) this.cooldown--;
  }
  draw() { drawShip(this.x, this.y, this.w, this.h, currentShip); }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

class Bullet {
  constructor(x, y, isEnemy = false) {
    this.x = x; this.y = y; this.w = 6; this.h = 15; this.isEnemy = isEnemy;
    this.color = isEnemy ? COLORS.red : COLORS.yellow;
  }
  update() { this.y += this.isEnemy ? 6 : -12; }
  draw() { ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.w, this.h); }
  offScreen() { return this.isEnemy ? this.y > canvas.height : this.y < -20; }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

class Enemy {
  constructor(type) {
    this.type = type;
    this.w = 35; this.h = 35;
    this.x = Math.random() * (canvas.width - this.w);
    this.y = -this.h;
    this.moveDir = Math.random() < 0.5 ? 1 : -1;
    if (type === 'drone') { this.w = 25; this.h = 25; this.speed = 1.5; this.hp = 1; this.color = COLORS.yellow; }
    else if (type === 'jet') { this.speed = 1.0; this.hp = 2; this.color = COLORS.red; }
    else { this.speed = 0.7; this.hp = 1; this.color = COLORS.purple; }
  }
  update() {
    this.y += this.speed; this.x += 0.5 * this.moveDir;
    if (this.x <= 0 || this.x + this.w >= canvas.width) this.moveDir *= -1;
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    if(this.type === 'drone') { ctx.arc(this.x + this.w/2, this.y + this.h/2, this.w/2, 0, Math.PI*2); }
    else { ctx.moveTo(this.x + this.w/2, this.y + this.h); ctx.lineTo(this.x, this.y); ctx.lineTo(this.x + this.w, this.y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COLORS.white; ctx.lineWidth = 2; ctx.stroke();
  }
  offScreen() { return this.y > canvas.height; }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

let player, bullets, enemyBullets, enemies;
let score = 0, spawnTimer = 0, spawnDelay = 90, level = 1;

function rectsCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function startGame() {
  initAudio();
  player = new Player();
  bullets = []; enemyBullets = []; enemies = [];
  score = 0; spawnTimer = 0; level = 1; spawnDelay = 90;
  state = STATE.PLAY;
  showScreen(null);
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('touch-controls').classList.remove('hidden');
}

function gameOver() {
  bestScore = Math.max(bestScore, score);
  localStorage.setItem('sb_best', bestScore);
  document.getElementById('final-score').textContent = score;
  document.getElementById('best-score').textContent = bestScore;
  state = STATE.GAMEOVER;
  showScreen('gameover-screen');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('touch-controls').classList.add('hidden');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (id) document.getElementById(id).classList.add('active');
}

let stars = [];
for (let i = 0; i < 80; i++) stars.push({ x: Math.random()*600, y: Math.random()*800, s: Math.random()*2+1 });

function gameLoop() {
  requestAnimationFrame(gameLoop);
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  for (let s of stars) {
    s.y += s.s; if (s.y > canvas.height) { s.y = 0; s.x = Math.random()*canvas.width; }
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  if (state === STATE.PLAY && player) {
    player.update();
    if ((input.fire || input.auto) && player.cooldown === 0) {
      bullets.push(new Bullet(player.x + player.w/2 - 3, player.y));
      playShoot();
      player.cooldown = 8;
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update(); if (bullets[i].offScreen()) bullets.splice(i, 1);
    }
    spawnTimer++;
    if (spawnTimer >= spawnDelay) {
      let r = Math.random();
      let type = r < 0.3 ? 'drone' : (r < 0.7 ? 'jet' : 'normal');
      enemies.push(new Enemy(type));
      spawnTimer = 0;
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      let e = enemies[i]; e.update();
      if (e.offScreen()) {
        enemies.splice(i, 1); player.hp--; playHit();
        if (player.hp <= 0) return gameOver();
      }
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (rectsCollide(bullets[i].rect(), enemies[j].rect())) {
          bullets.splice(i, 1); enemies[j].hp--;
          if (enemies[j].hp <= 0) {
            enemies.splice(j, 1); score += 10; playExplosion();
          }
          break;
        }
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (rectsCollide(enemies[i].rect(), player.rect())) {
        enemies.splice(i, 1); player.hp--; playHit();
        if (player.hp <= 0) return gameOver();
      }
    }
    for (let e of enemies) e.draw();
    for (let b of bullets) b.draw();
    player.draw();
    document.getElementById('score').textContent = score;
    document.getElementById('hp').textContent = '*'.repeat(Math.max(0, player.hp));
  }
}

document.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    initAudio();
    const action = btn.dataset.action;
    if (action === 'start') startGame();
    else if (action === 'skin') { state = STATE.SKIN; showScreen('skin-screen'); }
    else if (action === 'help') { state = STATE.HELP; showScreen('help-screen'); }
    else if (action === 'back') { state = STATE.MENU; showScreen('menu-screen'); }
    else if (action === 'restart') startGame();
    else if (action === 'menu') { state = STATE.MENU; showScreen('menu-screen'); }
  });
});

document.querySelectorAll('[data-ship]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentShip = btn.dataset.ship;
    document.querySelectorAll('[data-ship]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

const touchMap = { 'btn-left': 'left', 'btn-right': 'right', 'btn-up': 'up', 'btn-down': 'down', 'btn-fire': 'fire' };
Object.keys(touchMap).forEach(id => {
  const btn = document.getElementById(id); const key = touchMap[id];
  btn.addEventListener('touchstart', e => { e.preventDefault(); initAudio(); input[key] = true; btn.style.background = 'rgba(80,150,255,0.9)'; });
  btn.addEventListener('touchend', e => { e.preventDefault(); input[key] = false; btn.style.background = ''; });
  btn.addEventListener('mousedown', () => input[key] = true);
  btn.addEventListener('mouseup', () => input[key] = false);
});

document.getElementById('btn-auto').addEventListener('click', function() {
  initAudio();
  input.auto = !input.auto;
  this.classList.toggle('on', input.auto);
});
document.getElementById('btn-bomb').addEventListener('click', function() {
  if (state === STATE.PLAY && player && player.bombs > 0) {
    player.bombs--;
    for(let e of enemies) score += 10;
    enemies = [];
    playExplosion();
  }
});

resizeCanvas();
gameLoop();
