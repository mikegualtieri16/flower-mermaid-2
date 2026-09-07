const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreEl = document.getElementById("finalScore");
const bestScoreEl = document.getElementById("bestScore");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

let W = 390;
let H = 844;
let dpr = 1;
let running = false;
let score = 0;
let lives = 3;
let elapsed = 0;
let last = 0;
let spawnTimer = 0;
let sunTimer = 0;
let bubbleTimer = 0;
let difficulty = 1;

let pointer = { x: W / 2, y: H * 0.72, active: false };

const player = {
  x: W / 2,
  y: H * 0.72,
  r: 24,
  targetX: W / 2,
  targetY: H * 0.72,
  invincible: 0,
  bob: 0
};

let obstacles = [];
let suns = [];
let bubbles = [];
let particles = [];
let seaweed = [];

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = rect.width;
  H = rect.height;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!running) {
    player.x = W / 2;
    player.y = H * 0.72;
    player.targetX = player.x;
    player.targetY = player.y;
  }

  makeSeaweed();
}

function makeSeaweed() {
  seaweed = [];
  for (let i = 0; i < 12; i++) {
    seaweed.push({
      x: (i / 11) * W + (Math.random() - .5) * 22,
      h: 55 + Math.random() * 120,
      sway: Math.random() * Math.PI * 2,
      width: 4 + Math.random() * 6
    });
  }
}

function reset() {
  score = 0;
  lives = 3;
  elapsed = 0;
  spawnTimer = 0;
  sunTimer = 0;
  bubbleTimer = 0;
  difficulty = 1;
  obstacles = [];
  suns = [];
  bubbles = [];
  particles = [];
  player.x = W / 2;
  player.y = H * 0.72;
  player.targetX = player.x;
  player.targetY = player.y;
  player.invincible = 0;
  updateHUD();
}

function startGame() {
  reset();
  running = true;
  last = performance.now();
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  finalScoreEl.textContent = score;
  const best = Math.max(score, Number(localStorage.getItem("bloomtailBest") || 0));
  localStorage.setItem("bloomtailBest", best);
  bestScoreEl.textContent = best;
  gameOverScreen.classList.add("visible");
}

function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function circleHit(a, b, extra = 0) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = (a.r || 0) + (b.r || 0) + extra;
  return dx * dx + dy * dy < rr * rr;
}

function spawnObstacle() {
  const r = rand(18, 33);
  obstacles.push({
    x: rand(r + 8, W - r - 8),
    y: -r - 20,
    r,
    speed: rand(110, 165) * difficulty,
    drift: rand(-35, 35),
    phase: rand(0, Math.PI * 2),
    tentacles: Math.floor(rand(4, 7))
  });
}

function spawnSun() {
  suns.push({
    x: rand(30, W - 30),
    y: -28,
    r: 12,
    speed: rand(85, 120) * Math.min(1.7, difficulty),
    pulse: rand(0, Math.PI * 2)
  });
}

function spawnBubble() {
  bubbles.push({
    x: rand(10, W - 10),
    y: H + 12,
    r: rand(2, 7),
    speed: rand(25, 75),
    wobble: rand(0, Math.PI * 2)
  });
}

function burst(x, y, count, type) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rand(-100, 100),
      vy: rand(-100, 100),
      life: rand(.35, .8),
      maxLife: .8,
      size: rand(2, 5),
      type
    });
  }
}

function update(dt) {
  elapsed += dt;
  difficulty = 1 + Math.min(1.2, elapsed / 50);

  player.invincible = Math.max(0, player.invincible - dt);
  player.bob += dt * 5;

  const smoothing = 1 - Math.pow(0.001, dt);
  player.x += (player.targetX - player.x) * smoothing;
  player.y += (player.targetY - player.y) * smoothing;
  player.x = clamp(player.x, 32, W - 32);
  player.y = clamp(player.y, 72, H - 90);

  spawnTimer -= dt;
  sunTimer -= dt;
  bubbleTimer -= dt;

  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = rand(.75, 1.25) / difficulty;
  }

  if (sunTimer <= 0) {
    spawnSun();
    sunTimer = rand(.85, 1.4);
  }

  if (bubbleTimer <= 0) {
    spawnBubble();
    bubbleTimer = rand(.12, .35);
  }

  for (const o of obstacles) {
    o.y += o.speed * dt;
    o.x += Math.sin(elapsed * 2 + o.phase) * o.drift * dt;

    if (player.invincible <= 0 && circleHit(player, o, -5)) {
      lives -= 1;
      player.invincible = 1.25;
      burst(player.x, player.y, 18, "hit");
      updateHUD();
      o.y = H + 200;
      if (lives <= 0) {
        endGame();
        return;
      }
    }
  }

  for (const s of suns) {
    s.y += s.speed * dt;
    s.pulse += dt * 5;
    if (!s.collected && circleHit(player, s, 3)) {
      s.collected = true;
      score += 1;
      burst(s.x, s.y, 13, "sun");
      updateHUD();
      s.y = H + 100;
    }
  }

  for (const b of bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(elapsed * 2 + b.wobble) * 8 * dt;
  }

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= .985;
    p.vy *= .985;
    p.life -= dt;
  }

  obstacles = obstacles.filter(o => o.y < H + 80);
  suns = suns.filter(s => s.y < H + 50);
  bubbles = bubbles.filter(b => b.y > -20);
  particles = particles.filter(p => p.life > 0);
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#0d496f");
  grd.addColorStop(.55, "#0a3151");
  grd.addColorStop(1, "#06182c");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = .08;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo((i + .2) * W / 5, 0);
    ctx.lineTo((i + 1) * W / 5, H);
    ctx.lineTo((i + 1.7) * W / 5, H);
    ctx.lineTo((i + .65) * W / 5, 0);
    ctx.closePath();
    ctx.fillStyle = "#b8f6ff";
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "#0a2235";
  ctx.beginPath();
  ctx.moveTo(0, H - 38);
  ctx.quadraticCurveTo(W * .25, H - 65, W * .5, H - 37);
  ctx.quadraticCurveTo(W * .75, H - 12, W, H - 42);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(0, H);
  seaweed.forEach((s, i) => {
    ctx.strokeStyle = i % 2 ? "rgba(46,161,116,.6)" : "rgba(42,136,107,.52)";
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x, 0);
    ctx.bezierCurveTo(
      s.x + Math.sin(elapsed * 1.4 + s.sway) * 15, -s.h * .35,
      s.x - Math.cos(elapsed * 1.2 + s.sway) * 18, -s.h * .68,
      s.x + Math.sin(elapsed * 1.7 + s.sway) * 20, -s.h
    );
    ctx.stroke();
  });
  ctx.restore();

  for (const b of bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(211, 250, 255, .35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawSun(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  const scale = 1 + Math.sin(s.pulse) * .12;
  ctx.scale(scale, scale);
  ctx.shadowColor = "#ffe56d";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffe56d";
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-1.5, -19, 3, 7);
  }
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawJelly(o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.shadowColor = "rgba(255, 120, 239, .5)";
  ctx.shadowBlur = 13;

  const body = ctx.createRadialGradient(-6, -8, 2, 0, 0, o.r);
  body.addColorStop(0, "#ffd0fb");
  body.addColorStop(.35, "#e47be1");
  body.addColorStop(1, "#7d398e");
  ctx.fillStyle = body;

  ctx.beginPath();
  ctx.arc(0, 0, o.r, Math.PI, 0);
  ctx.quadraticCurveTo(o.r * .75, o.r * .45, o.r * .5, o.r * .18);
  ctx.quadraticCurveTo(o.r * .25, o.r * .5, 0, o.r * .18);
  ctx.quadraticCurveTo(-o.r * .25, o.r * .5, -o.r * .5, o.r * .18);
  ctx.quadraticCurveTo(-o.r * .75, o.r * .45, -o.r, 0);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  for (let i = 0; i < o.tentacles; i++) {
    const tx = (i - (o.tentacles - 1) / 2) * (o.r * 1.15 / o.tentacles);
    ctx.beginPath();
    ctx.moveTo(tx, o.r * .14);
    ctx.bezierCurveTo(
      tx + Math.sin(elapsed * 4 + i) * 8, o.r * .7,
      tx - Math.cos(elapsed * 3 + i) * 8, o.r * 1.18,
      tx + Math.sin(elapsed * 4 + i) * 6, o.r * 1.5
    );
    ctx.strokeStyle = "rgba(233, 129, 233, .85)";
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y + Math.sin(player.bob) * 2);

  if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) {
    ctx.globalAlpha = .35;
  }

  // Tail fin
  ctx.save();
  ctx.translate(0, 34);
  ctx.rotate(Math.sin(elapsed * 6) * .08);
  ctx.fillStyle = "#43d8c0";
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.quadraticCurveTo(-24, 34, -32, 54);
  ctx.quadraticCurveTo(-8, 50, 0, 36);
  ctx.quadraticCurveTo(9, 50, 33, 54);
  ctx.quadraticCurveTo(25, 34, 0, 20);
  ctx.fill();

  // Tail body
  const tail = ctx.createLinearGradient(-18, 0, 18, 48);
  tail.addColorStop(0, "#35f0cf");
  tail.addColorStop(1, "#176d91");
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(-18, -3);
  ctx.quadraticCurveTo(-14, 22, 0, 36);
  ctx.quadraticCurveTo(14, 22, 18, -3);
  ctx.closePath();
  ctx.fill();

  // scales
  ctx.globalAlpha = .3;
  ctx.strokeStyle = "#d5fff6";
  ctx.lineWidth = 1;
  for (let y = 8; y < 29; y += 7) {
    for (let x = -10; x <= 10; x += 10) {
      ctx.beginPath();
      ctx.arc(x + (y % 2 ? 4 : 0), y, 5, 0, Math.PI);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Flower center
  ctx.shadowColor = "rgba(255, 127, 177, .48)";
  ctx.shadowBlur = 18;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.sin(elapsed * 2) * .015;
    const px = Math.cos(a) * 20;
    const py = Math.sin(a) * 20;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    const petal = ctx.createLinearGradient(-12, 0, 12, 0);
    petal.addColorStop(0, "#ff8fb8");
    petal.addColorStop(1, "#ff4f8f");
    ctx.fillStyle = petal;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.shadowBlur = 10;
  ctx.fillStyle = "#ffd85e";
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#5b3d2c";
  ctx.beginPath();
  ctx.arc(-4, -2, 1.5, 0, Math.PI * 2);
  ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8b5c36";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 2, 5, .25, Math.PI - .25);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.type === "sun" ? "#ffe56d" : "#ff9ac6";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  suns.forEach(drawSun);
  obstacles.forEach(drawJelly);
  drawPlayer();
  drawParticles();
}

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - last) / 1000, .034);
  last = now;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

function setPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  player.targetX = clamp(x, 30, W - 30);
  player.targetY = clamp(y, 70, H - 85);
}

canvas.addEventListener("pointerdown", e => {
  pointer.active = true;
  canvas.setPointerCapture?.(e.pointerId);
  setPointer(e.clientX, e.clientY);
});

canvas.addEventListener("pointermove", e => {
  if (pointer.active) setPointer(e.clientX, e.clientY);
});

canvas.addEventListener("pointerup", e => {
  pointer.active = false;
  canvas.releasePointerCapture?.(e.pointerId);
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
window.addEventListener("resize", resize);

resize();
draw();
