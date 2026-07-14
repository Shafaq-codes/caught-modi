// ============================================================
// GAME LOGIC - CAUGHT MODI
// ============================================================

// --- Fullscreen Utility ---
function openFullscreen() {
    const docElm = document.documentElement;
    if (docElm.requestFullscreen) {
        docElm.requestFullscreen().catch(err => console.log(err));
    } else if (docElm.webkitRequestFullscreen) {
        docElm.webkitRequestFullscreen();
    } else if (docElm.msRequestFullscreen) {
        docElm.msRequestFullscreen();
    }
}

// --- Audio Context and Synthesizer System ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext({ latencyHint: 'interactive' });
const customAudioBuffers = {};
let currentHitAudioNode = null;
let activeBlockingSources = 0;

// Play custom audio asset
function playCustomAudio(name, isHit = false, offset = 0) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!customAudioBuffers[name]) return;

    // Block jump/move sound if a start or hit audio is playing
    if ((name === 'jump' || name === 'whatsapp_move') && activeBlockingSources > 0) {
        return;
    }

    // Stop current hit audio node if a new hit occurs to prevent muddy overlapping
    if (isHit && currentHitAudioNode) {
        try { currentHitAudioNode.stop(); } catch (e) {}
    }

    const source = audioCtx.createBufferSource();
    source.buffer = customAudioBuffers[name];
    source.connect(audioCtx.destination);
    source.start(0, offset);

    if (isHit) {
        currentHitAudioNode = source;
    }

    // Treat non-jump and non-move sounds as blocking
    if (name !== 'jump' && name !== 'whatsapp_move') {
        activeBlockingSources++;
        source.onended = () => {
            activeBlockingSources = Math.max(0, activeBlockingSources - 1);
        };
    }
}

// Procedural audio synthesizer for coin collections
function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

// --- Asset Loading Management ---
const loadingManager = new THREE.LoadingManager();

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const progress = Math.floor((itemsLoaded / itemsTotal) * 100);
    document.getElementById('loading-progress').innerText = progress + '%';
};

loadingManager.onLoad = function () {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
};

const textureLoader = new THREE.TextureLoader(loadingManager);
const audioLoader = new THREE.AudioLoader(loadingManager);

// Load Custom Meme MP3 Audio
audioLoader.load('https://pub-f5acc21903e442ac86d7544a04395514.r2.dev/bhn%20ny%20gory.mp3', buffer => { customAudioBuffers['jump'] = buffer; });
audioLoader.load('https://pub-f5acc21903e442ac86d7544a04395514.r2.dev/niai%20rajam.mp3', buffer => { customAudioBuffers['start'] = buffer; });
audioLoader.load('https://pub-f5acc21903e442ac86d7544a04395514.r2.dev/ruk%20ruk%20cid.mp3', buffer => { customAudioBuffers['hit1'] = buffer; });
audioLoader.load('https://pub-f5acc21903e442ac86d7544a04395514.r2.dev/aik%20bar%20mil%20(baal).mp3', buffer => { customAudioBuffers['hit2'] = buffer; });
audioLoader.load('https://pub-f5acc21903e442ac86d7544a04395514.r2.dev/q%20re%20paglo.mp3', buffer => { customAudioBuffers['hit3'] = buffer; });
audioLoader.load('WhatsApp%20Audio%202026-07-14%20at%205.50.22%20PM.mpeg', buffer => { customAudioBuffers['whatsapp_move'] = buffer; });

// --- Procedural Canvas Textures ---
function createStoneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#34495e';
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            ctx.beginPath();
            ctx.roundRect(i * 64 + 4, j * 64 + 4, 56, 56, 4);
            ctx.fill();
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath();
            ctx.roundRect(i * 64 + 6, j * 64 + 6, 52, 52, 3);
            ctx.fill();
            ctx.fillStyle = '#34495e';
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 16; j++) {
            const offset = (j % 2 === 0) ? 0 : 32;
            ctx.fillStyle = '#d35400';
            ctx.beginPath();
            ctx.roundRect(i * 64 - offset, j * 32 + 2, 60, 28, 2);
            ctx.fill();
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            ctx.roundRect(i * 64 - offset + 2, j * 32 + 4, 56, 24, 2);
            ctx.fill();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const texStone = createStoneTexture();
texStone.repeat.set(3, 100);
const texBrick = createBrickTexture();

// --- Game Configurations ---
const LANE_WIDTH = 4.5;
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
const PLAYER_BASE_Y = 2.0;

let gameState = 'START'; // START | PLAYING | CAUGHT
let score = 0;
let coins = 0;
let lives = 3;
let distanceTraveled = 0;
let baseSpeed = 45;
let currentSpeed = 0;

// --- Three.js Initialization ---
const canvasElement = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaedcf4); // Light blue sky color
scene.fog = new THREE.Fog(0xaedcf4, 80, 450);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 800);

// Lights
const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.95);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
dirLight.position.set(80, 180, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -60;
dirLight.shadow.camera.right = 60;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -40;
dirLight.shadow.camera.far = 300;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// --- Materials and Shared Geometries ---
const matStone = new THREE.MeshLambertMaterial({ map: texStone, color: 0xdddddd });
const matRuin = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 1.0 });
const matBrick = new THREE.MeshStandardMaterial({ map: texBrick, roughness: 0.95 });
const matRock = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 1.0, flatShading: true });
const matWood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
const matGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.15 });
const matLeaves = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 1.0 });
const matMountain = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 1.0, flatShading: true });
const matGround = new THREE.MeshStandardMaterial({ color: 0x3d9b4c, roughness: 1.0 });
const matCloud = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

const geoMountain = new THREE.ConeGeometry(1, 1, 5);
const geoCloudSphere = new THREE.SphereGeometry(1, 8, 8);
const geoTempleB1 = new THREE.BoxGeometry(60, 10, 60);
const geoTempleB2 = new THREE.BoxGeometry(45, 10, 45);
const geoTempleB3 = new THREE.BoxGeometry(30, 10, 30);
const geoTreeTrunk = new THREE.CylinderGeometry(1, 1.5, 12, 6);
const geoTreeLeaves = new THREE.ConeGeometry(7, 18, 6);
const geoObstacleBrick = new THREE.BoxGeometry(LANE_WIDTH - 0.2, 3.5, 1.5);
const geoObstacleRock = new THREE.DodecahedronGeometry(1.5, 0);
const geoCoin = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
const geoShadowCircle = new THREE.CircleGeometry(1, 16);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 });

// --- Game Objects ---
let playerGroup, pTorso, pShadow, playerTex;
let monsterGroup, mTorso, monsterTex;
let caughtMesh, caughtTex;

let obstacles = [];
let coinList = [];
let environmentList = [];

let currentLaneIndex = 1; // 0: Left, 1: Center, 2: Right
let targetX = 0;
let yVelocity = 0;
const gravity = -75;
const jumpForce = 28;
let isJumping = false;
let hitTimer = 0;

let targetMonsterZ = 25; // Z offset from player
let currentMonsterZ = 25;

const targetCamZ = 24;
const targetCamY = 11;

// --- Setup Scene ---
function createGround() {
    const groundGeo = new THREE.PlaneGeometry(2500, 2500);
    const ground = new THREE.Mesh(groundGeo, matGround);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
}

function createRoad() {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH * 3 + 2, 900), matStone);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -350;
    road.receiveShadow = true;
    scene.add(road);
}

// --- Player Character (Modi running sprite) ---
function createPlayer() {
    playerGroup = new THREE.Group();

    // Sprite Sheet load
    playerTex = textureLoader.load('https://pub-742a4db0fefe4d9b9bf82cf1432444c3.r2.dev/modi%20runn.webp');
    playerTex.wrapS = THREE.RepeatWrapping;
    playerTex.wrapT = THREE.RepeatWrapping;
    playerTex.repeat.set(0.25, 0.25); // 4x4 Grid

    const playerMat = new THREE.MeshStandardMaterial({
        map: playerTex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
    });

    pTorso = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 6.0), playerMat);
    pTorso.position.y = PLAYER_BASE_Y;

    pShadow = new THREE.Mesh(geoShadowCircle, shadowMat);
    pShadow.scale.set(0.7, 0.7, 1);
    pShadow.rotation.x = -Math.PI / 2;
    pShadow.position.y = 0.05;

    // Caught animation
    caughtTex = textureLoader.load('https://pub-742a4db0fefe4d9b9bf82cf1432444c3.r2.dev/acp%20caught.webp');
    caughtTex.wrapS = THREE.RepeatWrapping;
    caughtTex.wrapT = THREE.RepeatWrapping;
    caughtTex.repeat.set(0.25, 0.25); // 4x4 Grid

    const caughtMat = new THREE.MeshStandardMaterial({
        map: caughtTex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
    });

    caughtMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), caughtMat);
    caughtMesh.position.y = PLAYER_BASE_Y + 1.2;
    caughtMesh.visible = false;

    playerGroup.add(pTorso, pShadow, caughtMesh);
    scene.add(playerGroup);
}

// --- Monster Character (ACP Pradyuman sprite) ---
function createMonster() {
    monsterGroup = new THREE.Group();

    monsterTex = textureLoader.load('https://pub-742a4db0fefe4d9b9bf82cf1432444c3.r2.dev/acp%20runn.webp');
    monsterTex.wrapS = THREE.RepeatWrapping;
    monsterTex.wrapT = THREE.RepeatWrapping;
    monsterTex.repeat.set(0.25, 0.25);

    const monsterMat = new THREE.MeshStandardMaterial({
        map: monsterTex,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
    });

    mTorso = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 6.5), monsterMat);
    mTorso.position.y = PLAYER_BASE_Y + 0.2;

    const mShadow = new THREE.Mesh(geoShadowCircle, shadowMat);
    mShadow.scale.set(0.8, 0.8, 1);
    mShadow.rotation.x = -Math.PI / 2;
    mShadow.position.y = 0.05;

    monsterGroup.add(mTorso, mShadow);
    monsterGroup.position.set(0, 0, currentMonsterZ);
    scene.add(monsterGroup);
}

// --- Environment Generation ---
function spawnMountain(zPos) {
    const m = new THREE.Mesh(geoMountain, matMountain);
    const radius = 80 + Math.random() * 120;
    const height = 150 + Math.random() * 200;
    m.scale.set(radius, height, radius);
    const offset = radius + 80 + Math.random() * 150;
    const x = (Math.random() > 0.5 ? 1 : -1) * offset;
    m.position.set(x, height / 2 - 20, zPos);
    m.rotation.y = Math.random() * Math.PI;
    scene.add(m);
    environmentList.push(m);
}

function spawnCloud(zPos) {
    const cloud = new THREE.Group();
    for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(geoCloudSphere, matCloud);
        const scale = 15 + Math.random() * 15;
        s.scale.set(scale, scale, scale);
        s.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 30);
        cloud.add(s);
    }
    const x = (Math.random() - 0.5) * 450;
    const y = 120 + Math.random() * 80;
    cloud.position.set(x, y, zPos);
    scene.add(cloud);
    environmentList.push(cloud);
}

function spawnTemple(zPos) {
    const temple = new THREE.Group();
    const b1 = new THREE.Mesh(geoTempleB1, matRuin); b1.position.y = 5; b1.castShadow = true; b1.receiveShadow = true;
    const b2 = new THREE.Mesh(geoTempleB2, matRuin); b2.position.y = 15; b2.castShadow = true; b2.receiveShadow = true;
    const b3 = new THREE.Mesh(geoTempleB3, matRuin); b3.position.y = 25; b3.castShadow = true; b3.receiveShadow = true;
    temple.add(b1, b2, b3);

    const x = (Math.random() > 0.5 ? 1 : -1) * (85 + Math.random() * 55);
    temple.position.set(x, 0, zPos);
    temple.rotation.y = (Math.random() - 0.5) * 0.4;
    scene.add(temple);
    environmentList.push(temple);
}

function spawnTree(zPos, xOffset) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(geoTreeTrunk, matWood); trunk.position.y = 6; trunk.castShadow = true; trunk.receiveShadow = true;
    const leaves = new THREE.Mesh(geoTreeLeaves, matLeaves); leaves.position.y = 18; leaves.castShadow = true;
    tree.add(trunk, leaves);
    tree.position.set(xOffset, 0, zPos);
    tree.rotation.z = (Math.random() - 0.5) * 0.15;
    scene.add(tree);
    environmentList.push(tree);
}

function spawnEnvironment(zPos) {
    for (let i = 0; i < 4; i++) {
        spawnTree(zPos + (Math.random() * 20 - 10), -12 - Math.random() * 40);
        spawnTree(zPos + (Math.random() * 20 - 10), 12 + Math.random() * 40);
    }
    if (Math.random() > 0.45) spawnMountain(zPos - Math.random() * 50);
    if (Math.random() > 0.65) spawnTemple(zPos - Math.random() * 50);
    if (Math.random() > 0.35) spawnCloud(zPos - Math.random() * 50);
}

// --- Obstacles and Coins Spawning ---
function spawnObstacle(zPos) {
    const type = Math.floor(Math.random() * 2);
    const laneIdx = Math.floor(Math.random() * 3);
    const xPos = LANES[laneIdx];
    const obs = new THREE.Group();
    let hitBox;

    if (type === 0) {
        // Brick wall barrier
        const mesh = new THREE.Mesh(geoObstacleBrick, matBrick);
        mesh.position.y = 1.75;
        mesh.castShadow = true;
        obs.add(mesh);
        hitBox = new THREE.Box3().setFromObject(mesh);
    } else {
        // Boulder rock obstacle
        const mesh = new THREE.Mesh(geoObstacleRock, matRock);
        mesh.scale.set(1.1, 0.85, 1.1);
        mesh.position.y = 1.0;
        mesh.castShadow = true;
        mesh.rotation.set(Math.random(), Math.random(), Math.random());
        obs.add(mesh);
        hitBox = new THREE.Box3().setFromObject(mesh);
    }

    obs.position.set(xPos, 0, zPos);
    scene.add(obs);
    obstacles.push({ mesh: obs, hitBoxBase: hitBox });
}

function spawnCoin(zPos) {
    const laneIdx = Math.floor(Math.random() * 3);
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
        const coin = new THREE.Mesh(geoCoin, matGold);
        coin.rotation.x = Math.PI / 2;
        coin.position.set(LANES[laneIdx], 1.2, zPos - i * 3.5);
        coin.castShadow = true;
        scene.add(coin);
        coinList.push(coin);
    }
}

// --- Game Initializer ---
function initGame() {
    createGround();
    createPlayer();
    createMonster();
    createRoad();
    for (let z = 0; z > -500; z -= 30) {
        spawnEnvironment(z);
    }
}

// --- Game Reset Loop ---
function resetGame() {
    obstacles.forEach(o => scene.remove(o.mesh)); obstacles = [];
    coinList.forEach(c => scene.remove(c)); coinList = [];
    environmentList.forEach(e => scene.remove(e)); environmentList = [];

    score = 0;
    coins = 0;
    lives = 3;
    distanceTraveled = 0;
    currentSpeed = baseSpeed;

    nextObstacleZ = -80;
    nextCoinZ = -60;
    nextEnvZ = -30;

    currentLaneIndex = 1;
    targetX = LANES[currentLaneIndex];
    playerGroup.position.set(targetX, 0, 0);

    pTorso.position.y = PLAYER_BASE_Y;
    pTorso.visible = true;
    if (pShadow) {
        pShadow.visible = true;
        pShadow.scale.set(0.7, 0.7, 1);
    }

    monsterGroup.visible = true;
    if (caughtMesh) caughtMesh.visible = false;

    yVelocity = 0;
    isJumping = false;
    hitTimer = 0;

    targetMonsterZ = 25;
    currentMonsterZ = 25;
    monsterGroup.position.set(targetX, 0, currentMonsterZ);

    updateUI();
    for (let z = 0; z > -500; z -= 30) {
        spawnEnvironment(z);
    }
}

let nextObstacleZ = -80;
let nextCoinZ = -60;
let nextEnvZ = -30;

function handleSpawning(dt) {
    let travel = currentSpeed * dt;
    distanceTraveled += travel;

    if (distanceTraveled > -nextObstacleZ) {
        spawnObstacle(-400);
        nextObstacleZ -= (35 + Math.random() * 40 - (currentSpeed / 20));
    }
    if (distanceTraveled > -nextCoinZ) {
        spawnCoin(-400);
        nextCoinZ -= (40 + Math.random() * 60);
    }
    if (distanceTraveled > -nextEnvZ) {
        spawnEnvironment(-500);
        nextEnvZ -= 30;
    }
}

// --- Collision Solvers ---
function checkCollisions() {
    if (hitTimer > 0) return;
    
    // Create bounding box for player
    const pBox = new THREE.Box3();
    pBox.setFromCenterAndSize(
        new THREE.Vector3(playerGroup.position.x, pTorso.position.y, playerGroup.position.z),
        new THREE.Vector3(2.0, 4.0, 1.2)
    );

    // Obstacle Hit Check
    for (let i = 0; i < obstacles.length; i++) {
        if (obstacles[i].mesh.position.z > 5) continue;
        const oBox = new THREE.Box3().setFromObject(obstacles[i].mesh);
        oBox.expandByScalar(-0.35); // Adjust hitbox slightly smaller for fairer gameplay
        if (pBox.intersectsBox(oBox)) {
            handleHit();
            break;
        }
    }

    // Coin Collection Hit Check
    for (let i = coinList.length - 1; i >= 0; i--) {
        const cBox = new THREE.Box3().setFromObject(coinList[i]);
        if (pBox.intersectsBox(cBox)) {
            playSound('coin');
            scene.remove(coinList[i]);
            coinList.splice(i, 1);
            coins++;
            score += 50;
            updateUI();
        }
    }
}

function handleHit() {
    if (hitTimer > 0) return;
    hitTimer = 2.0; // Invincibility frames
    lives--;
    updateUI();

    // Sound sequencing based on remaining lives
    if (lives === 2) {
        playCustomAudio('hit1', true);
    } else if (lives === 1) {
        playCustomAudio('hit2', true);
    } else if (lives <= 0) {
        playCustomAudio('hit3', true);
    }

    // Show screen red flash overlay
    const dmgOverlay = document.getElementById('damage-overlay');
    dmgOverlay.classList.add('damage-active');
    setTimeout(() => dmgOverlay.classList.remove('damage-active'), 300);

    if (lives > 0) {
        targetMonsterZ = Math.max(6, targetMonsterZ - 9); // Bring monster closer to player

        // Invincibility flicker animation
        const blinkInterval = setInterval(() => {
            if (gameState !== 'PLAYING') {
                clearInterval(blinkInterval);
                return;
            }
            pTorso.visible = !pTorso.visible;
        }, 150);

        setTimeout(() => {
            clearInterval(blinkInterval);
            if (pTorso) pTorso.visible = true;
        }, 2000);
    } else {
        // Caught sequence
        gameState = 'CAUGHT';
        targetMonsterZ = 0;

        pTorso.visible = false;
        if (pShadow) pShadow.visible = false;
        monsterGroup.visible = false;

        caughtMesh.visible = true;
        playerGroup.position.z -= 4;

        // Hold display on caught animation then switch to game over details
        setTimeout(gameOver, 4500);
    }
}

// --- High Score Tracker ---
function updateHighScores() {
    const savedHighScore = localStorage.getItem('caught_modi_high_score') || 0;
    const finalDistanceScore = Math.floor(score);
    if (finalDistanceScore > savedHighScore) {
        localStorage.setItem('caught_modi_high_score', finalDistanceScore);
        document.getElementById('high-score-val').innerText = finalDistanceScore;
    } else {
        document.getElementById('high-score-val').innerText = savedHighScore;
    }
}

function updateUI() {
    document.getElementById('score-val').innerText = Math.floor(score);
    document.getElementById('coins-val').innerText = coins;
    document.getElementById('lives-val').innerText = lives;
}

function gameOver() {
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = Math.floor(score);
    document.getElementById('final-coins').innerText = coins;
    updateHighScores();
}

// --- Player Inputs & Fast Falling ---
function moveLeft() {
    if (currentLaneIndex > 0) {
        currentLaneIndex--;
        targetX = LANES[currentLaneIndex];
        playCustomAudio('whatsapp_move', false, 0.325);
    }
}

function moveRight() {
    if (currentLaneIndex < 2) {
        currentLaneIndex++;
        targetX = LANES[currentLaneIndex];
        playCustomAudio('whatsapp_move', false, 0.325);
    }
}

function jump() {
    if (!isJumping) {
        playCustomAudio('whatsapp_move', false, 0.325);
        isJumping = true;
        yVelocity = jumpForce;
    }
}

// Fast drop downward slide mechanics
function fastFall() {
    if (isJumping) {
        yVelocity = -150; // Instantly pulls player downwards
    }
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (gameState !== 'PLAYING') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') jump();
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') fastFall();
});

let tsX = 0;
let tsY = 0;

window.addEventListener('touchstart', (e) => {
    tsX = e.changedTouches[0].screenX;
    tsY = e.changedTouches[0].screenY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (gameState !== 'PLAYING') return;
    const dx = e.changedTouches[0].screenX - tsX;
    const dy = e.changedTouches[0].screenY - tsY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) {
            if (dx > 0) moveRight();
            else moveLeft();
        }
    } else {
        if (Math.abs(dy) > 30) {
            if (dy < 0) jump();
            else fastFall();
        }
    }
}, { passive: true });

// --- Screen Transitions Trigger ---
document.getElementById('btn-play').addEventListener('click', () => {
    openFullscreen();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    playCustomAudio('start');
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    resetGame();
    gameState = 'PLAYING';
});

document.getElementById('btn-restart').addEventListener('click', () => {
    openFullscreen();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    playCustomAudio('start');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    resetGame();
    gameState = 'PLAYING';
});

// --- Core Loop Animation ---
const clock = new THREE.Clock();
let animTime = 0;

function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1);
    animTime += dt * 15;

    if (gameState === 'PLAYING') {
        currentSpeed = baseSpeed + (distanceTraveled / 1200); // Speed scales slowly as distance increases
        playerGroup.position.x += (targetX - playerGroup.position.x) * 15 * dt;

        // Jump physics logic
        if (isJumping) {
            pTorso.position.y += yVelocity * dt;
            yVelocity += gravity * dt;

            if (pTorso.position.y <= PLAYER_BASE_Y) {
                pTorso.position.y = PLAYER_BASE_Y;
                isJumping = false;
                yVelocity = 0;
            }
        }

        // Shadow scaling on height
        let jumpHeight = Math.max(0, pTorso.position.y - PLAYER_BASE_Y);
        let shadowScale = Math.max(0.2, 0.7 - (jumpHeight / 10.0));
        if (pShadow) {
            pShadow.scale.set(shadowScale, shadowScale, 1);
        }

        // Sprite frame offsets running calculation (Player)
        if (playerTex) {
            let currentFrame = Math.floor(animTime * 2.2) % 15;
            let col = currentFrame % 4;
            let row = 3 - Math.floor(currentFrame / 4);
            playerTex.offset.x = col / 4;
            playerTex.offset.y = row / 4;
        }

        // Sprite frame offsets running calculation (Monster)
        if (monsterTex) {
            let mFrame = Math.floor(animTime * 2.2) % 15;
            let mCol = mFrame % 4;
            let mRow = 3 - Math.floor(mFrame / 4);
            monsterTex.offset.x = mCol / 4;
            monsterTex.offset.y = mRow / 4;
        }

        if (hitTimer > 0) {
            hitTimer -= dt;
        }

        // Monster trailing logic
        monsterGroup.position.x += (playerGroup.position.x - monsterGroup.position.x) * 5 * dt;
        currentMonsterZ += (targetMonsterZ - currentMonsterZ) * 2 * dt;
        monsterGroup.position.z = playerGroup.position.z + currentMonsterZ;

        // Ground movements ahead
        const moveZ = currentSpeed * dt;
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].mesh.position.z += moveZ;
            // Update the absolute world-space bounding box check
            obstacles[i].hitBoxBase.setFromObject(obstacles[i].mesh);
            if (obstacles[i].mesh.position.z > 20) {
                scene.remove(obstacles[i].mesh);
                obstacles.splice(i, 1);
            }
        }

        for (let i = coinList.length - 1; i >= 0; i--) {
            coinList[i].position.z += moveZ;
            coinList[i].rotation.y += 4 * dt;
            coinList[i].position.y = 1.2 + Math.sin(animTime * 0.5 + i) * 0.25;
            if (coinList[i].position.z > 20) {
                scene.remove(coinList[i]);
                coinList.splice(i, 1);
            }
        }

        for (let i = environmentList.length - 1; i >= 0; i--) {
            environmentList[i].position.z += moveZ;
            if (environmentList[i].position.z > 80) {
                scene.remove(environmentList[i]);
                environmentList.splice(i, 1);
            }
        }

        handleSpawning(dt);
        checkCollisions();

        // Increment distance-based score
        score += (currentSpeed / 4) * dt;
        if (Math.floor(score) % 4 === 0) {
            updateUI();
        }

    } else if (gameState === 'CAUGHT') {
        // Caught frame loops
        if (caughtTex) {
            let cFrame = Math.floor(animTime * 2.0) % 15;
            let cCol = cFrame % 4;
            let cRow = 3 - Math.floor(cFrame / 4);
            caughtTex.offset.x = cCol / 4;
            caughtTex.offset.y = cRow / 4;
        }
    }

    // Camera follow systems
    if (gameState === 'PLAYING' || gameState === 'CAUGHT') {
        camera.position.x += (playerGroup.position.x * 0.5 - camera.position.x) * 5 * dt;
        camera.position.y += ((targetCamY + (isJumping ? (pTorso.position.y - PLAYER_BASE_Y) * 0.35 : 0)) - camera.position.y) * 3 * dt;
        camera.position.z += ((playerGroup.position.z + targetCamZ) - camera.position.z) * 3 * dt;

        camera.lookAt(playerGroup.position.x * 0.2, 3.2, playerGroup.position.z - 30);

        // Screen shake effect on taking hits
        if (hitTimer > 1.7 && gameState === 'PLAYING') {
            camera.position.x += (Math.random() - 0.5) * 1.3;
            camera.position.y += (Math.random() - 0.5) * 1.3;
        }
    }

    renderer.render(scene, camera);
}

// Window resizing handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the game initialization
initGame();
animate();
