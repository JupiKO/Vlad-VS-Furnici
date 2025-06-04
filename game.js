let MAP_WIDTH = 12000;
let MAP_HEIGHT = 12000;
let CANVAS_WIDTH = window.innerWidth;
let CANVAS_HEIGHT = window.innerHeight;

let player = {
  x: MAP_WIDTH / 2,
  y: MAP_HEIGHT / 2,
  radius: 20,
  color: 'blue',
  speed: 8, // viteza mărită
  clasa: null,
  hp: 100,
  maxHp: 100,
  respawnTimeout: null
};

let keys = {};

// Sistem de backup pentru detectarea stării tastelor - previne probleme când keyup events sunt întârziate
let keyStates = {
  w: false,
  a: false,
  s: false,
  d: false,
  arrowup: false,
  arrowdown: false,
  arrowleft: false,
  arrowright: false
};

// Timp ultimei presări pentru fiecare tastă
let lastKeyPress = {};

// Funcție pentru a verifica dacă o tastă este încă apăsată fizic
function isKeyActuallyPressed(key) {
  const now = performance.now();
  const timeSincePress = now - (lastKeyPress[key] || 0);
  
  // Dacă tasta a fost apăsată recent și nu am primit keyup, probabil e încă apăsată
  if (keys[key] && timeSincePress < 5000) { // max 5 secunde fără keyup
    return true;
  }
  
  // Dacă a trecut mult timp fără keyup, probabil s-a pierdut event-ul
  if (keys[key] && timeSincePress >= 5000) {
    keys[key] = false; // Force release
    keyStates[key] = false;
    return false;
  }
  
  return keys[key] || false;
}

// Cleanup periodic pentru taste blocate - rulează o dată pe secundă
function cleanupStuckKeys() {
  const now = performance.now();
  for (const key in lastKeyPress) {
    const timeSincePress = now - lastKeyPress[key];
    // Dacă o tastă a fost "apăsată" mai mult de 10 secunde, probabil e blocată
    if (timeSincePress > 10000 && keys[key]) {
      console.log(`Cleanup: Releasing stuck key: ${key}`);
      keys[key] = false;
      if (keyStates.hasOwnProperty(key)) {
        keyStates[key] = false;
      }
    }
  }
}

// Rulează cleanup-ul o dată pe secundă
setInterval(cleanupStuckKeys, 1000);

// Reset tastele când fereastra pierde focus-ul pentru a preveni taste blocate
window.addEventListener('blur', function() {
  // Resetează toate tastele când fereastra pierde focus-ul
  for (const key in keys) {
    keys[key] = false;
  }
  for (const key in keyStates) {
    keyStates[key] = false;
  }
  console.log('Window lost focus - resetting all keys');
});

// Reset tastele și când fereastra câștigă din nou focus-ul
window.addEventListener('focus', function() {
  // Resetează toate tastele când fereastra câștigă focus-ul
  for (const key in keys) {
    keys[key] = false;
  }
  for (const key in keyStates) {
    keyStates[key] = false;
  }
  console.log('Window gained focus - resetting all keys');
});
let terenImg = new Image();
terenImg.src = 'teren.png';

// Încarcă imaginea pentru Ion
let ionImg = new Image();
ionImg.src = 'ion.png'; // Asigură-te că fișierul ion.png există în același folder

// Încarcă imaginea pentru castel (baza principală)
let castleImg = new Image();
castleImg.src = 'castel.png'; // Asigură-te că fișierul castel.png există în același folder

// Încarcă imaginea pentru banana (proiectil)
let bananaImg = new Image();
bananaImg.src = 'banana.png'; // Asigură-te că fișierul banana.png există în același folder

// Încarcă imaginea pentru furnica1 (inamic)
let furnica1Img = new Image();
furnica1Img.src = 'furnica1.png'; // Asigură-te că fișierul furnica1.png există în același folder

// Încarcă imaginea pentru turetă struguri
let turetaStruguriImg = new Image();
turetaStruguriImg.src = 'turetastruguril1.png'; // Asigură-te că fișierul există

// Încarcă imaginea pentru strugure (proiectilul turetei struguri)
let strugureImg = new Image();
strugureImg.src = 'strugure.png'; // Asigură-te că fișierul există

// Structură pentru proiectile
let projectiles = [];
const BANANA_SPEED = 24; // viteza mai mare pentru banane
const BANANA_LIFETIME = 1200; // distanță maximă (pixeli) pe care o poate parcurge banana (de 3 ori mai mare)

// Structură pentru inamici furnica1
let enemies = [];
const ENEMY_SPAWN_INTERVAL = 7000; // 7 secunde
const ENEMY_PER_WAVE = 8;
const ENEMY_HP = 4; // Redus de la 5
const ENEMY_SPEED = 2.5; // viteza furnicii

let lastEnemySpawn = performance.now();

// Castel HP și damage
let castleHP = 200;
const CASTLE_MAX_HP = 200;
const ENEMY_DAMAGE_PER_SECOND = 5;

// Pentru damage over time la castel
let lastCastleDamageTime = performance.now();

// Game over flag
let isGameOver = false;

// Sistem de selecție mod: 'banana' sau 'tureta_struguri'
let current_mode = 'banana';

// --- Sistem bani ---
let money = 1200;

/*
  BALANCED HP SCALING SYSTEM:
  
  Old system: Math.pow(1.1, wave-1) - Exponential growth that became too difficult
  - Wave 10: ~2.59x base HP
  - Wave 20: ~6.73x base HP  
  - Wave 30: ~17.45x base HP (unplayable)
  
  New system: Math.min(1 + (wave-1) * 0.15, 4.0) - Linear growth with cap
  - Wave 10: 2.35x base HP
  - Wave 20: 3.85x base HP
  - Wave 30+: 4.0x base HP (capped)
  
  This maintains challenge progression while keeping the game playable at higher waves.
*/

// --- Sistem wave-uri ---
let currentWave = 1;
let isWaveActive = false;
let waveEnemyCount = ENEMY_PER_WAVE;
let waveEnemyHP = ENEMY_HP;
let waveEnemySpeed = ENEMY_SPEED;
let waveStartTime = performance.now();
let waveIntermission = false;
let waveIntermissionDuration = 5000; // ms între wave-uri (pauză de 5 secunde)
let nextWaveTimeout = null;

// --- GAME SPEED CONTROL ---
let gameSpeed = 1;
const gameSpeedOptions = [1, 2, 4];
let gameSpeedIndex = 0;

// Încarcă imaginea pentru baza și pistol (noua turetă)
let bazaImg = new Image();
bazaImg.src = 'baza.png';
let pistolImg = new Image();
pistolImg.src = 'pistol.png';

// Încarcă imaginea pentru mină bani (tureta mină bani)
let minabanil1Img = new Image();
minabanil1Img.src = 'minabanil1.png';

// Încarcă imaginea pentru SMG (tureta upgrade)
let smgImg = new Image();
smgImg.src = 'SMG.png';

// Încarcă imaginea pentru M4A1 (upgrade nou)
let m4a1Img = new Image();
m4a1Img.src = 'M4A1.png';

// --- NOU: Imagine și constante pentru Gândac Verde ---
let gandacverdeImg = new Image();
gandacverdeImg.src = 'gandacverde.png'; // Asigură-te că ai o imagine gandacverde.png

const GANDACVERDE_BASE_HP = 80; // Redus de la 100
const GANDACVERDE_BASE_SPEED = 1.6; // Mai lent decât furnicile (care au 2.5)
const GANDACVERDE_MONEY_REWARD = 75; // Crescut de la 50
const GANDACVERDE_PLACEHOLDER_RADIUS = 12; // Pentru desenarea placeholder-ului

// --- CONSTANTE UPGRADE SMG ---
const SMG_ATTACKSPEED = 8; // atacuri pe secundă pentru SMG

// Constante pentru albină
const ALBINA_BASE_HP = 5; // Redus de la 6
const ALBINA_BASE_SPEED = 5.5; // Mai rapidă decât furnica (2.5)
const ALBINA_MONEY_REWARD = 55; // Crescut de la 35
const ALBINA_PLACEHOLDER_RADIUS = 3; // Și mai mică decât înainte
const ALBINA_ATTACK_RANGE = 120; // Distanța de atac
const ALBINA_ATTACK_DAMAGE = 12; // Mărit de la 8 la 15 pentru mai mult damage
const ALBINA_ATTACK_COOLDOWN = 1200; // ms între atacuri
const ALBINA_ZIGZAG_AMPLITUDE = 80; // Amplitudinea mișcării zigzag
const ALBINA_ZIGZAG_FREQUENCY = 0.02; // Frecvența mișcării zigzag

// Încarcă imaginea pentru albină
let albinaImg = new Image();
albinaImg.src = 'albina.png';

// --- NOU: Imagine și constante pentru Greier ---
let greierImg = new Image();
greierImg.src = 'greier.png'; // Asigură-te că ai o imagine greier.png

const GREIER_BASE_HP = 6; // Redus de la 8
const GREIER_BASE_SPEED = 3.5; // Mai rapid decât furnica (2.5)
const GREIER_MONEY_REWARD = 45; // Crescut de la 30
const GREIER_PLACEHOLDER_RADIUS = 9; // Puțin mai mare decât furnica
const GREIER_DAMAGE_PER_SECOND = 6; // Mai mult decât furnica (5)
const GREIER_JUMP_COOLDOWN = 2000; // ms între sărituri
const GREIER_JUMP_DISTANCE = 200; // distanța săriturii

// --- NOU: Imagine și constante pentru Libelula și Mazga ---
let libelulaImg = new Image();
libelulaImg.src = 'libelula.png'; // Asigură-te că ai o imagine libelula.png
let mazgaImg = new Image();
mazgaImg.src = 'mazga.png'; // Asigură-te că ai o imagine mazga.png

// --- NOU: Imagine și constante pentru Heroticbeetle ---
let heroticbeetleImg = new Image();
heroticbeetleImg.src = 'heroticbeetle.png';

const HEROTICBEETLE_BASE_HP = 800; // Redus de la 1000
const HEROTICBEETLE_BASE_SPEED = 0.8; // Mult mai lent (redus de la 1.2)
const HEROTICBEETLE_MONEY_REWARD = 300; // Crescut de la 200
const HEROTICBEETLE_PLACEHOLDER_RADIUS = 22; // Mult mai mare (crescut de la 16)
const HEROTICBEETLE_DAMAGE_PER_SECOND = 20; // 20 damage pe secundă la turete
const HEROTICBEETLE_ATTACK_RANGE = 120; // Range de atac pentru turete (crescut de la 50)

// --- NOU: Global Volume Control ---
let masterVolume = 0.5; // Default volume at 50%
let initialVolumes = {}; // To store original volumes of sounds
let isSettingsMenuOpen = false;
let settingsIconImg = new Image();
settingsIconImg.src = 'settings_icon.png'; // Ensure you have this image

const LIBELULA_BASE_HP = 10; // Redus de la 13
const LIBELULA_BASE_SPEED = 5.0; // Medie-rapidă
const LIBELULA_MONEY_REWARD = 150; // Crescut de la 100
const LIBELULA_PLACEHOLDER_RADIUS = 13;
const LIBELULA_ATTACK_RANGE = 520; // Range mare
const LIBELULA_ATTACK_DAMAGE = 10; // Damage redus per mazga (scăzut de la 14)
const LIBELULA_ATTACK_COOLDOWN = 1500; // ms între atacuri
const LIBELULA_ZIGZAG_AMPLITUDE = 100;
const LIBELULA_ZIGZAG_FREQUENCY = 0.012;

// Proiectil mazga
const MAZGA_SPEED = 12;
const MAZGA_SLOW_DURATION = 1600; // ms slow
const MAZGA_SLOW_FACTOR = 0.5; // Încetinește cu 50%

// Încarcă imaginea pentru P90 (tureta upgrade final)
let p90Img = new Image();
p90Img.src = 'P90.png';

// --- CONSTANTE UPGRADE P90 ---
const P90_ATTACKSPEED = 20; // atacuri pe secundă pentru P90
const P90_DAMAGE = 1.1;
const P90_RANGE = 450;
const P90_UPGRADE_COST = 1200;

// --- CONSTANTE UPGRADE M4A1 ---
const M4A1_ATTACKSPEED = 10; // atacuri pe secundă pentru M4A1
const M4A1_DAMAGE = 1.8;
const M4A1_RANGE = 650;
const M4A1_UPGRADE_COST = 1500;

// Încarcă imaginea pentru Shotgun (upgrade nou)
let shotgunImg = new Image();
shotgunImg.src = 'shotgun.png';

// --- CONSTANTE UPGRADE SHOTGUN ---
const SHOTGUN_ATTACKSPEED = 1; // atacuri pe secundă pentru Shotgun
const SHOTGUN_DAMAGE = 2.3;
const SHOTGUN_RANGE = 400;
const SHOTGUN_UPGRADE_COST = 400;

// Încarcă imaginea pentru Heavy Shotgun (upgrade nou)
let heavyshotgunImg = new Image();
heavyshotgunImg.src = 'heavyshotgun.png';

// --- CONSTANTE UPGRADE HEAVY SHOTGUN ---
const HEAVYSHOTGUN_ATTACKSPEED = 0.67; // 1 foc la 1.5 secunde
const HEAVYSHOTGUN_DAMAGE = 6;
const HEAVYSHOTGUN_RANGE = 400;
const HEAVYSHOTGUN_PROJECTILES = 9;
const HEAVYSHOTGUN_UPGRADE_COST = 1400;

// Încarcă imaginea pentru Fast Shotgun (upgrade nou)
let fastshotgunImg = new Image();
fastshotgunImg.src = 'fastshotgun.png';

// --- CONSTANTE UPGRADE FAST SHOTGUN ---
const FASTSHOTGUN_ATTACKSPEED = 2; // atacuri pe secundă
const FASTSHOTGUN_DAMAGE = 2.5;
const FASTSHOTGUN_RANGE = 400;
const FASTSHOTGUN_PROJECTILES = 5;
const FASTSHOTGUN_UPGRADE_COST = 1200;
const SHOTGUNSHOT_POOL_SIZE = 8;
let shotgunshotPool = [];
let shotgunshotPoolIndex = 0;
for (let i = 0; i < SHOTGUNSHOT_POOL_SIZE; i++) {
  let a = new Audio('shotgunshot.mp3');
  initialVolumes['shotgunshot'] = 0.17;
  a.volume = initialVolumes['shotgunshot'] * masterVolume;
  a.preload = 'auto';
  shotgunshotPool.push(a);
}

const HEAVYSHOTGUNSHOT_POOL_SIZE = 8;
let heavyshotgunshotPool = [];
let heavyshotgunshotPoolIndex = 0;
for (let i = 0; i < HEAVYSHOTGUNSHOT_POOL_SIZE; i++) {
  let a = new Audio('heavyshotgunshot.mp3');
  initialVolumes['heavyshotgunshot'] = 0.17;
  a.volume = initialVolumes['heavyshotgunshot'] * masterVolume;
  a.preload = 'auto';
  heavyshotgunshotPool.push(a);
}

function resizeCanvas() {
  const canvas = document.getElementById('gameCanvas');
  CANVAS_WIDTH = window.innerWidth;
  CANVAS_HEIGHT = window.innerHeight;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
}

window.addEventListener('resize', resizeCanvas);

// --- SUNET DE FUNDAL AMBIENT ---
let ambientAudio = new Audio('ambient.mp3');
ambientAudio.loop = true;
initialVolumes['ambient'] = 1; // Store initial intended volume
ambientAudio.volume = initialVolumes['ambient'] * masterVolume; // Apply master volume
ambientAudio.preload = 'auto';

// Înlocuiește funcția selectClass cu selectDifficulty
function selectDifficulty(difficulty) {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';

  // Asigură-te că canvas-ul are dimensiuni corecte înainte de gameLoop
  resizeCanvas();

  // Pornește sunetul de fundal dacă nu rulează deja
  if (ambientAudio.paused) {
    try { ambientAudio.currentTime = 0; ambientAudio.play(); } catch (e) {}
  }

  // Pornește gameLoop doar după ce terenImg este încărcat
  if (terenImg.complete && terenImg.naturalWidth !== 0) {
    requestAnimationFrame(gameLoop);
  } else {
    terenImg.onload = () => {
      requestAnimationFrame(gameLoop);
    };
    terenImg.onerror = () => {
      // fallback: pornește oricum gameLoop dacă imaginea nu se încarcă
      requestAnimationFrame(gameLoop);
    };
  }
}

function drawPlayer(ctx, offsetX, offsetY) {
  // Desenează imaginea lui Ion doar dacă e viu
  if (player.hp > 0) {
    if (ionImg.complete && ionImg.naturalWidth !== 0) {
      const scale = 0.07;
      const imgWidth = ionImg.naturalWidth * scale;
      const imgHeight = ionImg.naturalHeight * scale;
      ctx.drawImage(
        ionImg,
        player.x - offsetX - imgWidth / 2,
        player.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Desenează banana în centrul lui Ion, orientată fix (nu spre mouse)
      if (bananaImg.complete && bananaImg.naturalWidth !== 0) {
        const bananaScale = 0.06;
        const bananaWidth = bananaImg.naturalWidth * bananaScale;
        const bananaHeight = bananaImg.naturalHeight * bananaScale;
        ctx.save();
        ctx.translate(player.x - offsetX, player.y - offsetY);
        // Nu rotim banana, o lăsăm verticală
        ctx.drawImage(bananaImg, -bananaWidth / 2, -bananaHeight / 2, bananaWidth, bananaHeight);
        ctx.restore();
      }
    } else {
      ctx.beginPath();
      ctx.arc(player.x - offsetX, player.y - offsetY, player.radius, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.closePath();
    }
    // Bara de HP ca la furnica/castel, dar mai sus
    ctx.save();
    ctx.fillStyle = 'red';
    ctx.fillRect(player.x - offsetX - 30, player.y - offsetY - 150, 60, 8);
    ctx.fillStyle = 'lime';
    ctx.fillRect(player.x - offsetX - 30, player.y - offsetY - 150, 60 * (player.hp / player.maxHp), 8);
    ctx.strokeStyle = '#222';
    ctx.strokeRect(player.x - offsetX - 30, player.y - offsetY - 150, 60, 8);
    ctx.restore();
  }
}

// Funcția pentru desenarea castelului
function drawCastle(ctx, offsetX, offsetY) {
  if (castleImg.complete && castleImg.naturalWidth !== 0) {
    const castleX = MAP_WIDTH / 2;
    const castleY = MAP_HEIGHT / 2;
    const scale = 0.065; // mai mic decât înainte (ex: era 0.13)
    const imgWidth = castleImg.naturalWidth * scale;
    const imgHeight = castleImg.naturalHeight * scale;
    ctx.drawImage(
      castleImg,
      castleX - offsetX - imgWidth / 2,
      castleY - offsetY - imgHeight / 2,
      imgWidth,
      imgHeight
    );
    // Elimin desenarea barei de HP de aici
  }
}

// Funcție nouă: desenează bara de HP a castelului pe ultimul layer
function drawCastleHPBar(ctx, offsetX, offsetY) {
  const castleX = MAP_WIDTH / 2;
  const castleY = MAP_HEIGHT / 2;
  const scale = 0.065;
  const imgHeight = castleImg.naturalHeight * scale;
  ctx.save();
  ctx.fillStyle = 'red';
  ctx.fillRect(
    castleX - offsetX - 50,
    castleY - offsetY - imgHeight / 2 - 20,
    100,
    10
  );
  ctx.fillStyle = 'lime';
  ctx.fillRect(
    castleX - offsetX - 50,
    castleY - offsetY - imgHeight / 2 - 20,
    100 * (castleHP / CASTLE_MAX_HP),
    10
  );
  ctx.strokeStyle = '#222';
  ctx.strokeRect(
    castleX - offsetX - 50,
    castleY - offsetY - imgHeight / 2 - 20,
    100,
    10
  );
  ctx.restore();
}

function updatePlayer() {
  if (player.hp <= 0 || player.respawnTimeout) {
    return; 
  }

  // Slow effect de la mazga
  let speed = player.speed;
  if (player.slowUntil && performance.now() < player.slowUntil) {
    speed *= player.slowFactor || 1;
  }

  // Resetăm viteza la fiecare frame
  let moveX = 0;
  let moveY = 0;
  
  // Calculăm direcția de mișcare bazată pe tastele apăsate - folosim sistemul îmbunătățit
  if (isKeyActuallyPressed('w') || isKeyActuallyPressed('arrowup')) moveY -= speed;
  if (isKeyActuallyPressed('s') || isKeyActuallyPressed('arrowdown')) moveY += speed;
  if (isKeyActuallyPressed('a') || isKeyActuallyPressed('arrowleft')) moveX -= speed;
  if (isKeyActuallyPressed('d') || isKeyActuallyPressed('arrowright')) moveX += speed;
  
  // Debug: afișează starea tastelor doar dacă se mișcă playerul (pentru a evita spam-ul)
  if (moveX !== 0 || moveY !== 0) {
    const pressedKeys = [];
    if (isKeyActuallyPressed('w')) pressedKeys.push('W');
    if (isKeyActuallyPressed('a')) pressedKeys.push('A');
    if (isKeyActuallyPressed('s')) pressedKeys.push('S');
    if (isKeyActuallyPressed('d')) pressedKeys.push('D');
    
    // Afișează doar la fiecare 60 de frame-uri (1 secundă la 60fps) pentru a evita spam-ul
    if (performance.now() % 1000 < 16) {
      console.log(`Player moving with keys: ${pressedKeys.join(', ')} | Move: (${moveX.toFixed(1)}, ${moveY.toFixed(1)})`);
    }
  }
  
  // Normalizăm mișcarea diagonală
  if (moveX !== 0 && moveY !== 0) {
    const factor = 1 / Math.sqrt(2);
    moveX *= factor;
    moveY *= factor;
  }
  
  // Aplicăm mișcarea
  let newX = player.x + moveX;
  let newY = player.y + moveY;

  if (isNaN(newX) || isNaN(newY)) {
    console.error("ERROR: newX or newY is NaN in updatePlayer!", {px: player.x, py: player.y, mx: moveX, my: moveY});
    return; 
  }
  player.x = newX;
  player.y = newY;
  
  // Limitează la marginea hărții
  player.x = Math.max(player.radius, Math.min(MAP_WIDTH - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(MAP_HEIGHT - player.radius, player.y));

  if (isNaN(player.x) || isNaN(player.y)) {
    console.error("ERROR: player.x or player.y became NaN after boundary check!", {px_before: newX, py_before: newY});
    // Reset to center if coordinates become NaN after boundary checks
    player.x = MAP_WIDTH / 2; 
    player.y = MAP_HEIGHT / 2;
  }
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.x += p.dirX * BANANA_SPEED;
    p.y += p.dirY * BANANA_SPEED;
    p.traveled += BANANA_SPEED;
    if (p.traveled > BANANA_LIFETIME) {
      projectiles.splice(i, 1);
    }
  }
}

function drawProjectiles(ctx, offsetX, offsetY) {
  for (const p of projectiles) {
    if (bananaImg.complete && bananaImg.naturalWidth !== 0) {
      const scale = 0.05; // bananele sunt și mai mici acum
      const imgWidth = bananaImg.naturalWidth * scale;
      const imgHeight = bananaImg.naturalHeight * scale;
      ctx.save();
      // Rotim banana în direcția de tragere
      ctx.translate(p.x - offsetX, p.y - offsetY);
      ctx.rotate(Math.atan2(p.dirY, p.dirX));
      ctx.drawImage(bananaImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    } else {
      // fallback: desen simplu
      ctx.beginPath();
      ctx.arc(p.x - offsetX, p.y - offsetY, 5, 0, Math.PI * 2); // cerc mai mic
      ctx.fillStyle = 'yellow';
      ctx.fill();
      ctx.closePath();
    }
  }
}

// Variabile pentru hover grid
let hoveredGrid = { x: null, y: null };

// Variabilă pentru turetă selectată
let selectedTurret = null;

// Add mousemove event listener to track mouse position
window.addEventListener('mousemove', function(e) {
  const canvas = document.getElementById('gameCanvas');
  const rect = canvas.getBoundingClientRect();
  lastMouseX = e.clientX - rect.left;
  lastMouseY = e.clientY - rect.top;

  // Existing hover grid logic
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Offsetul camerei
  let offsetX = Math.max(0, Math.min(player.x - CANVAS_WIDTH / 2, MAP_WIDTH - CANVAS_WIDTH));
  let offsetY = Math.max(0, Math.min(player.y - CANVAS_HEIGHT / 2, MAP_HEIGHT - CANVAS_HEIGHT));

  // Poziția reală a mouse-ului pe hartă
  const realX = mouseX + offsetX;
  const realY = mouseY + offsetY;

  // Coordonatele pătrățelului grid
  hoveredGrid.x = Math.floor(realX / 40);
  hoveredGrid.y = Math.floor(realY / 40);
});

// Plasare turetă cu click dreapta
window.addEventListener('contextmenu', function(e) {
  e.preventDefault(); // Keep this synchronous

  // Defer the rest of the logic to prevent blocking keyboard events
  requestAnimationFrame(() => {
    const canvas = document.getElementById('gameCanvas');
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Offsetul camerei
    let offsetX = Math.max(0, Math.min(player.x - CANVAS_WIDTH / 2, MAP_WIDTH - CANVAS_WIDTH));
    let offsetY = Math.max(0, Math.min(player.y - CANVAS_HEIGHT / 2, MAP_HEIGHT - CANVAS_HEIGHT));

    // Poziția reală a mouse-ului pe hartă
    const realX = mouseX + offsetX;
    const realY = mouseY + offsetY;

    // Grid-ul pe care s-a dat click (acesta va fi centrul turetei)
    const centerGridX = Math.floor(realX / 40);
    const centerGridY = Math.floor(realY / 40);

    // --- Selectare tureta cu click dreapta ---
    let foundTurret = null;
    for (const turret of turrets) {
      // Verifică dacă mouse-ul este peste imaginea turetei
      if (
        turret.type !== 'wall' && turret.type !== 'wall2' && // Regular turrets
        realX >= turret.x - 60 && realX <= turret.x + 60 &&
        realY >= turret.y - 60 && realY <= turret.y + 60
      ) {
        foundTurret = turret;
        break;
      } else if ((turret.type === 'wall' || turret.type === 'wall2') && // Walls (40x40 px)
        realX >= turret.x - 20 && realX <= turret.x + 20 &&
        realY >= turret.y - 20 && realY <= turret.y + 20
      ) {
        foundTurret = turret;
        break;
      }
    }
    if (foundTurret) {
      selectedTurret = foundTurret;
      return; // Nu mai plasa tureta nouă dacă ai selectat una
    } else {
      selectedTurret = null;
    }

    // If right-click and in wall mode, try to place a single wall (for tap-click)
    // Continuous placement is handled in gameLoop
    if (current_mode === 'wall') {
      tryPlaceWall(centerGridX, centerGridY);
      return; // Important: prevent other placement logic if in wall mode
    }

    if (current_mode === 'tureta_bazapistol') {
      if (money < 100) {
        console.log('Nu ai destui bani pentru tureta bază+pistol!');
        return;
      }
      // Blochează plasarea dacă oricare pătrat din 3x3 e ocupat sau dacă orice parte atinge zona interzisă
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (isGridOccupied(centerGridX + dx, centerGridY + dy)) {
            console.log('Nu se poate plasa tureta: pătratul este deja ocupat.');
            return;
          }
        }
      }
      if (doesTurretOverlapNoZone(centerGridX, centerGridY)) {
        console.log('Nu se poate plasa tureta: prea aproape de castel (zona roșie).');
        return;
      }
      // Plasează tureta și marchează 9 pătrate
      turrets.push({
        gridX: centerGridX,
        gridY: centerGridY,
        x: (centerGridX + 0.5) * 40,
        y: (centerGridY + 0.5) * 40,
        lastShot: 0,
        type: 'tureta_bazapistol',
        occupiedGrids: [],
        hp: 50,
        maxHp: 50
      });
      
      // Play tower placement sound
      let towerplaceAudio = towerplacePool[towerplacePoolIndex];
      try { towerplaceAudio.currentTime = 0; towerplaceAudio.play(); } catch (e) {}
      towerplacePoolIndex = (towerplacePoolIndex + 1) % TOWERPLACE_POOL_SIZE;
      // Marchează pătratele ocupate (3x3 grid)
      const turret = turrets[turrets.length - 1];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          turret.occupiedGrids.push({
            gridX: centerGridX + dx,
            gridY: centerGridY + dy
          });
        }
      }
      money -= 100;
    } else if (current_mode === 'tureta_minabani') {
      if (money < 200) {
        console.log('Nu ai destui bani pentru tureta mină bani!');
        return;
      }
      // Blochează plasarea dacă oricare pătrat din 3x3 e ocupat sau dacă orice parte atinge zona interzisă
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (isGridOccupied(centerGridX + dx, centerGridY + dy)) {
            console.log('Nu se poate plasa tureta: pătratul este deja ocupat.');
            return;
          }
        }
      }
      if (doesTurretOverlapNoZone(centerGridX, centerGridY)) {
        console.log('Nu se poate plasa tureta: prea aproape de castel (zona roșie).');
        return;
      }
      // Plasează tureta și marchează 9 pătrate
      turrets.push({
        gridX: centerGridX,
        gridY: centerGridY,
        x: (centerGridX + 0.5) * 40,
        y: (centerGridY + 0.5) * 40,
        lastGenerated: performance.now(),
        type: 'tureta_minabani',
        occupiedGrids: [],
        hp: 30,
        maxHp: 30
      });
      
      // Play tower placement sound
      let towerplaceAudio = towerplacePool[towerplacePoolIndex];
      try { towerplaceAudio.currentTime = 0; towerplaceAudio.play(); } catch (e) {}
      towerplacePoolIndex = (towerplacePoolIndex + 1) % TOWERPLACE_POOL_SIZE;
      // Marchează pătratele ocupate (3x3 grid)
      const turret = turrets[turrets.length - 1];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          turret.occupiedGrids.push({
            gridX: centerGridX + dx,
            gridY: centerGridY + dy
          });
        }
      }
      money -= 200; // Deduct money for placing the mine
    } else if (current_mode === 'wall') {
      // Attempt to place a single wall on right click
      tryPlaceWall(centerGridX, centerGridY);
      return; // Exit after attempting wall placement
    }
  });
});

function tryPlaceWall(centerGridX, centerGridY) {
  if (current_mode !== 'wall') return false; // Only place if in wall mode
  if (money < WALL_COST) {
    console.log('Nu ai destui bani pentru zid!');
    return false;
  }
  // Blochează plasarea dacă pătratul e ocupat sau atinge zona interzisă
  if (isGridOccupied(centerGridX, centerGridY) || isInNoTurretZone(centerGridX, centerGridY)) {
    // console.log('Nu se poate plasa zidul: pătratul este deja ocupat sau prea aproape de castel.'); // Optional: reduce console spam
    return false;
  }
  turrets.push({
    gridX: centerGridX,
    gridY: centerGridY,
    x: (centerGridX + 0.5) * 40,
    y: (centerGridY + 0.5) * 40,
    type: isWall2Unlocked ? 'wall2' : 'wall',
    occupiedGrids: [{ gridX: centerGridX, gridY: centerGridY }],
    hp: isWall2Unlocked ? WALL2_HP : WALL_HP,
    maxHp: isWall2Unlocked ? WALL2_HP : WALL_HP
  });
  
  // Play tower placement sound
  let towerplaceAudio = towerplacePool[towerplacePoolIndex];
  try { towerplaceAudio.currentTime = 0; towerplaceAudio.play(); } catch (e) {}
  towerplacePoolIndex = (towerplacePoolIndex + 1) % TOWERPLACE_POOL_SIZE;
  
  money -= WALL_COST;
  lastWallPlacementTime = performance.now(); // Update last placement time
  return true;
}

// --- CLICK HANDLING UNIFICAT ---
let lastBananaShot = 0; // cooldown pentru tragere banana
const BANANA_SHOOT_COOLDOWN = 167; // ms (6 banane pe secundă)

// Add after other global variables
let isLeftMouseButtonDown = false;
let isRightMouseButtonDown = false; // For continuous wall placement
let lastWallPlacementTime = 0; // For continuous wall placement cooldown
const WALL_PLACEMENT_COOLDOWN = 150; // ms between wall placements when holding RMB

// Replace the mousedown event listener with these two event listeners
window.addEventListener('mousedown', function(e) {
  if (e.button === 0) { // Left mouse button
    isLeftMouseButtonDown = true;
  } else if (e.button === 2) { // Right mouse button
    isRightMouseButtonDown = true;
    // For single right-click actions like selecting or placing one turret
    // we still call processMouseClick, but the continuous logic will be in gameLoop
    // processMouseClick(e); // This was for context menu, let contextmenu handle its part
  }
  // Process left clicks or other non-continuous right-click actions immediately
  if (e.button === 0) {
      processMouseClick(e);
  }
});

window.addEventListener('mouseup', function(e) {
  if (e.button === 0) { // Left mouse button
    isLeftMouseButtonDown = false;
  } else if (e.button === 2) { // Right mouse button
    isRightMouseButtonDown = false;
  }
});
function processMouseClick(e) {
  const canvas = document.getElementById('gameCanvas');
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  let offsetX = Math.max(0, Math.min(player.x - CANVAS_WIDTH / 2, MAP_WIDTH - CANVAS_WIDTH));
  let offsetY = Math.max(0, Math.min(player.y - CANVAS_HEIGHT / 2, MAP_HEIGHT - CANVAS_HEIGHT));

  // --- NOU: Handle clicks for Settings Menu first ---
  if (isSettingsMenuOpen) {
    const menuWidth = 540; // Matches drawSettingsMenu
    const menuHeight = 420; // Matches drawSettingsMenu
    const menuX = CANVAS_WIDTH / 2 - menuWidth / 2;
    const menuY = CANVAS_HEIGHT / 2 - menuHeight / 2;

    // Close Button (Top Right of Menu)
    const closeBtnSize = 45; // Matches drawSettingsMenu
    const closeBtnX = menuX + menuWidth - closeBtnSize - 20; // Matches drawSettingsMenu
    const closeBtnY = menuY + 20; // Matches drawSettingsMenu
    if (
      mouseX >= closeBtnX && mouseX <= closeBtnX + closeBtnSize &&
      mouseY >= closeBtnY && mouseY <= closeBtnY + closeBtnSize &&
      e.button === 0
    ) {
      isSettingsMenuOpen = false;
      return; // Click handled
    }

    // Volume Bar and Buttons (recalculate positions based on drawSettingsMenu logic)
    const volumeBarWidth = menuWidth - 220;
    const volumeBarHeight = 40;
    const volumeBarX = menuX + (menuWidth - volumeBarWidth) / 2;
    const volumeBarY = menuY + 220; // MOVED FURTHER DOWN to match drawSettingsMenu
    
    const btnSize = 50; // Matches drawSettingsMenu for +/- buttons
    const btnY = volumeBarY + (volumeBarHeight - btnSize) / 2;
    const minusBtnX = volumeBarX - btnSize - 20;
    const plusBtnX = volumeBarX + volumeBarWidth + 20;

    // Minus Button
    if (
      mouseX >= minusBtnX && mouseX <= minusBtnX + btnSize &&
      mouseY >= btnY && mouseY <= btnY + btnSize &&
      e.button === 0
    ) {
      adjustMasterVolume(masterVolume - 0.1);
      return; // Click handled
    }

    // Plus Button
    if (
      mouseX >= plusBtnX && mouseX <= plusBtnX + btnSize &&
      mouseY >= btnY && mouseY <= btnY + btnSize &&
      e.button === 0
    ) {
      adjustMasterVolume(masterVolume + 0.1);
      return; // Click handled
    }
    
    // If click is inside the settings menu but not on a button, consume the click
    if (
      mouseX >= menuX && mouseX <= menuX + menuWidth &&
      mouseY >= menuY && mouseY <= menuY + menuHeight &&
      e.button === 0
    ) {
        return; // Click consumed by settings menu
    }
  }

  // --- NOU: Check click on settings icon ---
  const iconSize = 48;
  const margin = 20;
  const settingsIconX = CANVAS_WIDTH - iconSize - margin;
  const settingsIconY = margin;
  if (
    mouseX >= settingsIconX && mouseX <= settingsIconX + iconSize &&
    mouseY >= settingsIconY && mouseY <= settingsIconY + iconSize &&
    e.button === 0
  ) {
    isSettingsMenuOpen = !isSettingsMenuOpen;
    return; // Click handled
  }

  // 1. Verifică click pe butonul de viteză (stânga jos)
  const speedBtnWidth = 120;
  const speedBtnHeight = 48;
  const speedBtnMargin = 18;
  const speedBtnX = speedBtnMargin;
  const speedBtnY = CANVAS_HEIGHT - speedBtnHeight - speedBtnMargin;
  if (
    mouseX >= speedBtnX && mouseX <= speedBtnX + speedBtnWidth &&
    mouseY >= speedBtnY && mouseY <= speedBtnY + speedBtnHeight &&
    e.button === 0
  ) {
    gameSpeedIndex = (gameSpeedIndex + 1) % gameSpeedOptions.length;
    gameSpeed = gameSpeedOptions[gameSpeedIndex];
    return;
  }

  // 1.5. Verifică click pe butonul de skip waves (dreapta butonului de viteză)
  const skipBtnWidth = 140;
  const skipBtnHeight = 48;
  const skipBtnMargin = 18;
  const skipBtnX = skipBtnMargin + speedBtnWidth + 10; // Position to the right of speed button
  const skipBtnY = CANVAS_HEIGHT - skipBtnHeight - skipBtnMargin;
  if (
    mouseX >= skipBtnX && mouseX <= skipBtnX + skipBtnWidth &&
    mouseY >= skipBtnY && mouseY <= skipBtnY + skipBtnHeight &&
    e.button === 0
  ) {
    skipWaves();
    return;
  }

  // 2. Verifică click pentru upgrade/sell în meniul din stânga (drawUpgradeMenu context)
  if (selectedTurret && selectedTurret.type === 'tureta_bazapistol') {
    const upgradeMenuX = 20;
    const upgradeMenuY = 100;
    const upgradeButtonX = upgradeMenuX + 40;
    const upgradeButtonY = upgradeMenuY + 215;
    const upgradeButtonWidth = 220; // menuWidth - 80
    const upgradeButtonHeight = 54;

    // Verifică click pe butonul SELL din meniul lateral stanga
    const sellMenuX = 20;
    const sellMenuY = 100;
    const sellMenuWidth = 300;
    const sellMenuHeight = 710; // Potrivește cu menuHeight din drawUpgradeMenu
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = sellMenuX + (sellMenuWidth - sellBtnWidth) / 2;
    const sellBtnY = sellMenuY + sellMenuHeight - sellBtnHeight - 40;

    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = 0;
      if (selectedTurret.type === 'tureta_bazapistol') sellPrice = Math.floor(0.7 * 100);
      else if (selectedTurret.type === 'tureta_minabani') sellPrice = Math.floor(0.7 * 200);
      else if (selectedTurret.type === 'tureta_smg') sellPrice = Math.floor(0.7 * 300);
      else if (selectedTurret.type === 'tureta_p90') sellPrice = 1120;
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }

    // Click pe butonul de UPGRADE din meniul lateral stanga
    if (
      mouseX >= upgradeButtonX &&
      mouseX <= upgradeButtonX + upgradeButtonWidth &&
      mouseY >= upgradeButtonY &&
      mouseY <= upgradeButtonY + upgradeButtonHeight &&
      e.button === 0
    ) {
      if (money >= 300) { // Cost upgrade SMG
        selectedTurret.type = 'tureta_smg';
        selectedTurret.hp = 65; // SMG HP
        selectedTurret.maxHp = 65; // SMG MaxHP
        money -= 300;
      }
      return; // Important: S-a interacționat cu meniul
    }
    // --- Shotgun upgrade button ---
    const shotgunButtonY = upgradeButtonY + upgradeButtonHeight + 138; // Ajustat Y pentru a se potrivi cu drawUpgradeMenu
    if (
      mouseX >= upgradeButtonX &&
      mouseX <= upgradeButtonX + upgradeButtonWidth &&
      mouseY >= shotgunButtonY &&
      mouseY <= shotgunButtonY + upgradeButtonHeight &&
      e.button === 0
    ) {
      if (money >= 400) { // Cost upgrade Shotgun
        selectedTurret.type = 'tureta_shotgun';
        selectedTurret.hp = 80;
        selectedTurret.maxHp = 80;
        money -= 400;
      }
      return;
    }
    // --- Heavy Shotgun upgrade button ---
    const heavyshotgunButtonY = shotgunButtonY + upgradeButtonHeight + 138;
    if (
      mouseX >= upgradeButtonX &&
      mouseX <= upgradeButtonX + upgradeButtonWidth &&
      mouseY >= heavyshotgunButtonY &&
      mouseY <= heavyshotgunButtonY + upgradeButtonHeight &&
      e.button === 0
    ) {
      if (money >= HEAVYSHOTGUN_UPGRADE_COST) {
        selectedTurret.type = 'tureta_heavyshotgun';
        selectedTurret.hp = 100;
        selectedTurret.maxHp = 100; // Corrected typo from selectedTurrot
        money -= HEAVYSHOTGUN_UPGRADE_COST;
      }
      return;
    }
  }

  // 3. Verifică click pe butonul SELL sub turetă
  if (selectedTurret) {
    const sellX = selectedTurret.x - offsetX;
    const sellY = selectedTurret.y - offsetY + (selectedTurret.type === 'wall' || selectedTurret.type === 'wall2' ? 30 : 80); // Adjust Y for wall sell button
    const distSell = Math.sqrt((mouseX - sellX) ** 2 + (mouseY - sellY) ** 2);
    if (distSell <= 28 && e.button === 0) {
      let sellPrice = 0;
      if (selectedTurret.type === 'tureta_bazapistol') sellPrice = Math.floor(0.7 * 100);
      else if (selectedTurret.type === 'tureta_minabani') sellPrice = Math.floor(0.7 * 200);
      else if (selectedTurret.type === 'tureta_smg') sellPrice = Math.floor(0.7 * 300);
      else if (selectedTurret.type === 'tureta_p90') sellPrice = 1120;
      else if (selectedTurret.type === 'tureta_m4a1') sellPrice = 1050;
      else if (selectedTurret.type === 'wall') sellPrice = Math.floor(0.7 * WALL_COST);
      else if (selectedTurret.type === 'wall2') sellPrice = 10; // Sell price for wall2

      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      money += sellPrice;
      selectedTurret = null;
      return;
    }
  }

  // 4. Verifică click pe minele de bani
  for (const turret of turrets) {
    if (turret.type === 'tureta_minabani' && isMouseOverMoneyMine(mouseX, mouseY, turret, offsetX, offsetY) && e.button === 0) {
      // console.log('Money mine clicked:', turret); // Logica din listener-ul de la linia 2239
      // Add any specific interaction logic here if needed, otherwise just return.
      return; // Previne tragerea bananei dacă se dă click pe mină
    }
  }

  // 5. Verifică click pe meniul lateral
  const menuWidth = 120;
  const menuHeight = 520; // Sincronizat cu drawSideSelectionMenu
  const x = CANVAS_WIDTH - menuWidth - 32;
  const y = CANVAS_HEIGHT / 2 - menuHeight / 2;

  // Buton Banana
  if (
    mouseX >= x + 18 && mouseX <= x + menuWidth - 18 &&
    mouseY >= y + 38 && mouseY <= y + 38 + 90
  ) {
    current_mode = 'banana';
    return;
  }
  // Buton Gun
  if (
    mouseX >= x + 18 && mouseX <= x + menuWidth - 18 &&
    mouseY >= y + 160 && mouseY <= y + 160 + 90
  ) {
    current_mode = 'tureta_bazapistol';
    return;
  }
  // Buton Money Mine
  if (
    mouseX >= x + 18 && mouseX <= x + menuWidth - 18 &&
    mouseY >= y + 282 && mouseY <= y + 282 + 90
  ) {
    current_mode = 'tureta_minabani';
    return;
  }
  // Buton Wall
  if (
    mouseX >= x + 18 && mouseX <= x + menuWidth - 18 &&
    mouseY >= y + 404 && mouseY <= y + 404 + 90
  ) {
    current_mode = 'wall';
    return;
  }

  // 6. Click stânga pentru tragere banana
  if (e.button === 0) {
    
    // Nu trage dacă playerul e mort sau în respawn
    if (player.hp <= 0 || player.respawnTimeout) {
      return;
    }
    // --- COOLDOWN pentru tragere banana ---
    const now = performance.now();
    if (now - lastBananaShot < BANANA_SHOOT_COOLDOWN) {
      return;
    }
    lastBananaShot = now;
    // Nu mai face selectedTurret = null aici!
    shootBanana(e);
  }

  // Handler pentru upgrade la P90 (trebuie sa fie inainte de orice return din handlerul pentru tureta_bazapistol)
  if (selectedTurret && selectedTurret.type === 'tureta_smg') {
    const upgradeMenuX = 20;
    const upgradeMenuY = 100;
    const upgradeButtonX = upgradeMenuX + 40;
    const upgradeButtonY = upgradeMenuY + 215;
    const upgradeButtonWidth = 220;
    const upgradeButtonHeight = 54;
    if (
      mouseX >= upgradeButtonX &&
      mouseX <= upgradeButtonX + upgradeButtonWidth &&
      mouseY >= upgradeButtonY &&
      mouseY <= upgradeButtonY + upgradeButtonHeight &&
      e.button === 0
    ) {
      if (money >= P90_UPGRADE_COST) {
        selectedTurret.type = 'tureta_p90';
        selectedTurret.hp = 100;
        selectedTurret.maxHp = 100;
        money -= P90_UPGRADE_COST;
      }
      return;
    }
    // --- Buton M4A1 sub P90 ---
    const m4a1ButtonY = upgradeButtonY + upgradeButtonHeight + 138;
    if (
      mouseX >= upgradeButtonX &&
      mouseX <= upgradeButtonX + upgradeButtonWidth &&
      mouseY >= m4a1ButtonY &&
      mouseY <= m4a1ButtonY + upgradeButtonHeight &&
      e.button === 0
    ) {
      if (money >= M4A1_UPGRADE_COST) {
        selectedTurret.type = 'tureta_m4a1';
        selectedTurret.hp = 120;
        selectedTurret.maxHp = 120;
        money -= M4A1_UPGRADE_COST;
      }
      return;
    }
    // Handler pentru butonul SELL din panoul SMG
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = 20 + (300 - sellBtnWidth) / 2;
    const sellBtnY = 100 + 710 - sellBtnHeight - 40;
    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = 280; // 70% din 400
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }
    // Handler pentru butonul SELL din panoul SHOTGUN
    if (
      selectedTurret && selectedTurret.type === 'tureta_shotgun' &&
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = 280; // 70% din 400
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }
  }
  // Handler pentru butonul SELL din panoul P90 (processMouseClick):
  if (selectedTurret && selectedTurret.type === 'tureta_p90') {
    const sellMenuX = 20;
    const sellMenuY = 100;
    const sellMenuWidth = 300;
    const sellMenuHeight = 340;
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = sellMenuX + (sellMenuWidth - sellBtnWidth) / 2;
    const sellBtnY = sellMenuY + sellMenuHeight - sellBtnHeight - 40;
    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = 1120; // 70% din 1600
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }
  }
  // Handler pentru butonul SELL din panoul M4A1
  if (selectedTurret && selectedTurret.type === 'tureta_m4a1') {
    const sellMenuX = 20;
    const sellMenuY = 100;
    const sellMenuWidth = 300;
    const sellMenuHeight = 340;
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = sellMenuX + (sellMenuWidth - sellBtnWidth) / 2;
    const sellBtnY = sellMenuY + sellMenuHeight - sellBtnHeight - 40; // Corrected: Use sellMenuHeight
    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = 1050; // 70% din 1500
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }
  }
  // NEW: Handler for SELL button in Wall menu
  if (selectedTurret && selectedTurret.type === 'wall') {
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 500; // Matches drawUpgradeMenu for wall
    const sectionPad = 18;

    // --- Upgrade button hitbox (doar daca e wall1 si nu e wall2 inca) ---
    if (selectedTurret.type === 'wall' && !isWall2Unlocked) {
      const upgradeButtonX = menuX + 40; // Matches drawUpgradeMenu
      const upgradeButtonY = menuY + 215; // Matches drawUpgradeMenu
      const upgradeButtonWidth = menuWidth - 80; // Matches drawUpgradeMenu
      const upgradeButtonHeight = 54; // Matches drawUpgradeMenu
      if (
        mouseX >= upgradeButtonX &&
        mouseX <= upgradeButtonX + upgradeButtonWidth &&
        mouseY >= upgradeButtonY &&
        mouseY <= upgradeButtonY + upgradeButtonHeight &&
        e.button === 0
      ) {
        if (money >= 400) { // Cost upgrade Wall2
          isWall2Unlocked = true;
          money -= 400;
          // Upgrade all existing wall1 to wall2
          for (const turret of turrets) {
            if (turret.type === 'wall') {
              turret.type = 'wall2';
              turret.hp = WALL2_HP;
              turret.maxHp = WALL2_HP;
            }
          }
          // Upgrade selectedTurret as well
          if (selectedTurret.type === 'wall') {
            selectedTurret.type = 'wall2';
            selectedTurret.hp = WALL2_HP;
            selectedTurret.maxHp = WALL2_HP;
          }
        }
        return; // Click was handled
      }
    }

    // --- SELL button hitbox (functioneaza si pentru wall1 si pentru wall2) ---
    const sellBtnWidth = 180; // Matches drawUpgradeMenu
    const sellBtnHeight = 48; // Matches drawUpgradeMenu
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2; // Matches drawUpgradeMenu
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40; // Matches drawUpgradeMenu

    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = 0;
      if (selectedTurret.type === 'wall') sellPrice = Math.floor(0.7 * WALL_COST);
      else if (selectedTurret.type === 'wall2') sellPrice = Math.floor(0.7 * WALL_COST); // Same cost, different HP

      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return; // Click was handled
    }
  }
  // NEW: Handler for SELL button in Wall2 menu
  else if (selectedTurret && selectedTurret.type === 'wall2') {
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 340; // Matches drawUpgradeMenu for wall2 panel
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40; // Positioned like P90/M4A1 sell button

    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = 10; // Sell price for wall2 is 10
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return; // Click was handled
    }
  }
  // 2. Verifica click pentru upgrade/sell in meniul din stanga (drawUpgradeMenu context)
  if (selectedTurret && selectedTurret.type === 'tureta_shotgun') {
    const upgradeMenuX = 20;
    const upgradeMenuY = 100;
    const upgradeButtonX = upgradeMenuX + 40;
    const upgradeButtonY = upgradeMenuY + 215;
    const upgradeButtonWidth = 220; // menuWidth - 80
    const upgradeButtonHeight = 54;
    // --- Heavy Shotgun upgrade button ---
    if (
      mouseX >= upgradeButtonX &&
      mouseX <= upgradeButtonX + upgradeButtonWidth &&
      mouseY >= upgradeButtonY &&
      mouseY <= upgradeButtonY + upgradeButtonHeight &&
      e.button === 0
    ) {
      if (money >= HEAVYSHOTGUN_UPGRADE_COST) {
        selectedTurret.type = 'tureta_heavyshotgun';
        selectedTurret.hp = 100;
        selectedTurret.maxHp = 100;
        money -= HEAVYSHOTGUN_UPGRADE_COST;
      }
      return;
    }
    // --- Fast Shotgun upgrade button ---
    const fastshotgunButtonY = upgradeButtonY + upgradeButtonHeight + 138;
    if (
      mouseX >= upgradeButtonX &&
      mouseX <= upgradeButtonX + upgradeButtonWidth &&
      mouseY >= fastshotgunButtonY &&
      mouseY <= fastshotgunButtonY + upgradeButtonHeight &&
      e.button === 0
    ) {
      if (money >= FASTSHOTGUN_UPGRADE_COST) {
        selectedTurret.type = 'tureta_fastshotgun';
        selectedTurret.hp = 80;
        selectedTurret.maxHp = 80;
        money -= FASTSHOTGUN_UPGRADE_COST;
      }
      return;
    }
    // --- SELL button ---
    const sellMenuX = 20;
    const sellMenuY = 100;
    const sellMenuWidth = 300;
    const sellMenuHeight = 710;
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = sellMenuX + (sellMenuWidth - sellBtnWidth) / 2;
    const sellBtnY = sellMenuY + sellMenuHeight - sellBtnHeight - 40;
    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = Math.floor(0.7 * 400); // 70% din costul shotgun
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }
  }
  // --- SELL button pentru heavyshotgun ---
  if (selectedTurret && selectedTurret.type === 'tureta_heavyshotgun') {
    const sellMenuX = 20;
    const sellMenuY = 100;
    const sellMenuWidth = 300;
    const sellMenuHeight = 340;
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = sellMenuX + (sellMenuWidth - sellBtnWidth) / 2;
    const sellBtnY = sellMenuY + sellMenuHeight - sellBtnHeight - 40;
    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = Math.floor(0.7 * 1900); // 70% din costul heavyshotgun
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }
  }
  // --- SELL button pentru fastshotgun ---
  if (selectedTurret && selectedTurret.type === 'tureta_fastshotgun') {
    const sellMenuX = 20;
    const sellMenuY = 100;
    const sellMenuWidth = 300;
    const sellMenuHeight = 340;
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = sellMenuX + (sellMenuWidth - sellBtnWidth) / 2;
    const sellBtnY = sellMenuY + sellMenuHeight - sellBtnHeight - 40;
    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = Math.floor(0.7 * 1200); // 70% din costul fastshotgun
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return;
    }
  }
  // Handler pentru butonul SELL din panoul Money Mine
  else if (selectedTurret && selectedTurret.type === 'tureta_minabani') {
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 260; // Specific to Money Mine menu in drawUpgradeMenu
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2; // Calculated: 80
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 24; // Calculated: 100 + 260 - 48 - 24 = 288

    if (
      mouseX >= sellBtnX &&
      mouseX <= sellBtnX + sellBtnWidth &&
      mouseY >= sellBtnY &&
      mouseY <= sellBtnY + sellBtnHeight &&
      e.button === 0
    ) {
      let sellPrice = Math.floor(0.7 * 200); // 70% of Money Mine cost (200)
      money += sellPrice;
      const idx = turrets.indexOf(selectedTurret);
      if (idx !== -1) turrets.splice(idx, 1);
      selectedTurret = null;
      return; // Click was handled
    }
  }
}

// Adauga meniu lateral de selectie mod (dreapta)
function drawSideSelectionMenu(ctx) {
  const menuWidth = 120;
  const menuHeight = 520; // doar fundalul, pentru a cuprinde si butonul wall
  const x = CANVAS_WIDTH - menuWidth - 32;
  const y = CANVAS_HEIGHT / 2 - menuHeight / 2;

  // Draw menu background with rounded corners and gradient
  ctx.save();
  const gradient = ctx.createLinearGradient(x, y, x, y + menuHeight);
  gradient.addColorStop(0, '#1b3a1b'); // verde inchis sus
  gradient.addColorStop(1, '#183118'); // verde inchis jos
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x + 20, y);
  ctx.lineTo(x + menuWidth - 20, y);
  ctx.quadraticCurveTo(x + menuWidth, y, x + menuWidth, y + 20);
  ctx.lineTo(x + menuWidth, y + menuHeight - 20);
  ctx.quadraticCurveTo(x + menuWidth, y + menuHeight, x + menuWidth - 20, y + menuHeight);
  ctx.lineTo(x + 20, y + menuHeight);
  ctx.quadraticCurveTo(x, y + menuHeight, x, y + menuHeight - 20);
  ctx.lineTo(x, y + 20);
  ctx.quadraticCurveTo(x, y, x + 20, y);
  ctx.closePath();
  ctx.fill();

  // Add a glowing border
  ctx.shadowColor = '#0a1a0a';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = '#0e220e'; // verde foarte inchis pentru border
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw buttons with better spacing and hover effects
  function drawButton({ iconImg, fallback, label, active, posY, color, borderColor, cost }) {
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.88;
    // Fundal pergament cu efect medieval
    const grad = ctx.createLinearGradient(x + 18, y + posY, x + menuWidth - 18, y + posY + 90);
    grad.addColorStop(0, '#f5e6c5');
    grad.addColorStop(1, '#e0c48c');
    ctx.fillStyle = active ? grad : '#bfa76f';
    ctx.beginPath();
    ctx.roundRect(x + 18, y + posY, menuWidth - 36, 90, 18);
    ctx.fill();
    ctx.lineWidth = active ? 4 : 2;
    ctx.strokeStyle = active ? borderColor : '#a88b3a';
    ctx.shadowColor = active ? '#ffe066' : '#bfa100';
    ctx.shadowBlur = active ? 12 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Icon mare si centrat
    let isBigIcon = label === 'Gun' || label === 'Money Mine';
    if (iconImg && iconImg.complete && iconImg.naturalWidth !== 0 && isBigIcon) {
      const iconSize = label === 'Money Mine' ? 90 : Math.min(menuWidth - 8, 100);
      const iconOffsetX = x + menuWidth / 2 - iconSize / 2;
      const iconOffsetY = y + posY + (90 - iconSize) / 2;
      ctx.drawImage(iconImg, iconOffsetX, iconOffsetY, iconSize, iconSize);
    } else if (iconImg && iconImg.complete && iconImg.naturalWidth !== 0) {
      ctx.drawImage(iconImg, x + 38, y + posY + 16, 54, 54);
    } else {
      fallback();
    }

    // Eliminat: Font medieval pentru nume
    // Eliminat: ctx.fillText(label, ...)
    // Costul sub icon, cu moneda aurie
    ctx.font = "bold 18px 'MedievalSharp', Georgia, serif";
    ctx.fillStyle = '#bfa100';
    let costY = y + posY + 104; // Pozitioneaza costul sub icon
    ctx.beginPath();
    ctx.arc(x + menuWidth / 2 - 18, costY - 4, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    ctx.font = "bold 18px 'MedievalSharp', Georgia, serif";
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'left';
    ctx.fillText(cost, x + menuWidth / 2 - 6, costY + 2);
    ctx.restore();
  }

  // Draw buttons for each mode cu spatiere puțin mai mare
  drawButton({
    iconImg: bananaImg,
    fallback: () => {
      ctx.fillStyle = 'yellow';
      ctx.beginPath();
      ctx.arc(x + menuWidth / 2, y + 45, 24, 0, Math.PI * 2);
      ctx.fill();
    },
    label: 'Banana',
    active: current_mode === 'banana',
    posY: 38, // mutat mai jos cu 20px
    color: '#ffe066',
    borderColor: '#e6e600',
    cost: 0
  });

  drawButton({
    iconImg: null,
    fallback: () => {
      const iconSize = Math.min(menuWidth - 24, 80);
      const iconOffsetX = x + menuWidth / 2 - iconSize / 2;
      const iconOffsetY = y + 160 + (100 - iconSize) / 2;
      if (bazaImg.complete && bazaImg.naturalWidth !== 0) {
        ctx.drawImage(bazaImg, iconOffsetX, iconOffsetY, iconSize, iconSize);
      } else {
        ctx.fillStyle = '#7c2c8e';
        ctx.fillRect(iconOffsetX, iconOffsetY + iconSize / 3, iconSize, iconSize / 1.5);
      }
      if (pistolImg.complete && pistolImg.naturalWidth !== 0) {
        ctx.save();
        ctx.translate(x + menuWidth / 2, iconOffsetY + iconSize / 2 - iconSize * 0.22);
        ctx.rotate(-Math.PI / 16);
        ctx.drawImage(pistolImg, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
        ctx.restore();
      } else {
        ctx.fillStyle = '#444';
        ctx.fillRect(x + menuWidth / 2 - iconSize / 4, iconOffsetY + iconSize / 4, iconSize / 2, iconSize / 3);
      }
    },
    label: 'Gun',
    active: current_mode === 'tureta_bazapistol',
    posY: 160, // mutat mai jos cu 20px
    color: '#b97cff',
    borderColor: '#7c2c8e',
    cost: 100
  });

  drawButton({
    iconImg: minabanil1Img,
    fallback: () => {
      // Fallback: desen mare pentru test vizual
      const iconSize = Math.min(menuWidth - 2, 120); // 120px, cat permite meniul
      const iconOffsetX = x + menuWidth / 2 - iconSize / 2;
      const iconOffsetY = y + 282 + (90 - iconSize) / 2;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x + menuWidth / 2, iconOffsetY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
      ctx.fill();
    },
    label: 'Money Mine',
    active: current_mode === 'tureta_minabani',
    posY: 282, // mutat mai jos cu 20px
    color: '#ffd700',
    borderColor: '#bfa100',
    cost: 200
  });

  drawButton({
    iconImg: isWall2Unlocked ? wall2Img : wallImg,
    fallback: () => {
      ctx.fillStyle = isWall2Unlocked ? '#88c' : '#bbb';
      ctx.fillRect(x + 38, y + 404, 54, 54);
      ctx.strokeStyle = '#888';
      ctx.strokeRect(x + 38, y + 404, 54, 54);
    },
    label: isWall2Unlocked ? 'Wall2' : 'Wall',
    active: current_mode === 'wall',
    posY: 404,
    color: isWall2Unlocked ? '#88c' : '#bbb',
    borderColor: '#888',
    cost: WALL_COST
  });

  ctx.restore();
}

// Variabile lipsa pentru turete si grid
let turretGrid = {};
let turrets = [];
const TURRET_SIZE = 3;

// Proiectilele turetelor struguri
let turretProjectiles = [];
const TURRET_PROJECTILE_SPEED = 54; // viteza proiectilului strugure (mult mai rapid)

// Adauga structura pentru particule de sange
let bloodParticles = [];

// NOU: Adauga structura pentru particulele de scantei
let sparkParticles = [];

// NOU: Structura pentru petele de sange de pe sol
let bloodstains = [];
const BLOODSTAIN_DURATION = 6000; // 6 secunde

// NOU: Functie pentru crearea petelor de sange pe sol
function createBloodstain(x, y, enemyType) {
  const stainColor = 'rgba(27, 77, 62, 0.6)'; // Verde inchis pentru toate tipurile de inamici
  const baseStainSize = enemyType === 'gandacverde' ? Math.random() * 20 + 35 : Math.random() * 15 + 30; // Marime variabila pentru pata principala
  
  const droplets = [];
  const numDroplets = 5 + Math.floor(Math.random() * 5); // Intre 5 si 9 picaturi
  const baseAlpha = 0.5 + Math.random() * 0.2; // Alpha de baza pentru pata, usor variabil

  for (let i = 0; i < numDroplets; i++) {
    // Picaturile pot fi mai mici sau mai mari, unele chiar depasind baza pentru efect de "stropire"
    const dropletSizeRatio = 0.1 + Math.random() * 0.8; // Raport din marimea de baza
    const dropletSize = baseStainSize * dropletSizeRatio;
    
    // Distanța de la centru, unele picaturi pot fi mai departe
    const distanceFromCenter = Math.random() * baseStainSize * 0.7;
    const angleFromCenter = Math.random() * Math.PI * 2;
    
    droplets.push({
      relativeX: Math.cos(angleFromCenter) * distanceFromCenter,
      relativeY: Math.sin(angleFromCenter) * distanceFromCenter,
      size: dropletSize,
      // Forma mai alungita si variabila pentru fiecare picatura
      aspectRatio: 0.4 + Math.random() * 0.5, // între 0.4 si 0.9
      rotation: Math.random() * Math.PI * 2,
      // Opacitate individuala pentru fiecare picatura, bazata pe alpha-ul petei
      alpha: baseAlpha * (0.6 + Math.random() * 0.4) 
    });
  }

  bloodstains.push({
    x: x,
    y: y,
    baseSize: baseStainSize, // Stocam marimea de baza pentru referinta daca e nevoie
    colorPattern: stainColor, // Stocam modelul de culoare (ex: 'rgba(R,G,B,')
    droplets: droplets, // Stocam proprietatile picaturilor
    creationTime: performance.now(),
    duration: BLOODSTAIN_DURATION
  });
}

// Functie pentru crearea particulelor de sange
function createBloodParticles(x, y, count, enemyType) {
  // Particule puțin mai mici pentru un efect mai echilibrat
  const particleSize = enemyType === 'gandacverde' ? 4 : 2.5; // Particule puțin mai mici
  const particleCount = enemyType === 'gandacverde' ? count * 1.8 : count * 2.2; // Puțin mai puține particule
  const particleSpeed = enemyType === 'gandacverde' ? 5.5 : 3.5; // Viteză puțin mai mică
  
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Viteză variabilă pentru efect mai natural
    const speed = (Math.random() * 0.35 + 0.25) * particleSpeed;
    bloodParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: particleSize * (Math.random() * 0.35 + 0.65), // Variație puțin mai mică în mărime
      life: 0.95, // Viață puțin mai scurtă
      color: '#1B4D3E' // Culori realiste - Changed to green for all types
    });
  }
}

// NOU: Functie pentru crearea particulelor de scantei
function createSparkParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5; // Viteza initiala a scanteii (era Math.random() * 3 + 1)
    const life = Math.random() * 0.4 + 0.2; // Durata de viata putin mai mare (era Math.random() * 0.3 + 0.1)
    sparkParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3 + 2, // Dimensiunea mai mare (era Math.random() * 2 + 1)
      life: life,
      initialLife: life,
      color: Math.random() < 0.7 ? '#FFA500' : '#FFD700' // Portocaliu sau galben
    });
  }
}

// Add a new array for hit particles
let furnicaHitParticles = [];

// Function to create dark green, larger, more visible hit particles on furnica
function createFurnicaHitParticles(x, y) {
  for (let i = 0; i < 10; i++) { // a few more particles
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1.2 + 0.6;
    furnicaHitParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 3.5 + 2.2, // larger size
      life: 1.15, // slightly longer life
      color: 'rgba(30,120,40,0.93)' // darker green, more visible
    });
  }
}

// Update function for hit particles
function updateFurnicaHitParticles() {
  for (let i = furnicaHitParticles.length - 1; i >= 0; i--) {
    const p = furnicaHitParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.91;
    p.vy *= 0.91;
    p.life -= 0.045; // slower fade
    if (p.life <= 0) {
      furnicaHitParticles.splice(i, 1);
    }
  }
}

// Draw function for hit particles
function drawFurnicaHitParticles(ctx, offsetX, offsetY) {
  for (const p of furnicaHitParticles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - offsetX, p.y - offsetY, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Actualizeaza functia handleBananaEnemyCollision pentru a crea particule la moarte
function handleBananaEnemyCollision() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    for (let j = projectiles.length - 1; j >= 0; j--) {
      const p = projectiles[j];
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Hitbox mai mare pentru gandac verde (48), heroticbeetle (40), hitbox normal pentru furnica (32)
      let hitboxSize = 32; // Default pentru furnica
      if (enemy.type === 'gandacverde') {
        hitboxSize = 48;
      } else if (enemy.type === 'heroticbeetle') {
        hitboxSize = 40;
      }
      if (dist < hitboxSize) {
        enemy.hp -= 1; // Inamicul ia damage (banana face 1 damage)
        // --- EFFECT: Green hit particles for ALL enemies ---
        createFurnicaHitParticles(enemy.x, enemy.y);
        projectiles.splice(j, 1); // banana dispare instant
        if (enemy.hp <= 0) {
          // Creeaza particulele de sange inainte de a sterge inamicul
          createBloodParticles(enemy.x, enemy.y, 25, enemy.type);
          createBloodstain(enemy.x, enemy.y, enemy.type); // ADAUGA PATA DE SANGE
          // --- REDA SUNETUL insectkill.mp3 ---
          let audio = insectkillPool[insectkillPoolIndex];
          try { audio.currentTime = 0; audio.play(); } catch (e) {}
          insectkillPoolIndex = (insectkillPoolIndex + 1) % INSECTKILL_POOL_SIZE;
          const idx = enemies.indexOf(enemy);
          if (idx !== -1) {
            enemies.splice(idx, 1);
            money += enemy.moneyValue;
          }
        }
        break; // un proiectil lovește o singura data
      }
    }
  }
}

// Actualizeaza functia updateBloodParticles pentru a face particulele sa dispara putin mai repede
function updateBloodParticles() {
  for (let i = bloodParticles.length - 1; i >= 0; i--) {
    const p = bloodParticles[i];
    // Actualizeaza pozitia
    p.x += p.vx;
    p.y += p.vy;
    // Reduce viteza putin mai repede
    p.vx *= 0.96;
    p.vy *= 0.96;
    // Reduce viata putin mai repede
    p.life -= 0.017; // Scade putin mai repede
    // Elimina particula cand moare
    if (p.life <= 0) {
      bloodParticles.splice(i, 1);
    }
  }
}

// Actualizeaza functia drawBloodParticles pentru un efect vizual putin mai subtil
function drawBloodParticles(ctx, offsetX, offsetY) {
  for (const p of bloodParticles) {
    ctx.save();
    ctx.globalAlpha = p.life * 0.75; // Putin mai transparent
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - offsetX, p.y - offsetY, p.size, 0, Math.PI * 2);
    ctx.fill();
    // Efect de stralucire putin mai subtil
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.size * 1.3;
    ctx.fill();
    ctx.restore();
  }
}

// --- DEBUG: LOGIC pentru tragere tureta struguri ---
function updateTurrets(speedFactor = 1) {
  const now = performance.now();
  for (const turret of turrets) {
    // Slow effect de la mazga
    let turretSpeed = speedFactor;
    if (turret.slowUntil && performance.now() < turret.slowUntil) {
      turretSpeed *= turret.slowFactor || 1;
    }
    if (turret.type === 'tureta_bazapistol') {
      let closestEnemy = null;
      let minDist = 450; // Updated range to 450
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      const attackInterval = 1000 / (2 * turretSpeed); // 2 atacuri/sec
      if (closestEnemy && (now - (turret.lastShot || 0)) >= attackInterval) {
        turret.lastShot = now;
        // Calculează poziția din fața pistolului (vârful țevii)
        const angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
        const barrelLength = 60; // distanța de la centru la vârful pistolului (jumătate din imgWidth)
        const pistolX = turret.x + Math.cos(angle) * barrelLength;
        const pistolY = turret.y - 18 + Math.sin(angle) * barrelLength; // Ajustat Y pentru a se alinia cu imaginea pistolului
        const dx = closestEnemy.x - pistolX;
        const dy = closestEnemy.y - pistolY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        turretProjectiles.push({
          x: pistolX,
          y: pistolY,
          startX: pistolX,
          startY: pistolY,
          target: closestEnemy,
          damage: 1,
          dirX: dx / dist,
          dirY: dy / dist
        });
        // NOU: Creează scântei la gura țevii
        createSparkParticles(pistolX, pistolY, 5); 
        // --- REDĂ SUNETUL GUNSHOT FĂRĂ BLOCĂRI ---
        let audio = gunshotPool[gunshotPoolIndex];
        try {
          audio.currentTime = 0;
          audio.play();
        } catch (e) {}
        gunshotPoolIndex = (gunshotPoolIndex + 1) % GUNSHOT_POOL_SIZE;
      }
    } else if (turret.type === 'tureta_smg') {
      let closestEnemy = null;
      let minDist = 450; // Updated range to 450
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      const attackInterval = 1000 / (SMG_ATTACKSPEED * turretSpeed); // SMG rapid
      if (closestEnemy && (now - (turret.lastShot || 0)) >= attackInterval) {
        turret.lastShot = now;
        const angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
        const barrelLength = 60;
        const smgX = turret.x + Math.cos(angle) * barrelLength;
        const smgY = turret.y - 18 + Math.sin(angle) * barrelLength; // Ajustat Y pentru a se alinia cu imaginea SMG
        const dx = closestEnemy.x - smgX;
        const dy = closestEnemy.y - smgY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        turretProjectiles.push({
          x: smgX,
          y: smgY,
          startX: smgX,
          startY: smgY,
          target: closestEnemy,
          damage: 0.9,
          dirX: dx / dist,
          dirY: dy / dist
        });
        // NOU: Creează scântei la gura țevii SMG
        createSparkParticles(smgX, smgY, 8); // Mai multe scantei pentru SMG
        // --- REDĂ SUNETUL P90shot.mp3 FĂRĂ BLOCĂRI ---
        let audio = p90shotPool[p90shotPoolIndex];
        try {
          audio.currentTime = 0;
          audio.play();
        } catch (e) {}
        p90shotPoolIndex = (p90shotPoolIndex + 1) % P90SHOT_POOL_SIZE;
      }
    } else if (turret.type === 'tureta_p90') {
      let closestEnemy = null;
      let minDist = P90_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      const attackInterval = 1000 / (P90_ATTACKSPEED * speedFactor);
      if (closestEnemy && (now - (turret.lastShot || 0)) >= attackInterval) {
        turret.lastShot = now;
        const angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
        const barrelLength = 60;
        const p90X = turret.x + Math.cos(angle) * barrelLength;
        const p90Y = turret.y - 18 + Math.sin(angle) * barrelLength;
        const dx = closestEnemy.x - p90X;
        const dy = closestEnemy.y - p90Y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        turretProjectiles.push({
          x: p90X,
          y: p90Y,
          startX: p90X,
          startY: p90Y,
          target: closestEnemy,
          damage: P90_DAMAGE,
          dirX: dx / dist,
          dirY: dy / dist
        });
        createSparkParticles(p90X, p90Y, 10);
        // --- REDĂ SUNETUL P90shot.mp3 FĂRĂ BLOCĂRI ---
        let audio = p90shotPool[p90shotPoolIndex];
        try {
          audio.currentTime = 0;
          audio.play();
        } catch (e) {}
        p90shotPoolIndex = (p90shotPoolIndex + 1) % P90SHOT_POOL_SIZE;
      }
    } else if (turret.type === 'tureta_m4a1') {
      let closestEnemy = null;
      let minDist = M4A1_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      const attackInterval = 1000 / (M4A1_ATTACKSPEED * speedFactor);
      if (closestEnemy && (now - (turret.lastShot || 0)) >= attackInterval) {
        turret.lastShot = now;
        const angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
        const barrelLength = 60;
        const m4a1X = turret.x + Math.cos(angle) * barrelLength;
        const m4a1Y = turret.y - 18 + Math.sin(angle) * barrelLength;
        const dx = closestEnemy.x - m4a1X;
        const dy = closestEnemy.y - m4a1Y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        turretProjectiles.push({
          x: m4a1X,
          y: m4a1Y,
          startX: m4a1X,
          startY: m4a1Y,
          target: closestEnemy,
          damage: M4A1_DAMAGE,
          dirX: dx / dist,
          dirY: dy / dist
        });
        createSparkParticles(m4a1X, m4a1Y, 12);
        // --- REDĂ SUNETUL M4A1shot.mp3 FĂRĂ DELAY ---
        let audio = m4a1shotPool[m4a1shotPoolIndex];
        try {
          audio.currentTime = 0;
          audio.play();
        } catch (e) {}
        m4a1shotPoolIndex = (m4a1shotPoolIndex + 1) % M4A1SHOT_POOL_SIZE;
      }
    } else if (turret.type === 'tureta_shotgun') {
      let closestEnemy = null;
      let minDist = SHOTGUN_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      const attackInterval = 1000 / (SHOTGUN_ATTACKSPEED * turretSpeed);
      if (closestEnemy && (now - (turret.lastShot || 0)) >= attackInterval) {
        turret.lastShot = now;
        const angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
        const barrelLength = 60;
        const baseX = turret.x + Math.cos(angle) * barrelLength;
        const baseY = turret.y - 18 + Math.sin(angle) * barrelLength;
        // Shotgun spread: 4 proiectile, -8, -3, +3, +8 grade (mai strans)
        const spreadAngles = [-8, -3, 3, 8].map(a => angle + a * Math.PI / 180);
        for (const a of spreadAngles) {
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          turretProjectiles.push({
            x: baseX,
            y: baseY,
            startX: baseX,
            startY: baseY,
            target: null, // Shotgun projectiles do not track targets
            damage: SHOTGUN_DAMAGE,
            dirX: dx,
            dirY: dy
          });
        }
        createSparkParticles(baseX, baseY, 10);
        // Sunet: shotgunshot.mp3
        let audio = shotgunshotPool[shotgunshotPoolIndex];
        try { audio.currentTime = 0; audio.play(); } catch (e) {}
        shotgunshotPoolIndex = (shotgunshotPoolIndex + 1) % SHOTGUNSHOT_POOL_SIZE;
      }
    } else if (turret.type === 'tureta_heavyshotgun') {
      let closestEnemy = null;
      let minDist = HEAVYSHOTGUN_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      const attackInterval = 1000 / (HEAVYSHOTGUN_ATTACKSPEED * turretSpeed);
      if (closestEnemy && (now - (turret.lastShot || 0)) >= attackInterval) {
        turret.lastShot = now;
        const angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
        const barrelLength = 60;
        const baseX = turret.x + Math.cos(angle) * barrelLength;
        const baseY = turret.y - 18 + Math.sin(angle) * barrelLength;
        // Heavy Shotgun spread: 9 proiectile, -24, -18, -12, -6, 0, +6, +12, +18, +24 grade
        const spreadAngles = [-24, -18, -12, -6, 0, 6, 12, 18, 24].map(a => angle + a * Math.PI / 180);
        for (const a of spreadAngles) {
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          turretProjectiles.push({
            x: baseX,
            y: baseY,
            startX: baseX,
            startY: baseY,
            target: null,
            damage: HEAVYSHOTGUN_DAMAGE,
            dirX: dx,
            dirY: dy
          });
        }
        createSparkParticles(baseX, baseY, 14);
        // Sunet: heavyshotgunshot.mp3
        let audio = heavyshotgunshotPool[heavyshotgunshotPoolIndex];
        try { audio.currentTime = 0; audio.play(); } catch (e) {}
        heavyshotgunshotPoolIndex = (heavyshotgunshotPoolIndex + 1) % HEAVYSHOTGUNSHOT_POOL_SIZE;
      }
    } else if (turret.type === 'tureta_fastshotgun') {
      let closestEnemy = null;
      let minDist = FASTSHOTGUN_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      const attackInterval = 1000 / (FASTSHOTGUN_ATTACKSPEED * turretSpeed);
      if (closestEnemy && (now - (turret.lastShot || 0)) >= attackInterval) {
        turret.lastShot = now;
        const angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
        const barrelLength = 60;
        const baseX = turret.x + Math.cos(angle) * barrelLength;
        const baseY = turret.y - 18 + Math.sin(angle) * barrelLength;
        // Fast Shotgun spread: 5 proiectile, -10, -5, 0, +5, +10 grade
        const spreadAngles = [-10, -5, 0, 5, 10].map(a => angle + a * Math.PI / 180);
        for (const a of spreadAngles) {
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          turretProjectiles.push({
            x: baseX,
            y: baseY,
            startX: baseX,
            startY: baseY,
            target: null,
            damage: FASTSHOTGUN_DAMAGE,
            dirX: dx,
            dirY: dy
          });
        }
        createSparkParticles(baseX, baseY, 12);
        // Sunet: shotgunshot.mp3 (sau altul dacă ai)
        let audio = shotgunshotPool[shotgunshotPoolIndex];
        try { audio.currentTime = 0; audio.play(); } catch (e) {}
        shotgunshotPoolIndex = (shotgunshotPoolIndex + 1) % SHOTGUNSHOT_POOL_SIZE;
      }
    }
  }
}

function drawTurrets(ctx, offsetX, offsetY) {
  // 1. Desenează întâi toate imaginile turnurilor
  for (const turret of turrets) {
    if (turret.type === 'tureta_bazapistol' && bazaImg.complete && bazaImg.naturalWidth !== 0 && pistolImg.complete && pistolImg.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        bazaImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Caută cea mai apropiată furnică din range
      let closestEnemy = null;
      let minDist = 500; // Updated range to 500
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      // Calculează unghiul spre cea mai apropiată furnică
      let angle = 0;
      if (closestEnemy) {
        angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
      }
      // Desenează pistolul rotit spre furnică
      ctx.save();
      ctx.translate(turret.x - offsetX, turret.y - offsetY - 18); // mută pistolul puțin mai sus pe bază
      ctx.rotate(angle);
      ctx.drawImage(
        pistolImg,
        -imgWidth / 2,
        -imgHeight / 2,
        imgWidth,
        imgHeight
      );
      ctx.restore();
    } else if (turret.type === 'tureta_smg' && bazaImg.complete && bazaImg.naturalWidth !== 0 && smgImg.complete && smgImg.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        bazaImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Caută cea mai apropiată furnică din range
      let closestEnemy = null;
      let minDist = 500; // Updated range to 500
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      let angle = 0;
      if (closestEnemy) {
        angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
      }
      ctx.save();
      ctx.translate(turret.x - offsetX, turret.y - offsetY - 18);
      ctx.rotate(angle);
      ctx.drawImage(smgImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    } else if (turret.type === 'tureta_p90' && bazaImg.complete && bazaImg.naturalWidth !== 0 && p90Img.complete && p90Img.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        bazaImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Caută cea mai apropiată furnică din range
      let closestEnemy = null;
      let minDist = P90_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      let angle = 0;
      if (closestEnemy) {
        angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
      }
      ctx.save();
      ctx.translate(turret.x - offsetX, turret.y - offsetY - 18);
      ctx.rotate(angle);
      ctx.drawImage(p90Img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    } else if (turret.type === 'tureta_m4a1' && bazaImg.complete && bazaImg.naturalWidth !== 0 && m4a1Img.complete && m4a1Img.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        bazaImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Caută cea mai apropiată furnică din range
      let closestEnemy = null;
      let minDist = M4A1_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      let angle = 0;
      if (closestEnemy) {
        angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
      }
      ctx.save();
      ctx.translate(turret.x - offsetX, turret.y - offsetY - 18);
      ctx.rotate(angle);
      ctx.drawImage(m4a1Img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    } else if (turret.type === 'tureta_shotgun' && bazaImg.complete && bazaImg.naturalWidth !== 0 && shotgunImg.complete && shotgunImg.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        bazaImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Caută cea mai apropiată furnică din range
      let closestEnemy = null;
      let minDist = SHOTGUN_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      let angle = 0;
      if (closestEnemy) {
        angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
      }
      ctx.save();
      ctx.translate(turret.x - offsetX, turret.y - offsetY - 18);
      ctx.rotate(angle);
      ctx.drawImage(shotgunImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    } else if (turret.type === 'tureta_heavyshotgun' && bazaImg.complete && bazaImg.naturalWidth !== 0 && heavyshotgunImg.complete && heavyshotgunImg.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        bazaImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Caută cea mai apropiată furnică din range
      let closestEnemy = null;
      let minDist = HEAVYSHOTGUN_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      let angle = 0;
      if (closestEnemy) {
        angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
      }
      ctx.save();
      ctx.translate(turret.x - offsetX, turret.y - offsetY - 18);
      ctx.rotate(angle);
      ctx.drawImage(heavyshotgunImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    } else if (turret.type === 'tureta_fastshotgun' && bazaImg.complete && bazaImg.naturalWidth !== 0 && fastshotgunImg.complete && fastshotgunImg.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        bazaImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
      // Caută cea mai apropiată furnică din range
      let closestEnemy = null;
      let minDist = FASTSHOTGUN_RANGE;
      for (const enemy of enemies) {
        if (enemy.hp > 0) {
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            closestEnemy = enemy;
          }
        }
      }
      let angle = 0;
      if (closestEnemy) {
        angle = Math.atan2(closestEnemy.y - turret.y, closestEnemy.x - turret.x);
      }
      ctx.save();
      ctx.translate(turret.x - offsetX, turret.y - offsetY - 18);
      ctx.rotate(angle);
      ctx.drawImage(fastshotgunImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    }
    // Desenează tureta mină bani
    if (turret.type === 'tureta_minabani' && minabanil1Img.complete && minabanil1Img.naturalWidth !== 0) {
      const imgWidth = 120;
      const imgHeight = 120;
      ctx.drawImage(
        minabanil1Img,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
    } else if (turret.type === 'tureta_minabani') {
      ctx.save();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(turret.x - offsetX, turret.y - offsetY, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Desenează zidul
    if ((turret.type === 'wall' && wallImg.complete && wallImg.naturalWidth !== 0) || (turret.type === 'wall2' && wall2Img.complete && wall2Img.naturalWidth !== 0)) {
      const imgWidth = 40;
      const imgHeight = 40;
      ctx.drawImage(
        turret.type === 'wall2' ? wall2Img : wallImg,
        turret.x - offsetX - imgWidth / 2,
        turret.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
    } else if (turret.type === 'wall' || turret.type === 'wall2') {
      ctx.save();
      ctx.fillStyle = turret.type === 'wall2' ? '#88c' : '#bbb';
      ctx.fillRect(turret.x - offsetX - 20, turret.y - offsetY - 20, 40, 40);
      ctx.restore();
    }
  }

  // 2. Desenează TOATE barele de HP și range-ul peste toate imaginile
  for (const turret of turrets) {
    // Bara de HP deasupra turetei
    if (turret.type === 'tureta_bazapistol' || turret.type === 'tureta_smg' || turret.type === 'tureta_minabani' || turret.type === 'tureta_p90' || turret.type === 'tureta_m4a1' || turret.type === 'tureta_shotgun' || turret.type === 'tureta_heavyshotgun' || turret.type === 'tureta_fastshotgun') {
      ctx.save();
      ctx.fillStyle = 'red';
      ctx.fillRect(turret.x - offsetX - 40, turret.y - offsetY - 80, 80, 8);
      ctx.fillStyle = 'lime';
      ctx.fillRect(turret.x - offsetX - 40, turret.y - offsetY - 80, 80 * (turret.hp / turret.maxHp), 8);
      ctx.strokeStyle = '#222';
      ctx.strokeRect(turret.x - offsetX - 40, turret.y - offsetY - 80, 80, 8);
      ctx.restore();
    } else if (turret.type === 'wall' || turret.type === 'wall2') {
      ctx.save();
      const wallHpBarWidth = 36;
      ctx.fillStyle = 'red';
      ctx.fillRect(turret.x - offsetX - wallHpBarWidth / 2, turret.y - offsetY - 30, wallHpBarWidth, 6);
      ctx.fillStyle = 'lime'; // Corrected back to lime for wall HP
      ctx.fillRect(turret.x - offsetX - wallHpBarWidth / 2, turret.y - offsetY - 30, wallHpBarWidth * (turret.hp / turret.maxHp), 6);
      ctx.strokeStyle = '#222';
      ctx.strokeRect(turret.x - offsetX - wallHpBarWidth / 2, turret.y - offsetY - 30, wallHpBarWidth, 6);
      ctx.restore();
    }
    // Range pentru tureta selectată
    if (selectedTurret === turret) {
      let range = 0;
      if (turret.type === 'tureta_bazapistol') range = 450;
      else if (turret.type === 'tureta_smg') range = 450;
      else if (turret.type === 'tureta_p90') range = 450;
      else if (turret.type === 'tureta_m4a1') range = 650;
      else if (turret.type === 'tureta_shotgun') range = SHOTGUN_RANGE;
      else if (turret.type === 'tureta_heavyshotgun') range = HEAVYSHOTGUN_RANGE;
      else if (turret.type === 'tureta_fastshotgun') range = FASTSHOTGUN_RANGE;
      if (range > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(turret.x - offsetX, turret.y - offsetY, range, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(120,0,180,0.35)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }
}

// --- Highlight grid pentru plasare tureta struguri ---
function drawTurretPlacementPreview(ctx, offsetX, offsetY) {
  if ((current_mode === 'tureta_bazapistol' || current_mode === 'tureta_minabani') && hoveredGrid.x !== null && hoveredGrid.y !== null) {
    // 3x3 grid centrat pe hoveredGrid
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const gx = hoveredGrid.x + dx;
        const gy = hoveredGrid.y + dy;
        ctx.save();
        ctx.fillStyle = 'rgba(120,255,120,0.45)'; // verde deschis, semitransparent
        ctx.fillRect(gx * 40 - offsetX, gy * 40 - offsetY, 40, 40);
        ctx.restore();
      }
    }
  }
  if (current_mode === 'wall' && hoveredGrid.x !== null && hoveredGrid.y !== null) {
    ctx.save();
    ctx.fillStyle = 'rgba(180,180,180,0.45)';
    ctx.fillRect(hoveredGrid.x * 40 - offsetX, hoveredGrid.y * 40 - offsetY, 40, 40);
    ctx.restore();
  }
}

function drawEnemies(ctx, offsetX, offsetY) {
  for (const enemy of enemies) {
    if (enemy.type === 'furnica') {
      // Desenează furnica
      if (furnica1Img.complete && furnica1Img.naturalWidth !== 0) {
        const scale = 0.025;
        const imgWidth = furnica1Img.naturalWidth * scale;
        const imgHeight = furnica1Img.naturalHeight * scale;
        ctx.save();
        ctx.translate(enemy.x - offsetX, enemy.y - offsetY);
        ctx.rotate(enemy.angle || 0);
        ctx.drawImage(
          furnica1Img,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'brown';
        ctx.fill();
        ctx.closePath();
      }
    } else if (enemy.type === 'gandacverde') {
      // Desenează gandacul verde
      if (gandacverdeImg.complete && gandacverdeImg.naturalWidth !== 0) {
        const scale = 0.1;
        const imgWidth = gandacverdeImg.naturalWidth * scale;
        const imgHeight = gandacverdeImg.naturalHeight * scale;
        ctx.save();
        ctx.translate(enemy.x - offsetX, enemy.y - offsetY);
        ctx.rotate(enemy.angle || 0);
        ctx.drawImage(
          gandacverdeImg,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, GANDACVERDE_PLACEHOLDER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#2E8B57';
        ctx.fill();
        ctx.closePath();
      }
    } else if (enemy.type === 'albina') {
      // Desenează albina
      if (albinaImg.complete && albinaImg.naturalWidth !== 0) {
        const scale = 0.035; // Și mai mică decât 0.05
        const imgWidth = albinaImg.naturalWidth * scale;
        const imgHeight = albinaImg.naturalHeight * scale;
        ctx.save();
        // Adaugă un efect de strălucire galbenă în jurul albinei
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 6; // Redus de la 10 la 6 pentru a se potrivi cu noua dimensiune
        ctx.translate(enemy.x - offsetX, enemy.y - offsetY);
        ctx.rotate(enemy.angle || 0);
        ctx.drawImage(
          albinaImg,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else {
        // Placeholder pentru albină când imaginea nu e încărcată
        ctx.save();
        // Corp galben (mai mic)
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, ALBINA_PLACEHOLDER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        // Aripile (două cercuri albe mai mici)
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX - 6, enemy.y - offsetY, 3, 0, Math.PI * 2);
        ctx.arc(enemy.x - offsetX + 6, enemy.y - offsetY, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.restore();
      }
    } else if (enemy.type === 'greier') {
      // Desenează greierul
      if (greierImg.complete && greierImg.naturalWidth !== 0) {
        const scale = 0.035; // puțin mai mare decât furnica
        const imgWidth = greierImg.naturalWidth * scale;
        const imgHeight = greierImg.naturalHeight * scale;
        ctx.save();
        ctx.translate(enemy.x - offsetX, enemy.y - offsetY);
        ctx.rotate(enemy.angle || 0);
        ctx.drawImage(
          greierImg,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, GREIER_PLACEHOLDER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#6b4f1d';
        ctx.fill();
        ctx.closePath();
      }
    } else if (enemy.type === 'libelula') {
      // Desenează libelula
      if (libelulaImg.complete && libelulaImg.naturalWidth !== 0) {
        const scale = 0.07;
        const imgWidth = libelulaImg.naturalWidth * scale;
        const imgHeight = libelulaImg.naturalHeight * scale;
        ctx.save();
        ctx.translate(enemy.x - offsetX, enemy.y - offsetY);
        ctx.rotate(enemy.angle || 0);
        ctx.drawImage(
          libelulaImg,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, LIBELULA_PLACEHOLDER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#4ec04e';
        ctx.fill();
        ctx.restore();
      }
    } else if (enemy.type === 'mazga') {
      // Desenează mazga
      if (mazgaImg.complete && mazgaImg.naturalWidth !== 0) {
        const scale = 0.05; // Redus de la 0.08 la 0.05 pentru a fi și mai mică
        const imgWidth = mazgaImg.naturalWidth * scale;
        const imgHeight = mazgaImg.naturalHeight * scale;
        ctx.save();
        // Adaugă un efect de strălucire galbenă în jurul mazgei
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 6; // Redus de la 10 la 6 pentru a se potrivi cu noua dimensiune
        ctx.translate(enemy.x - offsetX, enemy.y - offsetY);
        ctx.rotate(enemy.angle || 0);
        ctx.drawImage(
          mazgaImg,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else {
        // Placeholder pentru mazga când imaginea nu e încărcată
        ctx.save();
        // Corp galben (mai mic)
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, LIBELULA_PLACEHOLDER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        // Aripile (două cercuri albe mai mici)
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX - 6, enemy.y - offsetY, 3, 0, Math.PI * 2);
        ctx.arc(enemy.x - offsetX + 6, enemy.y - offsetY, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.restore();
      }
    } else if (enemy.type === 'heroticbeetle') {
      // Desenează heroticbeetle
      if (heroticbeetleImg.complete && heroticbeetleImg.naturalWidth !== 0) {
        const scale = 0.18; // Mult mai mare (crescut de la 0.12)
        const imgWidth = heroticbeetleImg.naturalWidth * scale;
        const imgHeight = heroticbeetleImg.naturalHeight * scale;
        ctx.save();
        // Adaugă un efect de strălucire roșiatică pentru aspect intimidant
        ctx.shadowColor = '#8B0000';
        ctx.shadowBlur = 8;
        ctx.translate(enemy.x - offsetX, enemy.y - offsetY);
        ctx.rotate(enemy.angle || 0);
        ctx.drawImage(
          heroticbeetleImg,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight
        );
        ctx.restore();
      } else {
        // Placeholder pentru heroticbeetle când imaginea nu e încărcată
        ctx.save();
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, HEROTICBEETLE_PLACEHOLDER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#800080'; // Mov închis pentru aspect intimidant
        ctx.fill();
        // Adaugă niște detalii pentru a arăta că e special
        ctx.beginPath();
        ctx.arc(enemy.x - offsetX, enemy.y - offsetY, HEROTICBEETLE_PLACEHOLDER_RADIUS - 3, 0, Math.PI * 2);
        ctx.fillStyle = '#4B0082';
        ctx.fill();
        ctx.restore();
      }
    }

    // Bara de HP deasupra inamicului (comună pentru toți inamicii)
    const healthBarWidth = enemy.type === 'gandacverde' ? 60 : 
                          enemy.type === 'albina' ? 50 : 
                          enemy.type === 'greier' ? 44 : 
                          enemy.type === 'libelula' ? 50 : 
                          enemy.type === 'mazga' ? 50 : 
                          enemy.type === 'heroticbeetle' ? 80 : 36; // Heroticbeetle are bara cea mai mare
    const healthBarYOffset = enemy.type === 'gandacverde' ? -40 : 
                            enemy.type === 'albina' ? -35 : 
                            enemy.type === 'greier' ? -36 : 
                            enemy.type === 'libelula' ? -36 : 
                            enemy.type === 'mazga' ? -36 : 
                            enemy.type === 'heroticbeetle' ? -45 : -32; // Heroticbeetle are offset mai mare

    ctx.save();
    ctx.fillStyle = 'red';
    ctx.fillRect(enemy.x - offsetX - healthBarWidth / 2, enemy.y - offsetY + healthBarYOffset, healthBarWidth, 6);
    ctx.fillStyle = 'yellow'; // Changed from 'lime' to 'yellow' for enemy HP
    ctx.fillRect(enemy.x - offsetX - healthBarWidth / 2, enemy.y - offsetY + healthBarYOffset, healthBarWidth * (enemy.hp / enemy.maxHp), 6);
    ctx.strokeStyle = '#222';
    ctx.strokeRect(enemy.x - offsetX - healthBarWidth / 2, enemy.y - offsetY + healthBarYOffset, healthBarWidth, 6);
    ctx.restore();
  }
}

function drawTurretProjectiles(ctx, offsetX, offsetY) {
  for (const projectile of turretProjectiles) {
    if (strugureImg.complete && strugureImg.naturalWidth !== 0) {
      const scale = 0.01; // și mai mic decât înainte
      const imgWidth = strugureImg.naturalWidth * scale;
      const imgHeight = strugureImg.naturalHeight * scale;
      ctx.drawImage(
        strugureImg,
        projectile.x - offsetX - imgWidth / 2,
        projectile.y - offsetY - imgHeight / 2,
        imgWidth,
        imgHeight
      );
    } else {
      ctx.beginPath();
      ctx.arc(projectile.x - offsetX, projectile.y - offsetY, 1.5, 0, Math.PI * 2); // fallback și mai mic
      ctx.fillStyle = 'purple';
      ctx.fill();
      ctx.closePath();
    }
  }
}

function updateTurretProjectiles() {
  for (let i = turretProjectiles.length - 1; i >= 0; i--) {
    const projectile = turretProjectiles[i];
    let dx, dy, distance;

    // If projectile has a specific, valid target, aim at it.
    if (projectile.target && enemies.indexOf(projectile.target) !== -1 && projectile.target.hp > 0) {
      dx = projectile.target.x - projectile.x;
      dy = projectile.target.y - projectile.y;
      distance = Math.hypot(dx, dy);

      // Check for collision with the specific target
      if (distance < 24) { // 24 is a general collision radius (increased for easier hits)
        projectile.target.hp -= projectile.damage;
        createFurnicaHitParticles(projectile.target.x, projectile.target.y);
        if (projectile.target.hp <= 0) {
          createBloodParticles(projectile.target.x, projectile.target.y, 25, projectile.target.type);
          createBloodstain(projectile.target.x, projectile.target.y, projectile.target.type);
          let audio = insectkillPool[insectkillPoolIndex];
          try { audio.currentTime = 0; audio.play(); } catch (e) {}
          insectkillPoolIndex = (insectkillPoolIndex + 1) % INSECTKILL_POOL_SIZE;
          const idx = enemies.indexOf(projectile.target);
          if (idx !== -1) {
            enemies.splice(idx, 1);
            money += projectile.target.moneyValue;
          }
        }
        turretProjectiles.splice(i, 1);
        continue;
      }
    } else {
      // Projectile has no specific target OR target is invalid/dead.
      // It moves in its initial direction (dirX, dirY).
      dx = projectile.dirX;
      dy = projectile.dirY;
      distance = 1; // Normalize direction vector

      // Check for collision with ANY enemy if it's a non-tracking projectile (e.g., shotgun)
      // or if its original target is gone.
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (enemy.hp > 0 && Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) < 36) { // 36 for shotgun projectiles (increased for easier hits)
          enemy.hp -= projectile.damage;
          createFurnicaHitParticles(enemy.x, enemy.y);
          if (enemy.hp <= 0) {
            createBloodParticles(enemy.x, enemy.y, 25, enemy.type);
            createBloodstain(enemy.x, enemy.y, enemy.type);
            let audio = insectkillPool[insectkillPoolIndex];
            try { audio.currentTime = 0; audio.play(); } catch (e) {}
            insectkillPoolIndex = (insectkillPoolIndex + 1) % INSECTKILL_POOL_SIZE;
            enemies.splice(j, 1);
            money += enemy.moneyValue;
          }
          turretProjectiles.splice(i, 1);
          break; // Projectile hits one enemy and is removed
        }
      }
      if (i >= turretProjectiles.length) continue; // Projectile might have been removed
    }

    // Limitează distanța maximă a proiectilului
    if (Math.abs(projectile.x) > MAP_WIDTH || Math.abs(projectile.y) > MAP_HEIGHT) {
      turretProjectiles.splice(i, 1);
      continue;
    }
    // Actualizează poziția proiectilului
    projectile.x += (dx / distance) * TURRET_PROJECTILE_SPEED;
    projectile.y += (dy / distance) * TURRET_PROJECTILE_SPEED;

    // Limitează distanța maximă a proiectilului strugure
    if (
      typeof projectile.startX === 'number' && typeof projectile.startY === 'number' &&
      Math.hypot(projectile.x - projectile.startX, projectile.y - projectile.startY) > 1500
    ) {
      turretProjectiles.splice(i, 1);
      continue;
    }
  }
}

function spawnEnemies() {
  // Spawnează ENEMY_PER_WAVE inamici random la marginea hărții
  for (let i = 0; i < ENEMY_PER_WAVE; i++) {
    let edge = Math.floor(Math.random() * 4); // 0: sus, 1: jos, 2: stânga, 3: dreapta
    let x, y;
    if (edge === 0) { // sus
      x = Math.random() * (MAP_WIDTH - 80) + 40;
      y = 40;
    } else if (edge === 1) { // jos
      x = Math.random() * (MAP_WIDTH - 80) + 40;
      y = MAP_HEIGHT - 40;
    } else if (edge === 2) { // stânga
      x = 40;
      y = Math.random() * (MAP_HEIGHT - 80) + 40;
    } else { // dreapta
      x = MAP_WIDTH - 40;
      y = Math.random() * (MAP_HEIGHT - 80) + 40;
    }
    enemies.push({
      x: x,
      y: y,
      hp: ENEMY_HP,
      speed: ENEMY_SPEED
    });
  }
}

function updateEnemies() {
  const castleX = MAP_WIDTH / 2;
  const castleY = MAP_HEIGHT / 2;
  const now = performance.now();
  for (const enemy of enemies) {
    let prevX = enemy.x;
    let prevY = enemy.y;

    // --- AI pentru libelula: atac cu mazga si oprire cand are target ---
    if (enemy.type === 'libelula') {
      let target = null;
      let minDist = 300; // Range-ul libelulei redus la 300
      // 1. Prioritate Ion
      if (player.hp > 0) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          target = { type: 'player', ref: player, x: player.x, y: player.y };
        }
      }
      // 2. Turete
      // Cautam tureta cea mai apropiata DOAR DACA Ion nu e target
      if (!target) {
        for (const turret of turrets) {
          if (turret.type === 'wall' || turret.type === 'wall2') continue; // Libelula ignores walls

          const dx = turret.x - enemy.x;
          const dy = turret.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            target = { type: 'turret', ref: turret, x: turret.x, y: turret.y };
          }
        }
      }
      // 3. Castel
      // Cautam castelul DOAR DACA Ion sau o tureta nu sunt target
      if (!target) {
        const dx = MAP_WIDTH / 2 - enemy.x;
        const dy = MAP_HEIGHT / 2 - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          target = { type: 'castle', x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
        }
      }

      // 4. Daca are target in range, SE OPRESTE si trage
      if (target) {
        // Actualizează unghiul libelulei pentru a se uita la țintă
        const angleToTarget = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        enemy.angle = angleToTarget;

        // Trage dacă cooldown-ul permite
        if (now - (enemy.lastAttack || 0) > 500) { // 2 proiectile/sec
          enemy.lastAttack = now;
          const dx = target.x - enemy.x;
          const dy = target.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          mazgaProjectiles.push({
            x: enemy.x,
            y: enemy.y,
            dirX: dx / dist,
            dirY: dy / dist,
            traveled: 0,
            // Asiguram ca pasam referinta corecta la target pentru updateMazgaProjectiles
            target: target.type === 'player' ? player : (target.type === 'turret' ? target.ref : 'castle'),
            damage: 5 // Damage-ul proiectilului mazga redus la 5
          });
        }
        // Libelula se opreste cand are o tinta in range si trage
        // Daca vrei sa se miste putin (ex. zigzag), adauga aici logica de miscare limitata
      } else {
        // Dacă nu are target în range, merge spre castel (sau alta logica de patrulare)
        const dx = MAP_WIDTH / 2 - enemy.x;
        const dy = MAP_HEIGHT / 2 - enemy.y;
        const distToCastle = Math.sqrt(dx * dx + dy * dy);
        if (distToCastle > 1) { // Evita impartirea la zero
          enemy.x += (dx / distToCastle) * enemy.speed;
          enemy.y += (dy / distToCastle) * enemy.speed;
        }
      }
      // enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX); // Comentat sau eliminat pentru a pastra unghiul spre target
      continue; // Trecem la urmatorul inamic, logica pentru libelula e completa
    }

    // --- Intelligent Movement for Furnica, GandacVerde & HeroticBeetle ---
    if (enemy.type === 'furnica' || enemy.type === 'gandacverde' || enemy.type === 'heroticbeetle') {
        let primaryTargetX = castleX;
        let primaryTargetY = castleY;
        let isPlayerTargeted = false;

        // 1. Determine Primary Target
        if (enemy.type === 'furnica') {
            const dxIon = player.x - enemy.x;
            const dyIon = player.y - enemy.y;
            const distIon = Math.sqrt(dxIon * dxIon + dyIon * dyIon);
            if (player.hp > 0 && distIon < 220) {
                primaryTargetX = player.x;
                primaryTargetY = player.y;
                isPlayerTargeted = true;
            }
        }
        
        // For gandacverde and heroticbeetle, castle is the primary target (no active turret targeting)
        // Both will only attack walls that block their path to the castle

        const enemySpeed = enemy.speed;
        const enemyRadius = enemy.collisionRadius || 10; // Default if not set

        // 2. Direct Path Attempt
        let dirX = primaryTargetX - enemy.x;
        let dirY = primaryTargetY - enemy.y;
        let distToTarget = Math.sqrt(dirX * dirX + dirY * dirY);

        if (distToTarget < 1) { // Already at target or very close
            enemy.angle = Math.atan2(dirY, dirX);
            continue;
        }

        let potentialNextX = enemy.x + (dirX / distToTarget) * enemySpeed;
        let potentialNextY = enemy.y + (dirY / distToTarget) * enemySpeed;

        // 3. Check for Collision with a wall
        let collidingWall = isCollidingWithWall(potentialNextX, potentialNextY, enemyRadius);

        if (collidingWall) {
            let foundAlternativePath = false;
            const currentAngleToTarget = Math.atan2(dirY, dirX); // Angle to primary target

            // Try a range of angles to find a clear path
            // Iterate from -90 to +90 degrees in 15-degree steps relative to currentAngleToTarget
            for (let offsetDegrees = -90; offsetDegrees <= 90; offsetDegrees += 15) {
                if (offsetDegrees === 0) continue; // Skip the original blocked direction

                const testAngle = currentAngleToTarget + (offsetDegrees * Math.PI / 180);
                let testX = enemy.x + Math.cos(testAngle) * enemySpeed;
                let testY = enemy.y + Math.sin(testAngle) * enemySpeed;

                if (!isCollidingWithWall(testX, testY, enemyRadius)) {
                    // Check if this path is generally towards the primary target
                    let newDirX = primaryTargetX - testX;
                    let newDirY = primaryTargetY - testY;
                    let newDistToTarget = Math.sqrt(newDirX * newDirX + newDirY * newDirY);

                    // Allow move if it doesn't take us further from target, or only slightly further
                    // This prevents moving directly away from the target unless it's a very small step
                    if (newDistToTarget < distToTarget + enemySpeed * 0.5) { 
                        enemy.x = testX;
                        enemy.y = testY;
                        foundAlternativePath = true;
                        break; // Found a good alternative path
                    }
                }
            }

            if (!foundAlternativePath) {
                // Still Blocked after trying all angles - Attack the specific wall it originally collided with
                const wallDirX = collidingWall.x - enemy.x;
                const wallDirY = collidingWall.y - enemy.y;
                const distToCollidingWall = Math.sqrt(wallDirX * wallDirX + wallDirY * wallDirY);
                if (distToCollidingWall > 1) { 
                    enemy.x += (wallDirX / distToCollidingWall) * enemySpeed;
                    enemy.y += (wallDirY / distToCollidingWall) * enemySpeed;
                }
            } 
        } else {
            // Path is Clear - Move to potentialNextPosition
            enemy.x = potentialNextX;
            enemy.y = potentialNextY;
        }
        enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
        continue; // End processing for furnica/gandacverde/heroticbeetle
    }
    // --- End Intelligent Movement for Furnica, GandacVerde & HeroticBeetle ---

    // --- AI Albina (ramane neschimbat) ---
    if (enemy.type === 'albina') {
      // Verifică mai întâi dacă Ion (player) este aproape
      const dxIon = player.x - enemy.x;
      const dyIon = player.y - enemy.y;
      const distIon = Math.sqrt(dxIon * dxIon + dyIon * dyIon);

      if (player.hp > 0 && distIon < 220) { // Aceeași distanță ca la furnici
        // Albina atacă pe Ion
        const zigzagX = Math.sin(now * ALBINA_ZIGZAG_FREQUENCY + enemy.zigzagOffset) * ALBINA_ZIGZAG_AMPLITUDE;
        const angle = Math.atan2(dyIon, dxIon);
        const perpAngle = angle + Math.PI / 2;
        
        if (distIon > 38) { // Distanța de atac aproape
          enemy.x += Math.cos(angle) * enemy.speed + Math.cos(perpAngle) * zigzagX * 0.1;
          enemy.y += Math.sin(angle) * enemy.speed + Math.sin(perpAngle) * zigzagX * 0.1;
        } else if (now - (enemy.lastAttack || 0) > ALBINA_ATTACK_COOLDOWN) {
          // Atacă pe Ion când e aproape
          player.hp -= ALBINA_ATTACK_DAMAGE;
          enemy.lastAttack = now;
        }
      } else {
        // Dacă Ion nu e aproape, verifică turetele
        let targetTurret = null;
        let minTurretDist = 120; // Range pentru targetare turete
        for (const turret of turrets) {
          if (turret.type === 'tureta_bazapistol' || turret.type === 'tureta_smg' || turret.type === 'tureta_minabani') {
            const dxT = turret.x - enemy.x;
            const dyT = turret.y - enemy.y;
            const distT = Math.sqrt(dxT * dxT + dyT * dyT);
            if (distT < minTurretDist) {
              minTurretDist = distT;
              targetTurret = turret;
            }
          }
        }

        if (targetTurret) {
          // Albina atacă tureta
          const dx = targetTurret.x - enemy.x;
          const dy = targetTurret.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Mișcare zigzag spre turetă
          const zigzagX = Math.sin(now * ALBINA_ZIGZAG_FREQUENCY + enemy.zigzagOffset) * ALBINA_ZIGZAG_AMPLITUDE;
          const angle = Math.atan2(dy, dx);
          const perpAngle = angle + Math.PI / 2;
          
          if (dist > 38) {
            enemy.x += Math.cos(angle) * enemy.speed + Math.cos(perpAngle) * zigzagX * 0.1;
            enemy.y += Math.sin(angle) * enemy.speed + Math.sin(perpAngle) * zigzagX * 0.1;
          } else if (now - (enemy.lastAttack || 0) > ALBINA_ATTACK_COOLDOWN) {
            targetTurret.hp -= ALBINA_ATTACK_DAMAGE;
            enemy.lastAttack = now;
          }
        } else {
          // Dacă nu sunt turete aproape, merge spre castel
          const dx = castleX - enemy.x;
          const dy = castleY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Mișcare zigzag spre castel
          const zigzagX = Math.sin(now * ALBINA_ZIGZAG_FREQUENCY + enemy.zigzagOffset) * ALBINA_ZIGZAG_AMPLITUDE;
          const angle = Math.atan2(dy, dx);
          const perpAngle = angle + Math.PI / 2;
          
          if (dist > 38) {
            enemy.x += Math.cos(angle) * enemy.speed + Math.cos(perpAngle) * zigzagX * 0.1;
            enemy.y += Math.sin(angle) * enemy.speed + Math.sin(perpAngle) * zigzagX * 0.1;
          } else if (now - (enemy.lastAttack || 0) > ALBINA_ATTACK_COOLDOWN) {
            castleHP -= ALBINA_ATTACK_DAMAGE;
            enemy.lastAttack = now;
          }
        }
      }

      // Actualizează unghiul pentru rotirea sprite-ului
      enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
      continue;
    }

    // --- AI Greier: Targetare cu prioritate Ion > turetă > castel, range mare ---
    if (enemy.type === 'greier') {
      const GREIER_TARGET_RANGE = 700;
      let target = null;
      let minDist = GREIER_TARGET_RANGE;
      // Ion
      if (player.hp > 0) {
        const dxIon = player.x - enemy.x;
        const dyIon = player.y - enemy.y;
        const distIon = Math.sqrt(dxIon * dxIon + dyIon * dyIon);
        if (distIon < minDist) {
          minDist = distIon;
          target = {x: player.x, y: player.y, type: 'player'};
        }
      }
      // Turete
      for (const turret of turrets) {
        if (turret.type === 'tureta_bazapistol' || turret.type === 'tureta_smg' || turret.type === 'tureta_minabani') {
          const dxT = turret.x - enemy.x;
          const dyT = turret.y - enemy.y;
          const distT = Math.sqrt(dxT * dxT + dyT * dyT);
          if (distT < minDist) {
            minDist = distT;
            target = {x: turret.x, y: turret.y, type: 'turret', turret};
          }
        }
      }
      // Castel fallback
      if (!target) {
        target = {x: castleX, y: castleY, type: 'castle'};
      }
      // Săritură la fiecare 2 secunde
      if (!enemy.lastJump) enemy.lastJump = now;
      if (now - enemy.lastJump > GREIER_JUMP_COOLDOWN) {
        // Săritură spre țintă (max GREIER_JUMP_DISTANCE sau până la țintă)
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          const jumpDist = Math.min(GREIER_JUMP_DISTANCE, dist);
          const potentialJumpX = enemy.x + (dx / dist) * jumpDist;
          const potentialJumpY = enemy.y + (dy / dist) * jumpDist;
          if (!isCollidingWithWall(potentialJumpX, potentialJumpY, enemy.collisionRadius || GREIER_PLACEHOLDER_RADIUS)) {
            enemy.x = potentialJumpX;
            enemy.y = potentialJumpY;
          }
        }
        enemy.lastJump = now;
      } else {
        // Mișcare normală rapidă spre țintă
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          const potentialMoveX = enemy.x + (dx / dist) * enemy.speed;
          const potentialMoveY = enemy.y + (dy / dist) * enemy.speed;
          if (!isCollidingWithWall(potentialMoveX, potentialMoveY, enemy.collisionRadius || GREIER_PLACEHOLDER_RADIUS)) {
            enemy.x = potentialMoveX;
            enemy.y = potentialMoveY;
          }
        }
      }
      enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
      continue;
    }

    // Comportament normal pentru furnici și gândaci (heroticbeetle exclude - folosește intelligent movement)
    if (enemy.type === 'heroticbeetle') {
      // heroticbeetle folosește doar intelligent movement, nu intră în logica de targetare activă
      enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
      continue;
    }
    
    let targetTurret = null;
    let minTurretDist = 99999;
    for (const turret of turrets) {
      // Melee enemies now also target walls if they are close
      if (attackableTurretTypes.includes(turret.type)) { // Reuse defined list from handleTurretDamage
        const dxT = turret.x - enemy.x;
        const dyT = turret.y - enemy.y;
        const distT = Math.sqrt(dxT * dxT + dyT * dyT);
        // Prioritize walls if they are very close (e.g., within 45 units)
        // and other turrets if within 120 units (standard engagement range)
        let engagementRange = (turret.type === 'wall' || turret.type === 'wall2') ? 45 : 120; // MODIFIED HERE
        if (distT < engagementRange && distT < minTurretDist) {
          minTurretDist = distT;
          targetTurret = turret;
        }
      }
    }

    // If already targeting a turret (especially a close wall), proceed to attack it
    if (targetTurret) {
      const dx = targetTurret.x - enemy.x;
      const dy = targetTurret.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        enemy.x += (dx / dist) * enemy.speed;
        enemy.y += (dy / dist) * enemy.speed;
      }
      enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
      continue;
    }

    // --- Path Blocking Check ---
    let pathTargetX = castleX;
    let pathTargetY = castleY;
    let isPlayerPrimaryTarget = false;

    if (enemy.type === 'furnica') {
      const dxIon = player.x - enemy.x;
      const dyIon = player.y - enemy.y;
      const distIon = Math.sqrt(dxIon * dxIon + dyIon * dyIon);
      if (player.hp > 0 && distIon < 220) { // Player is primary target
        pathTargetX = player.x;
        pathTargetY = player.y;
        isPlayerPrimaryTarget = true;
      }
    }
    // For gandacverde, castle is always primary target unless a wall blocks the way

    // Check for blocking walls on the way to the primary target (castle or player)
    const pathPoints = getPointsOnLine(enemy.x, enemy.y, pathTargetX, pathTargetY, 3); // Check 3 points
    let blockingWall = null;
    for (const point of pathPoints) {
        for (const wall of turrets.filter(t => t.type === 'wall' || t.type === 'wall2')) { // MODIFIED HERE
            const dxWall = wall.x - point.x;
            const dyWall = wall.y - point.y;
            const distToWall = Math.sqrt(dxWall*dxWall + dyWall*dyWall);
            if (distToWall < 25) { // If a point on the path is very close to a wall's center
                blockingWall = wall;
                break;
            }
        }
        if (blockingWall) break;
    }

    if (blockingWall) {
        targetTurret = blockingWall; // Override target to the blocking wall
        const dx = targetTurret.x - enemy.x;
        const dy = targetTurret.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
            enemy.x += (dx / dist) * enemy.speed;
            enemy.y += (dy / dist) * enemy.speed;
        }
        enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
        continue;
    }
    // --- End Path Blocking Check ---


    // If no close turret and no blocking wall, proceed with original logic
    if (isPlayerPrimaryTarget) { // If player was the primary target and path is clear
        const dxIon = player.x - enemy.x;
        const dyIon = player.y - enemy.y;
        const distIon = Math.sqrt(dxIon * dxIon + dyIon * dyIon);
        if (distIon > 1) {
            enemy.x += (dxIon / distIon) * enemy.speed;
            enemy.y += (dyIon / distIon) * enemy.speed;
        }
        enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
        continue;
    }

    // Default: move towards castle if no player target or other turret/wall target
    const dx = castleX - enemy.x;
    const dy = castleY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      enemy.x += (dx / dist) * enemy.speed;
      enemy.y += (dy / dist) * enemy.speed;
    }
    enemy.angle = Math.atan2(enemy.y - prevY, enemy.x - prevX);
  }
}

function handleCastleDamage(speedFactor = 1) {
  const castleX = MAP_WIDTH / 2;
  const castleY = MAP_HEIGHT / 2;
  let now = performance.now();
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const dx = castleX - enemy.x;
    const dy = castleY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 60) {
      let dmg;
      if (enemy.type === 'greier') {
        dmg = GREIER_DAMAGE_PER_SECOND;
      } else if (enemy.type === 'heroticbeetle') {
        dmg = HEROTICBEETLE_DAMAGE_PER_SECOND;
      } else {
        dmg = ENEMY_DAMAGE_PER_SECOND;
      }
      if (now - (enemy.lastCastleDamage || 0) > 1000 / speedFactor) {
        castleHP -= dmg * speedFactor;
        enemy.lastCastleDamage = now;
        if (castleHP < 0) castleHP = 0;
      }
    }
  }
  if (castleHP <= 0) {
    isGameOver = true;
  }
}
function handleIonDamage(speedFactor = 1) {
  let now = performance.now();
  for (const enemy of enemies) {
    // Heroticbeetle ignores Ion completely
    if (enemy.type === 'heroticbeetle') continue;
    
    if (player.hp > 0) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 38) {
        let dmg = enemy.type === 'greier' ? GREIER_DAMAGE_PER_SECOND : 5;
        if (now - (enemy.lastIonDamage || 0) > 1000 / speedFactor) {
          player.hp -= dmg * speedFactor;
          enemy.lastIonDamage = now;
          if (player.hp < 0) player.hp = 0;
        }
      }
    }
  }
  if (player.hp <= 0 && !player.respawnTimeout) {
    // Ion dispare și se respawnează după 5 secunde la castel
    player.respawnEndTime = performance.now() + 5000;
    player.respawnTimeout = setTimeout(() => {
      player.x = MAP_WIDTH / 2;
      player.y = MAP_HEIGHT / 2;
      player.hp = player.maxHp;
      player.respawnTimeout = null;
      player.respawnEndTime = null;
    }, 5000);
  }
}

function drawMinimap(ctx) {
  // Setări minimapă
  const minimapWidth = 180;
  const minimapHeight = 180;
  const margin = 18;
  const x = CANVAS_WIDTH - minimapWidth - margin;
  const y = CANVAS_HEIGHT - minimapHeight - margin;

  // Fundal minimapă
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, minimapWidth, minimapHeight);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, minimapWidth, minimapHeight);

  // Harta (doar contur)
  ctx.save();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, y + 10, minimapWidth - 20, minimapHeight - 20);
  ctx.restore();

  // Poziția playerului
  const px = x + 10 + (player.x / MAP_WIDTH) * (minimapWidth - 20);
  const py = y + 10 + (player.y / MAP_HEIGHT) * (minimapHeight - 20);
  ctx.save();
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Poziția castelului
  const cx = x + 10 + (MAP_WIDTH / 2 / MAP_WIDTH) * (minimapWidth - 20);
  const cy = y + 10 + (MAP_HEIGHT / 2 / MAP_HEIGHT) * (minimapHeight - 20);
  ctx.save();
  ctx.fillStyle = 'lime';
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
function drawModeSelectionUI(ctx) {
  drawSideSelectionMenu(ctx);
}

function gameLoop() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Game over screen for castle
  if (castleHP <= 0) {
    isGameOver = true;
    ctx.save();
    ctx.fillStyle = 'black';
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = '32px Arial';
    ctx.fillText('Apasă SPACE pentru restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    ctx.restore();
    requestAnimationFrame(gameLoop);
    return;
  }

  // Handle continuous wall placement if RMB is held
  if (isRightMouseButtonDown && current_mode === 'wall' && hoveredGrid.x !== null && hoveredGrid.y !== null) {
    const now = performance.now();
    if (now - lastWallPlacementTime >= WALL_PLACEMENT_COOLDOWN) {
        // Ensure player isn't trying to select an existing turret while dragging
        let attemptingToSelect = false;
        for (const turret of turrets) {
            const isWall = turret.type === 'wall' || turret.type === 'wall2';
            const size = isWall ? 20 : 60;
            const realX = hoveredGrid.x * 40 + 20; // Center of hovered grid cell
            const realY = hoveredGrid.y * 40 + 20;

            if ( realX >= turret.x - size && realX <= turret.x + size &&
                 realY >= turret.y - size && realY <= turret.y + size ) {
                attemptingToSelect = true;
                break;
            }
        }
        if (!attemptingToSelect) {
            tryPlaceWall(hoveredGrid.x, hoveredGrid.y);
            // lastWallPlacementTime is updated within tryPlaceWall
        }
    }
  }

  // Handle auto-firing when left mouse button is held
  if (isLeftMouseButtonDown && player.hp > 0 && !player.respawnTimeout) {
    const now = performance.now();
    if (now - lastBananaShot >= BANANA_SHOOT_COOLDOWN) {
      // Create a synthetic mouse event using the last known mouse position
      const mouseEvent = {
        clientX: canvas.getBoundingClientRect().left + lastMouseX,
        clientY: canvas.getBoundingClientRect().top + lastMouseY
      };
      shootBanana(mouseEvent);
      lastBananaShot = now; // <-- Adaugă această linie pentru a respecta cooldown-ul
    }
  }

  // --- Wave logic ---
  if (!isWaveActive && !waveIntermission) {
    startWave();
  }
  checkWaveEnd();

  // --- Aplica viteza jocului ---
  for (let i = 0; i < gameSpeed; i++) {
    updatePlayer();
    updateProjectiles();
    updateBloodParticles();
    // NOU: Actualizeaza particulele de scantei
    updateSparkParticles(); 
    updateTurrets(gameSpeed); // transmit gameSpeed ca factor
    updateTurretProjectiles();
    updateMazgaProjectiles();
    updateEnemies();
    handleBananaEnemyCollision();
    handleCastleDamage(gameSpeed); // transmit gameSpeed ca factor
    handleIonDamage(gameSpeed); // transmit gameSpeed ca factor
    handleTurretDamage(gameSpeed); // transmit gameSpeed ca factor
    updateMoneyMines(); // Adăugat pentru a genera bani din minele de bani
    updateBloodstains(); // NOU: Actualizează petele de sânge
    updateFurnicaHitParticles();
  }

  // Calculează offsetul pentru ca playerul să fie centrat
  let offsetX = Math.max(0, Math.min(player.x - CANVAS_WIDTH / 2, MAP_WIDTH - CANVAS_WIDTH));
  let offsetY = Math.max(0, Math.min(player.y - CANVAS_HEIGHT / 2, MAP_HEIGHT - CANVAS_HEIGHT));

  if (isNaN(offsetX) || isNaN(offsetY)) {
    console.error("ERROR: offsetX or offsetY is NaN!", {px: player.x, py: player.y, cW: CANVAS_WIDTH, cH: CANVAS_HEIGHT});
    offsetX = 0; // Fallback to prevent further errors
    offsetY = 0;
  }

  // Desenează terenul (tile/repeat imaginea pe toată harta)
  for (let x = 0; x < MAP_WIDTH; x += terenImg.width) {
    for (let y = 0; y < MAP_HEIGHT; y += terenImg.height) {
      // Desenează doar ce e vizibil pe canvas
      if (
        x + terenImg.width > offsetX &&
        x < offsetX + CANVAS_WIDTH &&
        y + terenImg.height > offsetY &&
        y < offsetY + CANVAS_HEIGHT
      ) {
        ctx.drawImage(
          terenImg,
          x - offsetX,
          y - offsetY,
          terenImg.width,
          terenImg.height
        );
      }
    }
  }

  // NOU: Desenează petele de sânge pe sol (sub grid și alte elemente)
  drawBloodstains(ctx, offsetX, offsetY);

  // Desenează grid-ul de 40x40 blocat pe hartă (nu pe ecran)
  ctx.save();
  ctx.strokeStyle = '#90ee90'; // verde deschis
  ctx.globalAlpha = 0.18; // puțin mai puțin transparent, să fie vizibile
  ctx.lineWidth = 1;
  // Calculează primul grid vizibil pe ecran
  let startGridX = Math.floor(offsetX / 40) * 40;
  let endGridX = offsetX + CANVAS_WIDTH;
  let startGridY = Math.floor(offsetY / 40) * 40;
  let endGridY = offsetY + CANVAS_HEIGHT;

  // Desenează pătrățelele ocupate de turete cu verde mai închis
  for (let gx = Math.floor(startGridX / 40); gx <= Math.floor(endGridX / 40); gx++) {
    for (let gy = Math.floor(startGridY / 40); gy <= Math.floor(endGridY / 40); gy++) {
      if (turretGrid[`${gx}_${gy}`]) {
        ctx.save();
        ctx.fillStyle = '#225c22'; // verde mai închis
        ctx.globalAlpha = 0.7;
        ctx.fillRect(gx * 40 - offsetX, gy * 40 - offsetY, 40, 40);
        ctx.restore();
      } else if (isInNoTurretZone(gx, gy)) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 100, 100, 0.35)'; // roșu deschis, semitransparent
        ctx.fillRect(gx * 40 - offsetX, gy * 40 - offsetY, 40, 40);
        ctx.restore();
      }
    }
  }

  // Highlight pătrățelul peste care este cursorul
  if (
    hoveredGrid.x !== null && hoveredGrid.y !== null &&
    hoveredGrid.x * 40 >= startGridX && hoveredGrid.x * 40 < endGridX &&
    hoveredGrid.y * 40 >= startGridY && hoveredGrid.y * 40 < endGridY
  ) {
    ctx.save();
    ctx.fillStyle = '#4ec04e'; // verde puțin mai închis
    ctx.globalAlpha = 0.5;
    ctx.fillRect(
      hoveredGrid.x * 40 - offsetX,
      hoveredGrid.y * 40 - offsetY,
      40,
      40
    );
    ctx.restore();
  }

  // Linii verticale
  for (let x = startGridX; x <= endGridX; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x - offsetX, 0);
    ctx.lineTo(x - offsetX, CANVAS_HEIGHT);
    // ctx.stroke(); // Grid lines removed
  }
  // Linii orizontale
  for (let y = startGridY; y <= endGridY; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y - offsetY);
    ctx.lineTo(CANVAS_WIDTH, y - offsetY);
    // ctx.stroke(); // Grid lines removed
  }
  ctx.restore();

  // Desenează castelul în mijlocul hărții
  drawCastle(ctx, offsetX, offsetY);

  // Desenează turetele
  drawTurrets(ctx, offsetX, offsetY);

  // --- Desenează UI upgrade pentru tureta selectată (dacă e pistol) ---
  // if (selectedTurret && selectedTurret.type === 'tureta_bazapistol') {
  //     drawTurretUpgradeUI(ctx, selectedTurret, offsetX, offsetY);
  // }

  // Desenează particulele de sânge
  drawBloodParticles(ctx, offsetX, offsetY);

  // NOU: Deseneaza particulele de scantei
  drawSparkParticles(ctx, offsetX, offsetY);

  // Desenează proiectilele turetelor
  drawTurretProjectiles(ctx, offsetX, offsetY);

  // Desenează proiectilele (bananele) ale playerului
  drawProjectiles(ctx, offsetX, offsetY);

  // Desenează proiectilele mazga ale libelulelor
  drawMazgaProjectiles(ctx, offsetX, offsetY);

  drawPlayer(ctx, offsetX, offsetY);

  // Desenează inamicii furnica1
  drawEnemies(ctx, offsetX, offsetY);

  // Desenează minimapa în dreapta jos
  drawMinimap(ctx);

  // Desenează UI de selecție mod jos pe mijloc
  drawModeSelectionUI(ctx);

  // --- Highlight grid pentru plasare tureta struguri ---
  drawTurretPlacementPreview(ctx, offsetX, offsetY);

  // Desenează banii în stânga sus
  function drawMoney(ctx) {
    ctx.save();
    // Desenează un simbol de monedă (galbenă, stil simplu, cerc cu contur)
    ctx.beginPath();
    ctx.arc(38, 38, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066'; // galben auriu
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    // Simbol $ stilizat în mijlocul monedei
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 38, 38);
    // Textul cu suma lângă simbol, font medieval și auriu mai închis
    ctx.font = 'bold 32px Georgia, Times New Roman, serif';
    ctx.fillStyle = '#7a5a00'; // auriu foarte închis
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(money, 62, 38);
    ctx.restore();
  }

  drawMoney(ctx);

  // Desenează UI wave
  drawWaveUI(ctx);

  // Desenează butonul de viteză în stânga jos
  drawSpeedButton(ctx);
  
  // Desenează butonul de skip waves
  drawSkipButton(ctx);

  // Desenează meniul de upgrade pentru tureta selectată (dacă e pistol)
  drawUpgradeMenu(ctx);

  // Desenează bara de HP a castelului pe ultimul layer
  drawCastleHPBar(ctx, offsetX, offsetY);
  // --- NOU: Desenează iconița de setări și meniul dacă e deschis ---
  drawSettingsIcon(ctx);
  drawSettingsMenu(ctx); // Va desena doar dacă isSettingsMenuOpen este true

  // In gameLoop, after updateBloodParticles(), add:
  updateFurnicaHitParticles();

  // In gameLoop, after drawBloodParticles(), add:
  drawFurnicaHitParticles(ctx, offsetX, offsetY);

  requestAnimationFrame(gameLoop);
}
// --- CONFIG: ZONA INTERZISĂ PENTRU TURETE ÎN JURUL CASTELULUI ---
const NO_TURRET_ZONE_SIZE = 6; // mai mic: 6x6 grid (era 8)
const NO_TURRET_ZONE_HALF = Math.floor(NO_TURRET_ZONE_SIZE / 2);
const CASTLE_GRID_X = Math.floor(MAP_WIDTH / 2 / 40);
const CASTLE_GRID_Y = Math.floor(MAP_HEIGHT / 2 / 40);

// Returnează true dacă pătratul (gridX, gridY) este în zona interzisă
function isInNoTurretZone(gridX, gridY) {
  // Zona interzisă este de la (CASTLE_GRID_X-8) la (CASTLE_GRID_X+7) inclusiv (16 pătrate)
  return (
    gridX >= CASTLE_GRID_X - NO_TURRET_ZONE_HALF &&
    gridX <= CASTLE_GRID_X + NO_TURRET_ZONE_HALF - 1 &&
    gridY >= CASTLE_GRID_Y - NO_TURRET_ZONE_HALF &&
    gridY <= CASTLE_GRID_Y + NO_TURRET_ZONE_HALF - 1
  );
}

// Verifică dacă o turetă 3x3 (centrată pe centerGridX, centerGridY) atinge zona interzisă
function doesTurretOverlapNoZone(centerGridX, centerGridY) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (isInNoTurretZone(centerGridX + dx, centerGridY + dy)) {
        return true;
      }
    }
  }
  return false;
}

// --- DAMAGE FURNICA1 -> TURETA STRUGURI ---
function handleTurretDamage(speedFactor = 1) {
  const now = performance.now();
  // const attackableTurretTypes = ['tureta_bazapistol', 'tureta_smg', 'tureta_minabani', 'wall', 'tureta_p90', 'tureta_m4a1']; // Now global

  for (const turret of turrets) {
    if (!attackableTurretTypes.includes(turret.type)) continue;
    if (!turret._antDamageCooldown) turret._antDamageCooldown = {};
    for (const enemy of enemies) {
      const dx = enemy.x - turret.x;
      const dy = enemy.y - turret.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Distanță de atac diferită pentru wall-uri (mai mare) vs alte turete
      // HEROTICBEETLE are rază de atac mult mai mare pentru ziduri
      let attackRange;
      if (turret.type === 'wall' || turret.type === 'wall2') {
        attackRange = enemy.type === 'heroticbeetle' ? 120 : 50; // HeroticBeetle: 120, altele: 50
      } else {
        attackRange = 38; // Turete normale
      }
      
      if (dist < attackRange) {
        let dmg;
        if (enemy.type === 'greier') {
          dmg = GREIER_DAMAGE_PER_SECOND;
        } else if (enemy.type === 'heroticbeetle') {
          dmg = HEROTICBEETLE_DAMAGE_PER_SECOND;
        } else {
          dmg = 5;
        }
        if (!turret._antDamageCooldown[enemy] || now - turret._antDamageCooldown[enemy] > 1000 / speedFactor) {
          turret.hp -= dmg * speedFactor;
          turret._antDamageCooldown[enemy] = now;
          
          // Debug logging pentru heroticbeetle damage la ziduri
          if (enemy.type === 'heroticbeetle' && (turret.type === 'wall' || turret.type === 'wall2')) {
            console.log(`HeroticBeetle dealing ${dmg * speedFactor} damage to ${turret.type} at distance ${Math.round(dist)}. Wall HP: ${turret.hp}/${turret.maxHp}`);
          }
        }
      }
    }
  }
  for (let i = turrets.length - 1; i >= 0; i--) {
    if (turrets[i].hp <= 0) {
      turrets.splice(i, 1);
    }
  }
}

// Creează și adaugă un proiectil banana la lista de proiectile
// Optimizat pentru a reduce overhead-ul la spam clicking
function shootBanana(e) {
  // Cache-uiește canvas-ul și getBoundingClientRect pentru a evita lookup-uri repetate
  const canvas = document.getElementById('gameCanvas');
  const rect = canvas.getBoundingClientRect();
  
  // Pre-calculează offset-ul pentru a evita calculele duplicate
  const offsetX = Math.max(0, Math.min(player.x - CANVAS_WIDTH / 2, MAP_WIDTH - CANVAS_WIDTH));
  const offsetY = Math.max(0, Math.min(player.y - CANVAS_HEIGHT / 2, MAP_HEIGHT - CANVAS_HEIGHT));
  
  // Poziția mouse-ului (optimizată pentru speed)
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const worldX = mouseX + offsetX;
  const worldY = mouseY + offsetY;
  
  // Direcția de tragere (folosește operații rapide)
  const dx = worldX - player.x;
  const dy = worldY - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  
  // Creează proiectilul banana direct în array (evită operații de construcție de obiecte)
  projectiles.push({
    x: player.x,
    y: player.y,
    dirX: dx / dist,
    dirY: dy / dist,
    traveled: 0
  });
}

// --- GAME SPEED CONTROL ---
function drawSpeedButton(ctx) {
  const btnWidth = 120;
  const btnHeight = 48;
  const margin = 18;
  const x = margin;
  const y = CANVAS_HEIGHT - btnHeight - margin;

  // Medieval style: parchment background, rounded corners, gold border, shadow
  ctx.save();
  ctx.globalAlpha = 0.97;
  ctx.shadowColor = '#bfa76f';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#f5e6c5';
  ctx.beginPath();
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + btnWidth - 16, y);
  ctx.quadraticCurveTo(x + btnWidth, y, x + btnWidth, y + 16);
  ctx.lineTo(x + btnWidth, y + btnHeight - 16);
  ctx.quadraticCurveTo(x + btnWidth, y + btnHeight, x + btnWidth - 16, y + btnHeight);
  ctx.lineTo(x + 16, y + btnHeight);
  ctx.quadraticCurveTo(x, y + btnHeight, x, y + btnHeight - 16);
  ctx.lineTo(x, y + 16);
  ctx.quadraticCurveTo(x, y, x + 16, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Gold border
  ctx.strokeStyle = '#bfa100';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Medieval font for text
  ctx.font = 'bold 26px "MedievalSharp", Georgia, serif';
  ctx.fillStyle = '#7a5a00';
  ctx.textAlign = 'center';
  ctx.fillText('Speed x' + gameSpeed, x + btnWidth / 2, y + btnHeight / 2 + 2);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// --- SKIP WAVE BUTTON ---
function drawSkipButton(ctx) {
  const btnWidth = 140;
  const btnHeight = 48;
  const margin = 18;
  const speedBtnWidth = 120; // Width of speed button
  const x = margin + speedBtnWidth + 10; // Position to the right of speed button
  const y = CANVAS_HEIGHT - btnHeight - margin;

  // Medieval style: parchment background, rounded corners, gold border, shadow
  ctx.save();
  ctx.globalAlpha = 0.97;
  ctx.shadowColor = '#bfa76f';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#f5e6c5';
  ctx.beginPath();
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + btnWidth - 16, y);
  ctx.quadraticCurveTo(x + btnWidth, y, x + btnWidth, y + 16);
  ctx.lineTo(x + btnWidth, y + btnHeight - 16);
  ctx.quadraticCurveTo(x + btnWidth, y + btnHeight, x + btnWidth - 16, y + btnHeight);
  ctx.lineTo(x + 16, y + btnHeight);
  ctx.quadraticCurveTo(x, y + btnHeight, x, y + btnHeight - 16);
  ctx.lineTo(x, y + 16);
  ctx.quadraticCurveTo(x, y, x + 16, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Gold border
  ctx.strokeStyle = '#bfa100';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Medieval font for text
  ctx.font = 'bold 22px "MedievalSharp", Georgia, serif';
  ctx.fillStyle = '#7a5a00';
  ctx.textAlign = 'center';
  ctx.fillText('Skip +3', x + btnWidth / 2, y + btnHeight / 2 + 2);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Function to skip 3 waves
function skipWaves() {
  // Clear any current enemies
  enemies.length = 0;
  
  // Stop current wave
  isWaveActive = false;
  waveIntermission = false;
  
  // Clear any pending wave timeout
  if (nextWaveTimeout) {
    clearTimeout(nextWaveTimeout);
    nextWaveTimeout = null;
  }
  
  // Skip 3 waves
  currentWave += 3;
  
  // Start the new wave immediately
  startWave();
}

// --- SPEED BUTTON LOGIC MOVED TO MAIN CLICK HANDLER ---


function drawWaveUI(ctx) {
  ctx.save();
  // Text "Wave X" puțin mai mic, stil medieval, albastru închis, mai sus
  ctx.font = 'bold 48px Georgia, Times New Roman, serif';
  ctx.fillStyle = '#142a5c'; // albastru inchis
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 8;
  ctx.fillText('Wave ' + currentWave, CANVAS_WIDTH / 2, 70);
  ctx.shadowBlur = 0;
  // Text intermission
  if (waveIntermission) {
    ctx.font = 'bold 32px Georgia, Times New Roman, serif';
    ctx.fillStyle = '#145c14'; // verde inchis
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText('Next wave is coming...', CANVAS_WIDTH / 2, 120);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// --- Sistem wave-uri ---
function startWave() {
  isWaveActive = true;
  waveIntermission = false;
  // Crește dificultatea la fiecare wave
  waveEnemyCount = ENEMY_PER_WAVE + Math.floor(currentWave * 1.5);
  // HP scaling: Linear progression that caps at reasonable levels
  // Formula: baseHP * (1 + wave * 0.15) with a cap at 4x base HP
  const hpMultiplier = Math.min(1 + (currentWave - 1) * 0.15, 4.0);
  waveEnemyHP = Math.round(ENEMY_HP * hpMultiplier);
  waveEnemySpeed = ENEMY_SPEED; // viteza rămâne constantă
  spawnWaveEnemies();
}

function spawnWaveEnemies() {
  const castleX = MAP_WIDTH / 2;
  const castleY = MAP_HEIGHT / 2;
  
  // Funcție helper pentru a genera poziție de spawn la o anumită distanță de castel
  function getSpawnPosition(minDist, maxDist) {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDist + Math.random() * (maxDist - minDist);
    return {
      x: castleX + Math.cos(angle) * distance,
      y: castleY + Math.sin(angle) * distance
    };
  }

  // Spawn furnici (cele mai lente) imediat și la distanță medie de castel
  for (let i = 0; i < waveEnemyCount; i++) {
    // Furnicile spawn între 3000 și 4000 unități de castel (mărit de la 1000-2000)
    const pos = getSpawnPosition(3000, 4000);
    enemies.push({
      type: 'furnica',
      x: pos.x,
      y: pos.y,
      hp: waveEnemyHP,
      maxHp: waveEnemyHP,
      speed: waveEnemySpeed,
      moneyValue: 18, // Crescut de la 10
      collisionRadius: 18 // Furnica collision radius (marit)
    });
  }

  // Spawn gandaci verzi după 2 secunde la distanță mai mare
  if (currentWave >= 5) {
    setTimeout(() => {
      let numGandaciVerzi = 0;
      if (currentWave === 5) {
        numGandaciVerzi = 1;
      } else if (currentWave === 6) {
        numGandaciVerzi = 1;
      } else if (currentWave >= 7) {
        numGandaciVerzi = 1 + Math.floor((currentWave - 6) / 2);
      }

      const gandacVerdeHP = Math.round(GANDACVERDE_BASE_HP * Math.min(1 + (currentWave - 1) * 0.15, 4.0));

      for (let i = 0; i < numGandaciVerzi; i++) {
        // Gândacii verzi spawn între 4000 și 5000 unități de castel (mărit de la 2000-3000)
        const pos = getSpawnPosition(4000, 5000);
        enemies.push({
          type: 'gandacverde',
          x: pos.x,
          y: pos.y,
          hp: gandacVerdeHP,
          maxHp: gandacVerdeHP,
          speed: GANDACVERDE_BASE_SPEED,
          moneyValue: GANDACVERDE_MONEY_REWARD,
          collisionRadius: GANDACVERDE_PLACEHOLDER_RADIUS + 10 // Gandac collision radius (marit)
        });
      }
    }, 2000);
  }

  // Spawn albine după 6 secunde și la cea mai mare distanță
  if (currentWave >= 7) {
    setTimeout(() => {
      let numAlbine = 0;
      if (currentWave === 7) {
        numAlbine = 3;
      } else if (currentWave >= 8) {
        numAlbine = 3 + Math.floor((currentWave - 7) / 2);
      }

      const albinaHP = Math.round(ALBINA_BASE_HP * Math.min(1 + (currentWave - 1) * 0.15, 4.0));

      for (let i = 0; i < numAlbine; i++) {
        // Albinele spawn între 5000 și 6000 unități de castel (mărit de la 3000-4000)
        const pos = getSpawnPosition(5000, 6000);
        enemies.push({
          type: 'albina',
          x: pos.x,
          y: pos.y,
          hp: albinaHP,
          maxHp: albinaHP,
          speed: ALBINA_BASE_SPEED,
          moneyValue: ALBINA_MONEY_REWARD,
          lastAttack: 0,
          zigzagOffset: Math.random() * Math.PI * 2,
          targetX: castleX,
          targetY: castleY,
          collisionRadius: ALBINA_PLACEHOLDER_RADIUS + 8 // Albina collision radius (marit)
        });
      }
    }, 6000);
  }

  // --- NOU: Spawn greieri începând cu wave 3 ---
  if (currentWave >= 3) {
    for ( let i = 0; i < 3; i++) {
      const pos = getSpawnPosition(3500, 4200);
      enemies.push({
        type: 'greier',
        x: pos.x,
        y: pos.y,
        hp: Math.round(GREIER_BASE_HP * Math.min(1 + (currentWave - 1) * 0.15, 4.0)),
        maxHp: Math.round(GREIER_BASE_HP * Math.min(1 + (currentWave - 1) * 0.15, 4.0)),
        speed: GREIER_BASE_SPEED,
        moneyValue: GREIER_MONEY_REWARD,
        lastJump: 0,
        collisionRadius: GREIER_PLACEHOLDER_RADIUS + 9 // Greier collision radius (marit)
      });
    }
  }

  // --- NOU: Spawn libelule începând cu wave 9 ---
  if (currentWave >= 9) {
    setTimeout(() => {
      let numLibelule = 1 + Math.floor((currentWave - 9) / 2);
      const libelulaHP = Math.round(LIBELULA_BASE_HP * Math.min(1 + (currentWave - 1) * 0.15, 4.0));
      for (let i = 0; i < numLibelule; i++) {
        // Libelulele spawn între 6000 și 7000 unități de castel
        const pos = getSpawnPosition(6000, 7000);
        enemies.push({
          type: 'libelula',
          x: pos.x,
          y: pos.y,
          hp: libelulaHP,
          maxHp: libelulaHP,
          speed: LIBELULA_BASE_SPEED,
          moneyValue: LIBELULA_MONEY_REWARD,
          lastAttack: 0,
          zigzagOffset: Math.random() * Math.PI * 2,
          targetX: castleX,
          targetY: castleY,
          collisionRadius: LIBELULA_PLACEHOLDER_RADIUS + 10 // Libelula collision radius (marit)
        });
      }
    }, 8000);
  }

  // --- NOU: Spawn heroticbeetle începând cu wave 11 și apoi la fiecare 4 wave-uri ---
  if (currentWave >= 11 && (currentWave - 11) % 4 === 0) {
    setTimeout(() => {
      const heroticbeetleHP = Math.round(HEROTICBEETLE_BASE_HP * Math.min(1 + (currentWave - 1) * 0.15, 4.0));
      // Heroticbeetle spawn între 7000 și 8000 unități de castel (cea mai mare distanță)
      const pos = getSpawnPosition(7000, 8000);
      enemies.push({
        type: 'heroticbeetle',
        x: pos.x,
        y: pos.y,
        hp: heroticbeetleHP,
        maxHp: heroticbeetleHP,
        speed: HEROTICBEETLE_BASE_SPEED,
        moneyValue: HEROTICBEETLE_MONEY_REWARD,
        lastAttack: 0,
        collisionRadius: HEROTICBEETLE_PLACEHOLDER_RADIUS + 15 // Heroticbeetle collision radius mai mare (crescut de la +12)
      });
    }, 10000); // Spawn după 10 secunde pentru a fi ultimul
  }
}

function checkWaveEnd() {
  if (isWaveActive && enemies.length === 0) {
    isWaveActive = false;
    waveIntermission = true;
    waveStartTime = performance.now();
    currentWave++;
    // Start următorul wave după intermission
    if (nextWaveTimeout) clearTimeout(nextWaveTimeout);
    nextWaveTimeout = setTimeout(() => {
      startWave();
    }, waveIntermissionDuration);
  }
}

// Restart joc la apăsarea tastei SPACE
window.addEventListener('keydown', function(e) {
  const key = e.key.toLowerCase();
  const now = performance.now();
  
  // Actualizează timpul ultimei presări
  lastKeyPress[key] = now;
  
  // Setează starea tastei
  keys[key] = true;
  if (keyStates.hasOwnProperty(key)) {
    keyStates[key] = true;
  }
  
  if (isGameOver && e.code === 'Space') {
    // Reset totul
    castleHP = CASTLE_MAX_HP;
    money = 800; // Reset money to starting amount
    enemies = [];
    projectiles = [];
    lastEnemySpawn = performance.now();
    isGameOver = false;
    // Reset player HP si pozitie
    player.x = MAP_WIDTH / 2;
    player.y = MAP_HEIGHT / 2;
    player.hp = player.maxHp;
    player.respawnTimeout = null;
    player.respawnEndTime = null;
    // Reset turete și proiectile turete
    turrets = [];
    turretProjectiles = [];
    // La restart, resetează wave-urile
    currentWave = 1;
    isWaveActive = false;
    waveIntermission = false;
    if (nextWaveTimeout) clearTimeout(nextWaveTimeout);
    isWall2Unlocked = false;
  }
});

window.addEventListener('keyup', (e) => { 
  const key = e.key.toLowerCase();
  keys[key] = false; 
  if (keyStates.hasOwnProperty(key)) {
    keyStates[key] = false;
  }
});

// Helper function to check if a grid is occupied
function isGridOccupied(gridX, gridY) {
  for (const turret of turrets) {
    if (turret.type === 'wall' || turret.type === 'wall2' || turret.occupiedGrids) {
    for (const occupied of turret.occupiedGrids) {
      if (occupied.gridX === gridX && occupied.gridY === gridY) {
        return true;
        }
      }
    }
  }
  return false;
}

// Funcția pentru generarea banilor din minele de bani
function updateMoneyMines() {
  const now = performance.now();
  for (const turret of turrets) {
    if (turret.type === 'tureta_minabani' && turret.hp > 0) {
      if (now - turret.lastGenerated >= 2000) // Generează bani la fiecare 2 secunde
      {
        money += 10; // Adaugă 10 unități de bani
        turret.lastGenerated = now;
      }
    }
  }
}

// Update hitbox logic for money mine
function isMouseOverMoneyMine(mouseX, mouseY, turret, offsetX, offsetY) {
  const imgWidth = 120; // Match the rendering size
  const imgHeight = 120;
  return (
    mouseX >= turret.x - offsetX - imgWidth / 2 &&
    mouseX <= turret.x - offsetX + imgWidth / 2 &&
    mouseY >= turret.y - offsetY - imgHeight / 2 &&
    mouseY <= turret.y - offsetY + imgHeight / 2
  );
}

// --- MONEY MINE LOGIC MOVED TO MAIN CLICK HANDLER ---

// Adaugă meniu de upgrade pentru tureta selectată (stânga)
function drawUpgradeMenu(ctx) {
  if (selectedTurret && selectedTurret.type === 'tureta_bazapistol') {
    ctx.save();

    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 710; // Extins ca la SMG pentru mai mult spațiu
    const sectionPad = 18;
    const statPad = 10;

    // --- Background: Pergament cu colțuri rotunjite și umbră subtilă ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('Gun', menuX + menuWidth / 2, menuY + 48);

    // --- Gun stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Damage: 1', menuX + sectionPad, statY);
    ctx.fillText('Fire rate: 2/s', menuX + sectionPad, statY + 28);
    ctx.fillText('Range: 450', menuX + sectionPad, statY + 56); // Updated range to 450

    // --- Gun image (right of stats) ---
    if (typeof pistolImg !== 'undefined' && pistolImg && pistolImg.complete && pistolImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(pistolImg, imgX, imgY, imgWidth, imgHeight);
    }

    // --- Divider line ---
    ctx.save();
    ctx.strokeStyle = '#bfa76f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(menuX + sectionPad, menuY + 160);
    ctx.lineTo(menuX + menuWidth - sectionPad, menuY + 160);
    ctx.stroke();
    ctx.restore();

    // --- Upgrade section title ---
    ctx.font = 'bold 26px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.fillText('Upgrade to', menuX + menuWidth / 2, menuY + 190);

    // --- Upgrade button ---
    const upgradeButtonX = menuX + 40;
    const upgradeButtonY = menuY + 215;
    const upgradeButtonWidth = menuWidth - 80;
    const upgradeButtonHeight = 54;
    // Button background
    ctx.save();
    ctx.fillStyle = '#CD853F';
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(upgradeButtonX, upgradeButtonY, upgradeButtonWidth, upgradeButtonHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Button label
    ctx.font = 'bold 24px "MedievalSharp", serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('SMG', menuX + menuWidth / 2, upgradeButtonY + upgradeButtonHeight / 2 + 8);

    // --- SMG price under button ---
    // Desenează o monedă aurie și prețul sub butonul SMG
    const smgPrice = 300;
    const priceY = upgradeButtonY + upgradeButtonHeight + 36; // Mutat mai jos cu +18px față de varianta anterioară
    // Monedă
    ctx.save();
    ctx.beginPath();
    ctx.arc(menuX + menuWidth / 2 - 18, priceY - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', menuX + menuWidth / 2 - 18, priceY - 4);
    ctx.restore();
    // Prețul
    ctx.save();
    ctx.font = 'bold 22px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(smgPrice, menuX + menuWidth / 2, priceY - 2);
    ctx.restore();

    // --- SELL button (medieval style, bottom of menu, lower for better readability) ---
    // Increase menu height for more space
    // (Make sure to also increase menuHeight above to e.g. 480 or 500)
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    // Place the button lower, e.g. 40px from the bottom
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;

    // Medieval button background
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Medieval SELL text
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);




    // --- SMG stats section ---
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'left';
    let smgStatY = menuY + 300;
    ctx.fillText('Damage: 0.9', menuX + sectionPad, smgStatY);
    ctx.fillText('Fire rate: 8/s', menuX + sectionPad, smgStatY + 26);
    ctx.fillText('Range: 450', menuX + sectionPad, smgStatY + 52); // Updated range to 450

    // --- SMG image (right of SMG stats) ---
    if (typeof smgImg !== 'undefined' && smgImg && smgImg.complete && smgImg.naturalWidth !== 0) {
      const smgImgWidth = 80, smgImgHeight = 80;
      const smgImgX = menuX + menuWidth - smgImgWidth - sectionPad;
      const smgImgY = smgStatY - 10;
      ctx.drawImage(smgImg, smgImgX, smgImgY, smgImgWidth, smgImgHeight);
    }

    // --- Shotgun upgrade button ---
    const shotgunButtonY = upgradeButtonY + upgradeButtonHeight + 138; // la fel ca distanța P90->M4A1
    ctx.save();
    ctx.fillStyle = '#b36b00';
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(upgradeButtonX, shotgunButtonY, upgradeButtonWidth, upgradeButtonHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Button label
    ctx.font = 'bold 24px "MedievalSharp", serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Shotgun', menuX + menuWidth / 2, shotgunButtonY + upgradeButtonHeight / 2 + 8);
    // --- Shotgun price under button ---
    const shotgunPrice = 400;
    const shotgunPriceY = shotgunButtonY + upgradeButtonHeight + 24;
    ctx.save();
    ctx.beginPath();
    ctx.arc(menuX + menuWidth / 2 - 38, shotgunPriceY - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', menuX + menuWidth / 2 - 38, shotgunPriceY - 4);
    ctx.restore();
    ctx.save();
    ctx.font = 'bold 22px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(shotgunPrice, menuX + menuWidth / 2 - 18, shotgunPriceY - 2);
    ctx.restore();
    // --- Shotgun stats section ---
    let shotgunStatY = shotgunPriceY + 32;
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'left';
    ctx.fillText('Damage: 2.3 x 4', upgradeButtonX, shotgunStatY);
    ctx.fillText('Fire rate: 1/s', upgradeButtonX, shotgunStatY + 28);
    ctx.fillText('Range: 400', upgradeButtonX, shotgunStatY + 56);
    // --- Shotgun image (right of stats) ---
    if (typeof shotgunImg !== 'undefined' && shotgunImg && shotgunImg.complete && shotgunImg.naturalWidth !== 0) {
      const shotgunImgWidth = 80, shotgunImgHeight = 80;
      const shotgunImgX = menuX + menuWidth - shotgunImgWidth - sectionPad;
      const shotgunImgY = shotgunStatY - 18;
      ctx.drawImage(shotgunImg, shotgunImgX, shotgunImgY, shotgunImgWidth, shotgunImgHeight);
    }

    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'tureta_smg') {
    ctx.save();
    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 710; // extins mult mai mult pentru M4A1 jos // MODIFIED from 780
    const sectionPad = 18;
    // --- Background: Pergament cu colțuri rotunjite și umbră subtilă ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('SMG', menuX + menuWidth / 2, menuY + 48);
    // --- SMG stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Damage: 1', menuX + sectionPad, statY);
    ctx.fillText('Fire rate: 8/s', menuX + sectionPad, statY + 28);
    ctx.fillText('Range: 450', menuX + sectionPad, statY + 56);
    // --- SMG image (right of stats) ---
    if (typeof smgImg !== 'undefined' && smgImg && smgImg.complete && smgImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(smgImg, imgX, imgY, imgWidth, imgHeight);
    }
    // --- Divider line ---
    ctx.save();
    ctx.strokeStyle = '#bfa76f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(menuX + sectionPad, menuY + 160);
    ctx.lineTo(menuX + menuWidth - sectionPad, menuY + 160);
    ctx.stroke();
    ctx.restore();
    // --- Upgrade section title ---
    ctx.font = 'bold 26px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.fillText('Upgrade to', menuX + menuWidth / 2, menuY + 190);
    // --- Upgrade button P90 ---
    const upgradeButtonX = menuX + 40;
    const upgradeButtonY = menuY + 215;
    const upgradeButtonWidth = menuWidth - 80;
    const upgradeButtonHeight = 54;
    ctx.save();
    ctx.fillStyle = '#CD853F';
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(upgradeButtonX, upgradeButtonY, upgradeButtonWidth, upgradeButtonHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Button label P90
    ctx.font = 'bold 24px "MedievalSharp", serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('P90', menuX + menuWidth / 2, upgradeButtonY + upgradeButtonHeight / 2 + 8);
    // --- P90 price under button ---
    const p90Price = P90_UPGRADE_COST;
    const priceY = upgradeButtonY + upgradeButtonHeight + 24;
    ctx.save();
    ctx.beginPath();
    ctx.arc(menuX + menuWidth / 2 - 38, priceY - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', menuX + menuWidth / 2 - 38, priceY - 4);
    ctx.restore();
    ctx.save();
    ctx.font = 'bold 22px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p90Price, menuX + menuWidth / 2 - 18, priceY - 2);
    ctx.restore();
    // --- P90 stats & imagine pe același rând ---
    let p90StatY = priceY + 32;
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'left';
    ctx.fillText('Damage: 1.1', upgradeButtonX, p90StatY);
    ctx.fillText('Fire rate: 20/s', upgradeButtonX, p90StatY + 28);
    ctx.fillText('Range: 450', upgradeButtonX, p90StatY + 56);
    // Imagine P90 în dreapta datelor
    if (typeof p90Img !== 'undefined' && p90Img && p90Img.complete && p90Img.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = p90StatY - 18;
      ctx.drawImage(p90Img, imgX, imgY, imgWidth, imgHeight);
    }
    // --- Upgrade button M4A1 ---
    const m4a1ButtonY = upgradeButtonY + upgradeButtonHeight + 138;
    ctx.save();
    ctx.fillStyle = '#8bb3e6';
    ctx.strokeStyle = '#1a3a5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(upgradeButtonX, m4a1ButtonY, upgradeButtonWidth, upgradeButtonHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Button label M4A1
    ctx.font = 'bold 24px "MedievalSharp", serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('M4A1', menuX + menuWidth / 2, m4a1ButtonY + upgradeButtonHeight / 2 + 8);
    // --- Prețul M4A1 sub buton, pe același rând cu moneda ---
    const m4a1Price = M4A1_UPGRADE_COST;
    const m4a1PriceY = m4a1ButtonY + upgradeButtonHeight + 24;
    // Monedă
    ctx.save();
    ctx.beginPath();
    ctx.arc(menuX + menuWidth / 2 - 38, m4a1PriceY - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', menuX + menuWidth / 2 - 38, m4a1PriceY - 4);
    ctx.restore();
    // Prețul
    ctx.save();
    ctx.font = 'bold 22px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(m4a1Price, menuX + menuWidth / 2 - 18, m4a1PriceY - 2);
    ctx.restore();
    // --- Stats și imagine pe același rând, ca la P90 ---
    let m4a1StatY = m4a1PriceY + 32;
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'left';
    ctx.fillText('Damage: 1.8', upgradeButtonX, m4a1StatY);
    ctx.fillText('Fire rate: 10/s', upgradeButtonX, m4a1StatY + 28);
    ctx.fillText('Range: 650', upgradeButtonX, m4a1StatY + 56);
    // Imagine M4A1 în dreapta datelor
    if (typeof m4a1Img !== 'undefined' && m4a1Img && m4a1Img.complete && m4a1Img.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = m4a1StatY - 18;
      ctx.drawImage(m4a1Img, imgX, imgY, imgWidth, imgHeight);
    }
    // --- SELL button (jos în panou, sub detaliile M4A1) ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);
  } else if (selectedTurret && selectedTurret.type === 'tureta_p90') {
    ctx.save();
    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 340;
    const sectionPad = 18;
    // --- Background: Pergament cu colțuri rotunjite și umbră subtilă ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('P90', menuX + menuWidth / 2, menuY + 48);
    // --- P90 stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Damage: 1.1', menuX + sectionPad, statY);
    ctx.fillText('Fire rate: 20/s', menuX + sectionPad, statY + 28);
    ctx.fillText('Range: 450', menuX + sectionPad, statY + 56);
    // --- P90 image (right of stats) ---
    if (typeof p90Img !== 'undefined' && p90Img && p90Img.complete && p90Img.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(p90Img, imgX, imgY, imgWidth, imgHeight);
    }
    // --- SELL button ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);
    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'tureta_shotgun') {
    ctx.save();
    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 710; // Mărit ca la SMG pentru mai mult spațiu
    const sectionPad = 18;
    // --- Background: Pergament cu colțuri rotunjite și umbră subtilă ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('Shotgun', menuX + menuWidth / 2, menuY + 48);
    // --- Shotgun stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Damage: 2.3 x 4', menuX + sectionPad, statY);
    ctx.fillText('Fire rate: 1/s', menuX + sectionPad, statY + 28);
    ctx.fillText('Range: 400', menuX + sectionPad, statY + 56);
    // --- Shotgun image (right of stats) ---
    if (typeof shotgunImg !== 'undefined' && shotgunImg && shotgunImg.complete && shotgunImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(shotgunImg, imgX, imgY, imgWidth, imgHeight);
    }
    // --- Divider line ---
    ctx.save();
    ctx.strokeStyle = '#bfa76f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(menuX + sectionPad, menuY + 160);
    ctx.lineTo(menuX + menuWidth - sectionPad, menuY + 160);
    ctx.stroke();
    ctx.restore();
    // --- Upgrade section title ---
    ctx.font = 'bold 26px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.fillText('Upgrade to', menuX + menuWidth / 2, menuY + 190);
    // --- Heavy Shotgun upgrade button ---
    const upgradeButtonX = menuX + 40;
    const upgradeButtonY = menuY + 215;
    const upgradeButtonWidth = menuWidth - 80;
    const upgradeButtonHeight = 54;
    ctx.save();
    ctx.fillStyle = '#8bb3e6';
    ctx.strokeStyle = '#1a3a5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(upgradeButtonX, upgradeButtonY, upgradeButtonWidth, upgradeButtonHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Button label
    ctx.font = 'bold 24px "MedievalSharp", serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Heavy Shotgun', menuX + menuWidth / 2, upgradeButtonY + upgradeButtonHeight / 2 + 8);
    // --- Heavy Shotgun price under button ---
    const heavyShotgunPrice = HEAVYSHOTGUN_UPGRADE_COST;
    const heavyPriceY = upgradeButtonY + upgradeButtonHeight + 24;
    ctx.save();
    ctx.beginPath();
    ctx.arc(menuX + menuWidth / 2 - 38, heavyPriceY - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', menuX + menuWidth / 2 - 38, heavyPriceY - 4);
    ctx.restore();
    ctx.save();
    ctx.font = 'bold 22px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(heavyShotgunPrice, menuX + menuWidth / 2 - 18, heavyPriceY - 2);
    ctx.restore();
    // --- Heavy Shotgun stats section ---
    let heavyStatY = heavyPriceY + 32;
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'left';
    ctx.fillText('Damage: 6 x 9', upgradeButtonX, heavyStatY);
    ctx.fillText('Fire rate: 0.67/s', upgradeButtonX, heavyStatY + 28);
    ctx.fillText('Range: 400', upgradeButtonX, heavyStatY + 56);
    // --- Heavy Shotgun image (right of stats) ---
    if (typeof heavyshotgunImg !== 'undefined' && heavyshotgunImg && heavyshotgunImg.complete && heavyshotgunImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = heavyStatY - 18;
      ctx.drawImage(heavyshotgunImg, imgX, imgY, imgWidth, imgHeight);
    }
    // --- Fast Shotgun upgrade button ---
    const fastshotgunButtonY = heavyStatY + 90;
    ctx.save();
    ctx.fillStyle = '#CD853F';
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(upgradeButtonX, fastshotgunButtonY, upgradeButtonWidth, upgradeButtonHeight, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Button label
    ctx.font = 'bold 24px "MedievalSharp", serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Fast Shotgun', menuX + menuWidth / 2, fastshotgunButtonY + upgradeButtonHeight / 2 + 8);
    // --- Fast Shotgun price under button ---
    const fastshotgunPrice = FASTSHOTGUN_UPGRADE_COST;
    const fastshotgunPriceY = fastshotgunButtonY + upgradeButtonHeight + 24;
    ctx.save();
    ctx.beginPath();
    ctx.arc(menuX + menuWidth / 2 - 38, fastshotgunPriceY - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa100';
    ctx.stroke();
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', menuX + menuWidth / 2 - 38, fastshotgunPriceY - 4);
    ctx.restore();
    ctx.save();
    ctx.font = 'bold 22px "MedievalSharp", serif';
    ctx.fillStyle = '#bfa100';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fastshotgunPrice, menuX + menuWidth / 2 - 18, fastshotgunPriceY - 2);
    ctx.restore();
    // --- Fast Shotgun stats section ---
    let fastshotgunStatY = fastshotgunPriceY + 32;
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'left';
    ctx.fillText('Damage: 2.3 x 4', upgradeButtonX, fastshotgunStatY);
    ctx.fillText('Fire rate: 2/s', upgradeButtonX, fastshotgunStatY + 28);
    ctx.fillText('Range: 400', upgradeButtonX, fastshotgunStatY + 56);
    // --- Fast Shotgun image (right of stats) ---
    if (typeof fastshotgunImg !== 'undefined' && fastshotgunImg && fastshotgunImg.complete && fastshotgunImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = fastshotgunStatY - 18;
      ctx.drawImage(fastshotgunImg, imgX, imgY, imgWidth, imgHeight);
    }
    // --- SELL button ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);
    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'wall') { // NEW: Wall menu
    ctx.save();
    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 500; // ca la pistol
    const sectionPad = 18;

    // --- Background: Pergament cu colțuri rotunjite și umbră subtilă ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText(isWall2Unlocked ? 'Wall2' : 'Wall', menuX + menuWidth / 2, menuY + 48);

    // --- Wall1 stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('HP: 120', menuX + sectionPad, statY);
    ctx.fillText('Size: 1x1', menuX + sectionPad, statY + 28);
    ctx.fillText('Blocks enemies', menuX + sectionPad, statY + 56);

    // --- Wall1 image (right of stats) ---
    if (wallImg && wallImg.complete && wallImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(wallImg, imgX, imgY, imgWidth, imgHeight);
    }

    // --- Divider line ---
    ctx.save();
    ctx.strokeStyle = '#bfa76f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(menuX + sectionPad, menuY + 160);
    ctx.lineTo(menuX + menuWidth - sectionPad, menuY + 160);
    ctx.stroke();
    ctx.restore();

    // --- Upgrade section title ---
    ctx.font = 'bold 26px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.fillText('Upgrade to', menuX + menuWidth / 2, menuY + 190);

    // --- Upgrade button ---
    if (!isWall2Unlocked && selectedTurret.type === 'wall') {
    const upgradeButtonX = menuX + 40;
      const upgradeButtonY = menuY + 215;
    const upgradeButtonWidth = menuWidth - 80;
      const upgradeButtonHeight = 54;
      // Button background
      ctx.save();
      ctx.fillStyle = '#CD853F';
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(upgradeButtonX, upgradeButtonY, upgradeButtonWidth, upgradeButtonHeight, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Button label
      ctx.font = 'bold 24px "MedievalSharp", serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('Wall2', menuX + menuWidth / 2, upgradeButtonY + upgradeButtonHeight / 2 + 8);

      // --- Wall2 price under button ---
      const wall2Price = 400;
      const priceY = upgradeButtonY + upgradeButtonHeight + 36;
      // Monedă
      ctx.save();
      ctx.beginPath();
      ctx.arc(menuX + menuWidth / 2 - 18, priceY - 4, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe066';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#bfa100';
      ctx.stroke();
      ctx.font = 'bold 18px "MedievalSharp", serif';
      ctx.fillStyle = '#bfa100';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', menuX + menuWidth / 2 - 18, priceY - 4);
      ctx.restore();
      // Prețul
      ctx.save();
      ctx.font = 'bold 22px "MedievalSharp", serif';
      ctx.fillStyle = '#bfa100';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(wall2Price, menuX + menuWidth / 2, priceY - 2);
      ctx.restore();
    }

    // --- Wall2 stats section ---
    ctx.font = 'bold 18px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'left';
    let wall2StatY = menuY + 300;
    ctx.fillText('HP: 240', menuX + sectionPad, wall2StatY);
    ctx.fillText('Size: 1x1', menuX + sectionPad, wall2StatY + 26);
    ctx.fillText('Blocks enemies', menuX + sectionPad, wall2StatY + 52);

    // --- Wall2 image (right of stats) ---
    if (wall2Img && wall2Img.complete && wall2Img.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = wall2StatY - 18;
      ctx.drawImage(wall2Img, imgX, imgY, imgWidth, imgHeight);
    }

    // --- SELL button (medieval style, bottom of menu, lower for better readability) ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;

    // Medieval button background
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Medieval SELL text
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);

    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'wall2') { // NEW: Wall2 menu
    ctx.save();
    // --- Layout constants (similar to P90/M4A1 menu) ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 340; // Similar to P90/M4A1 for consistency
    const sectionPad = 18;

    // --- Background: Pergament cu colțuri rotunjite și umbră subtilă ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('Wall Lv.2', menuX + menuWidth / 2, menuY + 48); // Title "Wall2"

    // --- Wall2 stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('HP: ' + WALL2_HP, menuX + sectionPad, statY);
    ctx.fillText('Size: 1x1', menuX + sectionPad, statY + 28);
    ctx.fillText('Blocks enemies', menuX + sectionPad, statY + 56);

    // --- Wall2 image (right of stats) ---
    if (wall2Img && wall2Img.complete && wall2Img.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 10; // Adjusted Y to better align with stats
      ctx.drawImage(wall2Img, imgX, imgY, imgWidth, imgHeight);
    }

    // --- SELL button (medieval style, bottom of menu) ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40; // Positioned like P90/M4A1 sell button

    // Medieval button background
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Medieval SELL text
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);

    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'tureta_heavyshotgun') {
    ctx.save();
    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 340;
    const sectionPad = 18;
    // --- Background: Pergament cu colțuri rotunjite și umbră subtilă ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('Heavy Shotgun', menuX + menuWidth / 2, menuY + 48);
    // --- Heavy Shotgun stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Damage: 6 x 9', menuX + sectionPad, statY);
    ctx.fillText('Fire rate: 0.67/s', menuX + sectionPad, statY + 26);
    ctx.fillText('Range: 400', menuX + sectionPad, statY + 52);
    // --- Heavy Shotgun image (right of stats) ---
    if (typeof heavyshotgunImg !== 'undefined' && heavyshotgunImg && heavyshotgunImg.complete && heavyshotgunImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(heavyshotgunImg, imgX, imgY, imgWidth, imgHeight);
    }
    // --- SELL button ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);
    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'tureta_minabani') { // Meniu Mina Bani
    ctx.save();
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 260;
    const sectionPad = 18;

    // Fundal pergament
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Border
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Titlu
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('Money Mine', menuX + menuWidth / 2, menuY + 48);

    // Statistici
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Income: +$10 / 2s', menuX + sectionPad, statY);
    ctx.fillText('HP: 100', menuX + sectionPad, statY + 28);
    ctx.fillText('Range: 0', menuX + sectionPad, statY + 56);

    // Imagine mina bani
    if (typeof minabanil1Img !== 'undefined' && minabanil1Img && minabanil1Img.complete && minabanil1Img.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(minabanil1Img, imgX, imgY, imgWidth, imgHeight);
    }

    // Buton SELL
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 24;
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);
    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'tureta_fastshotgun') { // NEW: Fast Shotgun Menu
    ctx.save();
    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 340; // Similar to Heavy Shotgun
    const sectionPad = 18;

    // --- Background: Pergament ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('Fast Shotgun', menuX + menuWidth / 2, menuY + 48);

    // --- Fast Shotgun stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Damage: ' + FASTSHOTGUN_DAMAGE + ' x ' + FASTSHOTGUN_PROJECTILES, menuX + sectionPad, statY);
    ctx.fillText('Fire rate: ' + FASTSHOTGUN_ATTACKSPEED + '/s', menuX + sectionPad, statY + 28);
    ctx.fillText('Range: ' + FASTSHOTGUN_RANGE, menuX + sectionPad, statY + 52);

    // --- Fast Shotgun image (right of stats) ---
    if (typeof fastshotgunImg !== 'undefined' && fastshotgunImg && fastshotgunImg.complete && fastshotgunImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(fastshotgunImg, imgX, imgY, imgWidth, imgHeight);
    }

    // --- SELL button ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;

    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);

    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'tureta_m4a1') { // NEW: M4A1 Menu
    ctx.save();
    // --- Layout constants ---
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 340; // Similar to P90 for consistency
    const sectionPad = 18;

    // --- Background: Pergament ---
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- Border ---
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // --- Title ---
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('M4A1', menuX + menuWidth / 2, menuY + 48);

    // --- M4A1 stats section ---
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText(`Damage: ${M4A1_DAMAGE}`, menuX + sectionPad, statY);
    ctx.fillText(`Fire rate: ${M4A1_ATTACKSPEED}/s`, menuX + sectionPad, statY + 28);
    ctx.fillText(`Range: ${M4A1_RANGE}`, menuX + sectionPad, statY + 56);

    // --- M4A1 image (right of stats) ---
    if (typeof m4a1Img !== 'undefined' && m4a1Img && m4a1Img.complete && m4a1Img.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(m4a1Img, imgX, imgY, imgWidth, imgHeight);
    }

    // --- SELL button ---
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 40;

    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);

    ctx.restore();
  } else if (selectedTurret && selectedTurret.type === 'tureta_minabani') { // Meniu Mina Bani
    ctx.save();
    const menuX = 20;
    const menuY = 100;
    const menuWidth = 300;
    const menuHeight = 260;
    const sectionPad = 18;

    // Fundal pergament
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5e6c5';
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Border
    ctx.save();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(menuX + 18, menuY);
    ctx.lineTo(menuX + menuWidth - 18, menuY);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY, menuX + menuWidth, menuY + 18);
    ctx.lineTo(menuX + menuWidth, menuY + menuHeight - 18);
    ctx.quadraticCurveTo(menuX + menuWidth, menuY + menuHeight, menuX + menuWidth - 18, menuY + menuHeight);
    ctx.lineTo(menuX + 18, menuY + menuHeight);
    ctx.quadraticCurveTo(menuX, menuY + menuHeight, menuX, menuY + menuHeight - 18);
    ctx.lineTo(menuX, menuY + 18);
    ctx.quadraticCurveTo(menuX, menuY, menuX + 18, menuY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Titlu
    ctx.font = 'bold 36px "MedievalSharp", serif';
    ctx.fillStyle = '#5D4037';
    ctx.textAlign = 'center';
    ctx.fillText('Money Mine', menuX + menuWidth / 2, menuY + 48);

    // Statistici
    ctx.font = 'bold 20px "MedievalSharp", serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5D4037';
    let statY = menuY + 90;
    ctx.fillText('Money per second: ' + MINABANI_MONEY_PER_SECOND, menuX + sectionPad, statY);
    ctx.fillText('Range: ' + MINABANI_RANGE, menuX + sectionPad, statY + 28);

    // Imagine mina bani
    if (typeof minabaniImg !== 'undefined' && minabaniImg && minabaniImg.complete && minabaniImg.naturalWidth !== 0) {
      const imgWidth = 80, imgHeight = 80;
      const imgX = menuX + menuWidth - imgWidth - sectionPad;
      const imgY = statY - 18;
      ctx.drawImage(minabaniImg, imgX, imgY, imgWidth, imgHeight);
    }

    // Buton SELL
    const sellBtnWidth = 180;
    const sellBtnHeight = 48;
    const sellBtnX = menuX + (menuWidth - sellBtnWidth) / 2;
    const sellBtnY = menuY + menuHeight - sellBtnHeight - 24;
    ctx.save();
    ctx.shadowColor = '#bfa76f';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sellBtnX + 18, sellBtnY);
    ctx.lineTo(sellBtnX + sellBtnWidth - 18, sellBtnY);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY, sellBtnX + sellBtnWidth, sellBtnY + 18);
    ctx.lineTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight - 18);
    ctx.quadraticCurveTo(sellBtnX + sellBtnWidth, sellBtnY + sellBtnHeight, sellBtnX + sellBtnWidth - 18, sellBtnY + sellBtnHeight);
    ctx.lineTo(sellBtnX + 18, sellBtnY + sellBtnHeight);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY + sellBtnHeight, sellBtnX, sellBtnY + sellBtnHeight - 18);
    ctx.lineTo(sellBtnX, sellBtnY + 18);
    ctx.quadraticCurveTo(sellBtnX, sellBtnY, sellBtnX + 18, sellBtnY);
    ctx.closePath();
    ctx.fillStyle = '#e0c48c';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 28px "MedievalSharp", serif';
    ctx.fillStyle = '#8B4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELL', sellBtnX + sellBtnWidth / 2, sellBtnY + sellBtnHeight / 2);
    ctx.restore();
  }
}

// --- Proiectilele mazga trase de libelule ---
let mazgaProjectiles = [];

function drawMazgaProjectiles(ctx, offsetX, offsetY) {
  for (const projectile of mazgaProjectiles) {
    if (mazgaImg.complete && mazgaImg.naturalWidth !== 0) {
      const scale = 0.02; // Scara redusa pentru un proiectil si mai mic (era 0.03)
      const imgWidth = mazgaImg.naturalWidth * scale;
      const imgHeight = mazgaImg.naturalHeight * scale;
      ctx.save();
      ctx.translate(projectile.x - offsetX, projectile.y - offsetY);
      ctx.rotate(Math.atan2(projectile.dirY, projectile.dirX));
      ctx.drawImage(mazgaImg, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(projectile.x - offsetX, projectile.y - offsetY, 4, 0, Math.PI * 2); // Raza redusa pentru fallback (era 6)
      ctx.fillStyle = '#4ec04e';
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.closePath();
    }
  }
}

function updateMazgaProjectiles() {
  for (let i = mazgaProjectiles.length - 1; i >= 0; i--) {
    const projectile = mazgaProjectiles[i];
    // Dacă ținta nu mai există, proiectilul merge înainte pe direcția inițială
    let dx, dy, distance;
    let target = projectile.target;
    if (target && ((target.hp !== undefined && target.hp > 0) || target === 'castle')) {
      if (target === 'castle') {
        dx = MAP_WIDTH / 2 - projectile.x;
        dy = MAP_HEIGHT / 2 - projectile.y;
        distance = Math.sqrt(dx * dx + dy * dy);
      } else {
        dx = target.x - projectile.x;
        dy = target.y - projectile.y;
        distance = Math.sqrt(dx * dx + dy * dy);
      }
    } else {
      dx = projectile.dirX;
      dy = projectile.dirY;
      distance = 1;
    }
    // Coliziune
    let hit = false;
    if (target && target !== 'castle' && target.hp !== undefined && target.hp > 0) {
      if (Math.sqrt((target.x - projectile.x) ** 2 + (target.y - projectile.y) ** 2) < 24) {
        target.hp -= projectile.damage || 15;
        // Slow effect
        if (target.slowUntil === undefined || performance.now() > target.slowUntil) {
          target.slowUntil = performance.now() + MAZGA_SLOW_DURATION;
          target.slowFactor = MAZGA_SLOW_FACTOR;
        } else {
          target.slowUntil += MAZGA_SLOW_DURATION;
        }
        hit = true;
      }
    } else if (target === 'castle') {
      if (Math.sqrt((MAP_WIDTH / 2 - projectile.x) ** 2 + (MAP_HEIGHT / 2 - projectile.y) ** 2) < 60) {
        castleHP -= projectile.damage || 15;
        hit = true;
      }
    }
    // Fallback: dacă target nu are coordonate valide, elimină proiectilul
    if (target && (isNaN(target.x) || isNaN(target.y))) {
      mazgaProjectiles.splice(i, 1);
      continue;
    }
    if (hit) {
      mazgaProjectiles.splice(i, 1);
      continue;
    }
    // Limitează distanța maximă a proiectilului
    projectile.traveled = (projectile.traveled || 0) + MAZGA_SPEED;
    if (projectile.traveled > 600) {
      mazgaProjectiles.splice(i, 1);
      continue;
    }
    // Actualizează poziția proiectilului
    projectile.x += (dx / distance) * MAZGA_SPEED;
    projectile.y += (dy / distance) * MAZGA_SPEED;
  }
}

// NOU: Funcție pentru actualizarea particulelor de scântei
function updateSparkParticles() {
  for (let i = sparkParticles.length - 1; i >= 0; i--) {
    const p = sparkParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // Simulare gravitatie usoara
    p.life -= 1/60; // Presupunand 60 FPS, scade viata pentru a corespunde duratei in secunde

    if (p.life <= 0) {
      sparkParticles.splice(i, 1);
    }
  }
}

// NOU: Funcție pentru desenarea particulelor de scântei
function drawSparkParticles(ctx, offsetX, offsetY) {
  for (const p of sparkParticles) {
    ctx.save();
    const alpha = Math.max(0, p.life / p.initialLife); // Opacitate bazata pe viata ramasa
    ctx.globalAlpha = alpha * 0.8; // Usor mai transparent pentru un efect mai fin (era alpha)
    ctx.fillStyle = p.color;
    ctx.beginPath();
    // Scanteile pot fi mici dreptunghiuri sau cercuri
    // ctx.fillRect(p.x - offsetX - p.size / 2, p.y - offsetY - p.size / 2, p.size, p.size);
    ctx.arc(p.x - offsetX, p.y - offsetY, p.size * (alpha + 0.2), 0, Math.PI * 2); // Dimensiunea scade cu viata, dar ramane putin mai mare (era p.size * alpha)
    ctx.fill();
    // Adauga un mic efect de glow
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.size / 2;
    ctx.fill(); // Fill again for glow
    ctx.restore();
  }
}

// --- CONSTANTE ȘI IMAGINE WALL ---
let wallImg = new Image();
wallImg.src = 'wall1.png';
let wall2Img = new Image();
wall2Img.src = 'wall2.png';
const WALL_HP = 100;
const WALL2_HP = 240;
const WALL_COST = 15;
const WALL_SIZE = 1; // 1x1 grid
let isWall2Unlocked = false;

const attackableTurretTypes = ['tureta_bazapistol', 'tureta_smg', 'tureta_minabani', 'wall', 'wall2', 'tureta_p90', 'tureta_m4a1'];

// Helper function to get points on a line for simple path checking
function getPointsOnLine(x1, y1, x2, y2, numPoints) {
    const points = [];
    for (let i = 1; i <= numPoints; i++) { // Check numPoints along the line, including closer ones
        const t = i / (numPoints + 1); // Distribute points evenly
        points.push({
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        });
    }
    return points;
}

// Helper function to check collision between a circle (enemy) and any wall
function isCollidingWithWall(checkX, checkY, enemyRadius) {
  for (const turret of turrets) {
        if (turret.type === 'wall' || turret.type === 'wall2') { // MODIFIED HERE
            // Wall is 40x40, centered at turret.x, turret.y
            const wallLeft = turret.x - 20;
            const wallRight = turret.x + 20;
            const wallTop = turret.y - 20;
            const wallBottom = turret.y + 20;

            // Find the closest point on the wall to the circle's center
            let closestX = Math.max(wallLeft, Math.min(checkX, wallRight));
            let closestY = Math.max(wallTop, Math.min(checkY, wallBottom));

            // Calculate the distance between the circle's center and this closest point
            let distanceX = checkX - closestX;
            let distanceY = checkY - closestY;
            let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

            if (distanceSquared < (enemyRadius * enemyRadius)) {
                 return turret; // Collision detected, return the wall object
            }
        }
    }
    return null; // No collision with any wall
}

// --- SUNETE ARME: POOL pentru redare instantă ---
const GUNSHOT_POOL_SIZE = 8;
const P90SHOT_POOL_SIZE = 8;
const M4A1SHOT_POOL_SIZE = 8;
const INSECTKILL_POOL_SIZE = 8;
const TOWERPLACE_POOL_SIZE = 4;
let gunshotPool = [];
let gunshotPoolIndex = 0;
let p90shotPool = [];
let p90shotPoolIndex = 0;
let m4a1shotPool = [];
let m4a1shotPoolIndex = 0;
let insectkillPool = [];
let insectkillPoolIndex = 0;
let towerplacePool = [];
let towerplacePoolIndex = 0;
for (let i = 0; i < GUNSHOT_POOL_SIZE; i++) {
  let a = new Audio('gunshot.mp3');
  initialVolumes['gunshot'] = 0.12;
  a.volume = initialVolumes['gunshot'] * masterVolume;
  a.preload = 'auto';
  gunshotPool.push(a);
}
for (let i = 0; i < P90SHOT_POOL_SIZE; i++) {
  let a = new Audio('P90shot.mp3');
  initialVolumes['p90shot'] = 0.12;
  a.volume = initialVolumes['p90shot'] * masterVolume;
  a.preload = 'auto';
  p90shotPool.push(a);
}
for (let i = 0; i < M4A1SHOT_POOL_SIZE; i++) {
  let a = new Audio('M4A1shot.mp3');
  initialVolumes['m4a1'] = 0.12; // Corrected key
  a.volume = initialVolumes['m4a1'] * masterVolume;
  a.preload = 'auto';
  m4a1shotPool.push(a);
}
for (let i = 0; i < INSECTKILL_POOL_SIZE; i++) {
  let a = new Audio('insectkill.mp3');
  initialVolumes['insectkill'] = 0.28;
  a.volume = initialVolumes['insectkill'] * masterVolume;
  a.preload = 'auto';
  insectkillPool.push(a);
}
for (let i = 0; i < TOWERPLACE_POOL_SIZE; i++) {
  let a = new Audio('towerplace.mp3');
  initialVolumes['towerplace'] = 0.35;
  a.volume = initialVolumes['towerplace'] * masterVolume;
  a.preload = 'auto';
  towerplacePool.push(a);
}

// Call once at the beginning to set initial volumes based on masterVolume
adjustMasterVolume(masterVolume);

// --- NOU: Function to draw settings icon ---
function drawSettingsIcon(ctx) {
  const iconSize = 48;
  const margin = 20;
  const x = CANVAS_WIDTH - iconSize - margin;
  const y = margin;

  if (settingsIconImg.complete && settingsIconImg.naturalWidth !== 0) {
    ctx.drawImage(settingsIconImg, x, y, iconSize, iconSize);
  } else {
    // Fallback: Draw a medieval-style settings icon (e.g., stylized cogwheel)
    ctx.save();
    const centerX = x + iconSize / 2;
    const centerY = y + iconSize / 2;
    const mainRadius = iconSize / 2.2;
    const innerRadius = iconSize / 4;
    const numTeeth = 6; // Fewer, larger teeth for a medieval look

    // Main cog body
    ctx.fillStyle = '#6A4A3C'; // Dark, slightly desaturated brown
    ctx.beginPath();
    ctx.arc(centerX, centerY, mainRadius, 0, Math.PI * 2);
    ctx.fill();

    // Cog teeth
    ctx.fillStyle = '#50382C'; // Even darker brown for teeth/contrast
    for (let i = 0; i < numTeeth; i++) {
      const angle = (i / numTeeth) * Math.PI * 2;
      const toothWidth = Math.PI / (numTeeth * 1.5); // Width of the tooth base
      
      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(angle - toothWidth) * mainRadius,
        centerY + Math.sin(angle - toothWidth) * mainRadius
      );
      ctx.lineTo(
        centerX + Math.cos(angle - toothWidth * 0.5) * (mainRadius + iconSize / 10),
        centerY + Math.sin(angle - toothWidth * 0.5) * (mainRadius + iconSize / 10)
      );
      ctx.lineTo(
        centerX + Math.cos(angle + toothWidth * 0.5) * (mainRadius + iconSize / 10),
        centerY + Math.sin(angle + toothWidth * 0.5) * (mainRadius + iconSize / 10)
      );
      ctx.lineTo(
        centerX + Math.cos(angle + toothWidth) * mainRadius,
        centerY + Math.sin(angle + toothWidth) * mainRadius
      );
      ctx.closePath();
      ctx.fill();
    }

    // Inner circle / cutout
    ctx.fillStyle = '#D2B48C'; // Lighter, parchment-like color for cutout
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Simple central cross/detail
    ctx.strokeStyle = '#6A4A3C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - innerRadius / 2, centerY);
    ctx.lineTo(centerX + innerRadius / 2, centerY);
    ctx.moveTo(centerX, centerY - innerRadius / 2);
    ctx.lineTo(centerX, centerY + innerRadius / 2);
    ctx.stroke();

    ctx.restore();
  }
}

// --- NOU: Function to draw settings menu ---
function drawSettingsMenu(ctx) {
  if (!isSettingsMenuOpen) return;

  const menuWidth = 540; 
  const menuHeight = 420; 
  const x = CANVAS_WIDTH / 2 - menuWidth / 2;
  const y = CANVAS_HEIGHT / 2 - menuHeight / 2;
  const cornerRadius = 30; 
  // Medieval Background (Parchment)
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 20; 
  ctx.fillStyle = '#f5e6c5'; 
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.lineTo(x + menuWidth - cornerRadius, y);
  ctx.quadraticCurveTo(x + menuWidth, y, x + menuWidth, y + cornerRadius);
  ctx.lineTo(x + menuWidth, y + menuHeight - cornerRadius);
  ctx.quadraticCurveTo(x + menuWidth, y + menuHeight, x + menuWidth - cornerRadius, y + menuHeight);
  ctx.lineTo(x + cornerRadius, y + menuHeight);
  ctx.quadraticCurveTo(x, y + menuHeight, x, y + menuHeight - cornerRadius);
  ctx.lineTo(x, y + cornerRadius);
  ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Border
  ctx.strokeStyle = '#8B4513'; 
  ctx.lineWidth = 5; 
  ctx.stroke();

  // Title
  ctx.font = 'bold 48px "MedievalSharp", Georgia, serif'; 
  ctx.fillStyle = '#5D4037'; 
  ctx.textAlign = 'center'; 
  ctx.fillText('Settings', x + menuWidth / 2, y + 80); 

  // Volume Bar Elements
  const volumeBarWidth = menuWidth - 220; 
  const volumeBarHeight = 40; 
  const volumeBarX = x + (menuWidth - volumeBarWidth) / 2;
  const volumeBarY = y + 220; // MOVED FURTHER DOWN

  // Volume Label (Above the bar)
  ctx.font = '30px "MedievalSharp", Georgia, serif'; 
  ctx.fillStyle = '#5D4037';
  ctx.textAlign = 'center'; 
  ctx.fillText('Volume', volumeBarX + volumeBarWidth / 2, volumeBarY - 35); // Adjusted for new bar Y

  // Volume Bar Track
  ctx.fillStyle = '#8B4513'; 
  ctx.beginPath();
  ctx.roundRect(volumeBarX, volumeBarY, volumeBarWidth, volumeBarHeight, 12);
  ctx.fill();
  
  // Volume Bar Fill - Adjusted for 200% volume
  ctx.fillStyle = '#6B8E23'; 
  ctx.beginPath();
  // Fill width is masterVolume / 2 because masterVolume now goes up to 2.0
  const fillWidth = volumeBarWidth * (masterVolume / 2);
  ctx.roundRect(volumeBarX, volumeBarY, Math.min(fillWidth, volumeBarWidth), volumeBarHeight, 12); // Ensure fill doesn't exceed bar width
  ctx.fill();
  
  // Volume Bar Border
  ctx.strokeStyle = '#5D4037'; 
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(volumeBarX, volumeBarY, volumeBarWidth, volumeBarHeight, 12);
  ctx.stroke();

  // Volume Percentage Text (Below the bar)
  ctx.font = '24px "MedievalSharp", Georgia, serif'; 
  ctx.fillStyle = '#5D4037';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(masterVolume * 100)}%`, volumeBarX + volumeBarWidth / 2, volumeBarY + volumeBarHeight + 35); // Adjusted for new bar Y

  // Volume Buttons
  const btnSize = 50; 
  const btnBorderRadius = 12;
  const btnY = volumeBarY + (volumeBarHeight - btnSize) / 2;
  const minusBtnX = volumeBarX - btnSize - 20; 
  const plusBtnX = volumeBarX + volumeBarWidth + 20; 

  // Minus Button
  ctx.fillStyle = '#CD853F'; 
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(minusBtnX, btnY, btnSize, btnSize, btnBorderRadius);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5e6c5'; 
  ctx.font = 'bold 38px Georgia, serif'; 
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('-', minusBtnX + btnSize / 2, btnY + btnSize / 2 + 3);

  // Plus Button
  ctx.fillStyle = '#CD853F';
  ctx.strokeStyle = '#8B4513';
  ctx.beginPath();
  ctx.roundRect(plusBtnX, btnY, btnSize, btnSize, btnBorderRadius);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5e6c5';
  ctx.font = 'bold 38px Georgia, serif'; 
  ctx.fillText('+', plusBtnX + btnSize / 2, btnY + btnSize / 2 + 3);

  // Close Button (Top Right of Menu)
  const closeBtnSize = 45; 
  const closeBtnX = x + menuWidth - closeBtnSize - 20;
  const closeBtnY = y + 20;
  ctx.fillStyle = '#b22222'; // Firebrick red
  ctx.strokeStyle = '#800000'; // Maroon border
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5e6c5'; // Parchment color for X
  ctx.font = 'bold 30px Georgia, serif'; // Larger X
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('X', closeBtnX + closeBtnSize / 2, closeBtnY + closeBtnSize / 2 + 3);

  ctx.restore();
}

  // --- NOU: Desenează iconița de setări și meniul dacă e deschis ---
  drawSettingsIcon(ctx);
  drawSettingsMenu(ctx); // Va desena doar dacă isSettingsMenuOpen este true

  requestAnimationFrame(gameLoop);


// --- NOU: Function to adjust master volume and apply to all sounds ---
function adjustMasterVolume(newVolume) {
  masterVolume = Math.max(0, Math.min(2, newVolume)); // Clamp between 0 and 2 (for 200%)

  // Ambient sound
  if (ambientAudio) {
    ambientAudio.volume = (initialVolumes['ambient'] !== undefined ? initialVolumes['ambient'] : 1) * masterVolume;
  }

  // Gunshot sounds
  gunshotPool.forEach(audio => {
    audio.volume = (initialVolumes['gunshot'] !== undefined ? initialVolumes['gunshot'] : 0.16) * masterVolume;
  });
  p90shotPool.forEach(audio => {
    audio.volume = (initialVolumes['p90shot'] !== undefined ? initialVolumes['p90shot'] : 0.16) * masterVolume;
  });
  m4a1shotPool.forEach(audio => {
    audio.volume = (initialVolumes['m4a1'] !== undefined ? initialVolumes['m4a1'] : 0.16) * masterVolume;
  });

  // Insect kill sounds
  insectkillPool.forEach(audio => {
    audio.volume = (initialVolumes['insectkill'] !== undefined ? initialVolumes['insectkill'] : 0.32) * masterVolume;
  });

  // Shotgun sounds
  shotgunshotPool.forEach(audio => {
    audio.volume = (initialVolumes['shotgunshot'] !== undefined ? initialVolumes['shotgunshot'] : 0.17) * masterVolume;
  });

  // Heavy Shotgun sounds
  heavyshotgunshotPool.forEach(audio => {
    audio.volume = (initialVolumes['heavyshotgunshot'] !== undefined ? initialVolumes['heavyshotgunshot'] : 0.17) * masterVolume;
  });

  console.log(`Master volume set to: ${Math.round(masterVolume * 100)}%`);
}

// NOU: Funcție pentru actualizarea petelor de sânge (eliminarea celor expirate)
function updateBloodstains() {
  const now = performance.now();
  for (let i = bloodstains.length - 1; i >= 0; i--) {
    const stain = bloodstains[i];
    if (now - stain.creationTime > stain.duration) {
      bloodstains.splice(i, 1);
    }
  }
}

// NOU: Funcție pentru desenarea petelor de sânge pe sol
function drawBloodstains(ctx, offsetX, offsetY) {
  const now = performance.now();
  const FADE_START_TIME = 3000; // ms, start fading after 3 seconds

  for (const stain of bloodstains) {
    ctx.save();
    const stainLifetime = now - stain.creationTime;
    let opacityFactor = 1;

    if (stainLifetime > FADE_START_TIME) {
      const timeIntoFade = stainLifetime - FADE_START_TIME;
      const fadeDuration = stain.duration - FADE_START_TIME; // Duration of the fade itself
      if (fadeDuration > 0) { // Avoid division by zero if duration is somehow <= FADE_START_TIME
        opacityFactor = Math.max(0, 1 - (timeIntoFade / fadeDuration));
      } else {
        opacityFactor = 0; // Should already be gone if fadeDuration is not positive
      }
    }

    // Iterăm prin picăturile pre-calculate
    for (const droplet of stain.droplets) {
      const screenX = stain.x - offsetX + droplet.relativeX;
      const screenY = stain.y - offsetY + droplet.relativeY;
      
      // Aplicăm factorul de opacitate la alpha-ul original al picăturii
      const finalDropletAlpha = droplet.alpha * opacityFactor;

      // Construim culoarea cu alpha-ul specific picăturii
      // Ne asigurăm că înlocuim corect valoarea alpha din stringul RGBA
      const colorWithAlpha = stain.colorPattern.replace(/(\d\.?\d*\))$/, `${finalDropletAlpha.toFixed(2)})`);
      ctx.fillStyle = colorWithAlpha;
      
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, droplet.size, droplet.size * droplet.aspectRatio, droplet.rotation, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// --- HP REGEN pentru castel și Ion ---
setInterval(() => {
  // Regenerează castelul
  if (castleHP < CASTLE_MAX_HP && castleHP > 0) {
    castleHP = Math.min(CASTLE_MAX_HP, castleHP + 1);
  }
  // Regenerează Ion (player)
  if (player.hp < player.maxHp && player.hp > 0 && !player.respawnTimeout) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
  }
}, 1000); // 1 HP pe secundă





