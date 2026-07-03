import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const primaryAction = document.getElementById("primaryAction");
const restartButton = document.getElementById("restartButton");
const cameraButton = document.getElementById("cameraButton");
const soundButton = document.getElementById("soundButton");
const scoreNode = document.getElementById("score");
const highScoreNode = document.getElementById("highScore");
const cameraStatus = document.getElementById("cameraStatus");
const detectorStatus = document.getElementById("detectorStatus");
const actionStatus = document.getElementById("actionStatus");
const cameraPreview = document.getElementById("cameraPreview");
const controlMode = document.getElementById("controlMode");
const sensitivityInput = document.getElementById("sensitivity");
const speedInput = document.getElementById("speedLevel");

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 600;
const GROUND_Y = 558;
const ASSET_ROOT = "../Dino-game/resources";
const VISION_WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const assets = {
  dino: loadImage(`${ASSET_ROOT}/images/dino.svg`),
  dinoDuck: loadImage(`${ASSET_ROOT}/images/dino_ducking.svg`),
  cactusBig: loadImage(`${ASSET_ROOT}/images/cacti-big.svg`),
  cactusSmall: loadImage(`${ASSET_ROOT}/images/cacti-small.svg`),
  ptera: loadImage(`${ASSET_ROOT}/images/ptera.svg`),
  cloud: loadImage(`${ASSET_ROOT}/images/cloud.svg`),
  ground: loadImage(`${ASSET_ROOT}/images/ground-4x.svg`),
};

const state = {
  phase: "ready",
  frame: 0,
  score: 0,
  highScore: Number(localStorage.getItem("dinoControllerHighScore") || 0),
  speed: 10,
  groundX: 0,
  nextObstacleIn: 90,
  clouds: [],
  obstacles: [],
  sound: true,
  cameraEnabled: false,
};

const detector = {
  vision: null,
  faceLandmarker: null,
  poseLandmarker: null,
  ready: false,
  busy: false,
  lastVideoTime: -1,
  lastDetectTime: 0,
  lastJumpTime: 0,
  lastDuckTime: 0,
  lastActionTime: 0,
  bodyBaselineY: null,
  hipBaselineY: null,
};

const dino = {
  x: 64,
  y: GROUND_Y - 141,
  width: 132,
  height: 141,
  vy: 0,
  jumping: false,
  ducking: false,
  dead: false,
  anim: 0,
};

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function resetGame() {
  state.phase = "running";
  state.frame = 0;
  state.score = 0;
  state.speed = 7 + Number(speedInput.value);
  state.groundX = 0;
  state.nextObstacleIn = 70;
  state.clouds = [];
  state.obstacles = [];
  dino.x = 64;
  dino.y = GROUND_Y - 141;
  dino.width = 132;
  dino.height = 141;
  dino.vy = 0;
  dino.jumping = false;
  dino.ducking = false;
  dino.dead = false;
  dino.anim = 0;
  primaryAction.textContent = "RESTART";
  overlay.querySelector("h1").textContent = "D I N O  R U S H";
  overlay.classList.add("is-hidden");
  updateScore();
}

function endGame() {
  if (state.phase !== "running") return;
  state.phase = "ended";
  dino.dead = true;
  playTone(120, 0.14, "sawtooth");
  primaryAction.textContent = "RESTART";
  overlay.querySelector("h1").textContent = "G A M E  O V E R";
  overlay.classList.remove("is-hidden");
}

function jump() {
  if (state.phase === "ready" || state.phase === "ended") {
    resetGame();
    return;
  }
  if (state.phase !== "running" || dino.jumping || dino.dead) return;
  dino.jumping = true;
  dino.ducking = false;
  dino.vy = -20;
  playTone(560, 0.06, "square");
}

function setDuck(isDucking) {
  if (state.phase !== "running" || dino.jumping || dino.dead) return;
  dino.ducking = isDucking;
}

function updateDino() {
  if (dino.dead) return;

  if (dino.jumping) {
    dino.vy += 0.72;
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - 141) {
      dino.y = GROUND_Y - 141;
      dino.vy = 0;
      dino.jumping = false;
    }
  }

  dino.width = dino.ducking ? 177 : 132;
  dino.height = 141;
  dino.anim += 1;
}

function spawnCloud() {
  if (state.clouds.length >= 5 || Math.random() > 0.012) return;
  state.clouds.push({
    x: GAME_WIDTH + 40,
    y: 45 + Math.random() * 150,
    width: 132,
    height: 45,
    speed: 1 + Math.random() * 0.6,
  });
}

function spawnObstacle() {
  state.nextObstacleIn -= 1;
  if (state.nextObstacleIn > 0) return;

  const isCactus = Math.random() < 0.78;
  if (isCactus) {
    const big = Math.random() < 0.55;
    state.obstacles.push({
      type: big ? "cactusBig" : "cactusSmall",
      x: GAME_WIDTH + 30,
      y: GROUND_Y - (big ? 132 : 100),
      width: big ? 132 : 112,
      height: big ? 132 : 100,
      frame: Math.floor(Math.random() * (big ? 3 : 2)),
    });
  } else {
    const levels = [GROUND_Y - 160, GROUND_Y - 260, GROUND_Y - 390];
    state.obstacles.push({
      type: "ptera",
      x: GAME_WIDTH + 30,
      y: levels[Math.floor(Math.random() * levels.length)],
      width: 138,
      height: 126,
      frame: 0,
    });
  }

  state.nextObstacleIn = 70 + Math.floor(Math.random() * 58) - Math.min(22, state.speed);
}

function updateWorld() {
  if (state.phase !== "running") return;

  state.frame += 1;
  state.groundX = (state.groundX - state.speed) % GAME_WIDTH;
  state.speed += 0.0018;

  updateDino();
  spawnCloud();
  spawnObstacle();

  state.clouds.forEach((cloud) => {
    cloud.x -= cloud.speed;
  });
  state.clouds = state.clouds.filter((cloud) => cloud.x + cloud.width > -20);

  state.obstacles.forEach((obstacle) => {
    obstacle.x -= state.speed;
    if (obstacle.type === "ptera" && state.frame % 10 === 0) {
      obstacle.frame = (obstacle.frame + 1) % 2;
    }
  });
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);

  if (state.frame % 5 === 0) {
    state.score = Math.min(99999, state.score + 1);
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem("dinoControllerHighScore", String(state.highScore));
    }
    if (state.score > 0 && state.score % 100 === 0) {
      playTone(880, 0.08, "triangle");
    }
    updateScore();
  }

  if (state.obstacles.some(collidesWithDino)) {
    endGame();
  }
}

function collidesWithDino(obstacle) {
  const dinoBox = {
    x: dino.x + 24,
    y: dino.y + (dino.ducking ? 48 : 10),
    width: dino.width - 42,
    height: dino.ducking ? 64 : 118,
  };
  const obstacleBox = {
    x: obstacle.x + 16,
    y: obstacle.y + 16,
    width: obstacle.width - 32,
    height: obstacle.height - 24,
  };
  return rectanglesOverlap(dinoBox, obstacleBox);
}

function rectanglesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function draw() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.fillStyle = "#ebebeb";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawClouds();
  drawGround();
  drawDino();
  drawObstacles();
}

function drawGround() {
  const y = GROUND_Y - 48;
  drawImageSafe(assets.ground, state.groundX, y, GAME_WIDTH, 48);
  drawImageSafe(assets.ground, state.groundX + GAME_WIDTH, y, GAME_WIDTH, 48);
  drawImageSafe(assets.ground, state.groundX - GAME_WIDTH, y, GAME_WIDTH, 48);
}

function drawClouds() {
  for (const cloud of state.clouds) {
    drawImageSafe(assets.cloud, cloud.x, cloud.y, cloud.width, cloud.height);
  }
}

function drawDino() {
  if (dino.ducking && !dino.jumping) {
    const frame = Math.floor(dino.anim / 5) % 2;
    drawSprite(assets.dinoDuck, frame * 59, 0, 59, 47, dino.x, dino.y, 177, 141);
    return;
  }

  const frame = dino.dead ? 4 : dino.jumping ? 0 : 1 + (Math.floor(dino.anim / 5) % 3);
  drawSprite(assets.dino, frame * 44, 0, 44, 47, dino.x, dino.y, 132, 141);
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    if (obstacle.type === "cactusBig") {
      drawSprite(assets.cactusBig, obstacle.frame * 51, 0, 51, 51, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    } else if (obstacle.type === "cactusSmall") {
      drawSprite(assets.cactusSmall, obstacle.frame * 51, 0, 51, 38, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    } else {
      drawSprite(assets.ptera, obstacle.frame * 23, 0, 23, 21, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
  }
}

function drawImageSafe(image, x, y, width, height) {
  if (image.complete) {
    ctx.drawImage(image, x, y, width, height);
  }
}

function drawSprite(image, sx, sy, sw, sh, dx, dy, dw, dh) {
  if (image.complete) {
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }
}

function updateScore() {
  scoreNode.textContent = String(state.score).padStart(5, "0");
  highScoreNode.textContent = `HI ${String(state.highScore).padStart(5, "0")}`;
}

function gameLoop() {
  updateDetector();
  updateWorld();
  draw();
  requestAnimationFrame(gameLoop);
}

async function toggleCamera() {
  if (state.cameraEnabled) {
    stopCamera();
    return;
  }

  try {
    cameraStatus.textContent = "CAM WAIT";
    detectorStatus.textContent = "MODEL LOAD";
    await ensureLandmarkers();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    cameraPreview.srcObject = stream;
    await cameraPreview.play();

    state.cameraEnabled = true;
    detector.lastVideoTime = -1;
    detector.lastDetectTime = 0;
    detector.lastJumpTime = 0;
    detector.lastDuckTime = 0;
    detector.lastActionTime = 0;
    detector.bodyBaselineY = null;
    detector.hipBaselineY = null;

    cameraButton.classList.add("is-active");
    cameraStatus.classList.add("is-on");
    cameraStatus.textContent = "CAM ON";
    detectorStatus.textContent = "MODEL READY";
    actionStatus.textContent = "ACTION NONE";
    controlMode.value = controlMode.value === "keyboard" ? "mediapipe" : controlMode.value;
  } catch (error) {
    state.cameraEnabled = false;
    cameraButton.classList.remove("is-active");
    cameraStatus.classList.remove("is-on");
    cameraStatus.textContent = "CAM ERR";
    detectorStatus.textContent = "MODEL ERR";
    actionStatus.textContent = "CHECK NETWORK";
    console.error(error);
  }
}

async function ensureLandmarkers() {
  if (detector.ready) return;

  detector.vision = await FilesetResolver.forVisionTasks(VISION_WASM_ROOT);

  const [faceLandmarker, poseLandmarker] = await Promise.all([
    createFaceLandmarker("GPU").catch(() => createFaceLandmarker("CPU")),
    createPoseLandmarker("GPU").catch(() => createPoseLandmarker("CPU")),
  ]);

  detector.faceLandmarker = faceLandmarker;
  detector.poseLandmarker = poseLandmarker;
  detector.ready = true;
}

function createFaceLandmarker(delegate) {
  return FaceLandmarker.createFromOptions(detector.vision, {
    baseOptions: {
      delegate,
      modelAssetPath: FACE_MODEL_URL,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

function createPoseLandmarker(delegate) {
  return PoseLandmarker.createFromOptions(detector.vision, {
    baseOptions: {
      delegate,
      modelAssetPath: POSE_MODEL_URL,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

function stopCamera() {
  const stream = cameraPreview.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  cameraPreview.srcObject = null;
  state.cameraEnabled = false;
  cameraButton.classList.remove("is-active");
  cameraStatus.classList.remove("is-on");
  cameraStatus.textContent = "CAM OFF";
  detectorStatus.textContent = detector.ready ? "MODEL READY" : "MODEL IDLE";
  actionStatus.textContent = "ACTION NONE";
}

function updateDetector() {
  if (
    !state.cameraEnabled ||
    !detector.ready ||
    detector.busy ||
    controlMode.value === "keyboard" ||
    cameraPreview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return;
  }

  const now = performance.now();
  if (now - detector.lastDetectTime < 90 || cameraPreview.currentTime === detector.lastVideoTime) {
    clearStaleAction(now);
    return;
  }

  detector.busy = true;
  detector.lastDetectTime = now;
  detector.lastVideoTime = cameraPreview.currentTime;

  try {
    let faceResults = null;
    let poseResults = null;
    if (controlMode.value === "mediapipe" || controlMode.value === "mouth") {
      faceResults = detector.faceLandmarker.detectForVideo(cameraPreview, now);
    }
    if (controlMode.value === "mediapipe" || controlMode.value === "body") {
      poseResults = detector.poseLandmarker.detectForVideo(cameraPreview, now);
    }
    handleDetectorResults(faceResults, poseResults, now);
  } finally {
    detector.busy = false;
  }
}

function handleDetectorResults(faceResults, poseResults, now) {
  const actions = [];

  if (faceResults?.faceLandmarks?.length) {
    const mouthRatio = getMouthOpenRatio(faceResults.faceLandmarks[0]);
    if (mouthRatio > getMouthThreshold() && now - detector.lastJumpTime > 650) {
      detector.lastJumpTime = now;
      actions.push("MOUTH");
      jump();
    }
  }

  if (poseResults?.landmarks?.length) {
    const poseAction = detectPoseAction(poseResults.landmarks[0], now);
    if (poseAction === "JUMP") {
      actions.push("JUMP");
      jump();
    } else if (poseAction === "DUCK") {
      actions.push("DUCK");
      setDuck(true);
    } else {
      setDuck(false);
    }
  } else if (controlMode.value !== "mouth") {
    setDuck(false);
  }

  if (actions.length) {
    detector.lastActionTime = now;
    actionStatus.textContent = `ACTION ${actions.join("+")}`;
  } else {
    clearStaleAction(now);
  }
}

function getMouthOpenRatio(faceLandmarks) {
  const left = faceLandmarks[61];
  const right = faceLandmarks[291];
  const upper = faceLandmarks[13];
  const lower = faceLandmarks[14];
  return distance(upper, lower) / Math.max(distance(left, right), 0.001);
}

function detectPoseAction(landmarks, now) {
  const visibleLandmarks = [0, 11, 12, 23, 24].map((index) => landmarks[index]);
  if (visibleLandmarks.some((point) => !point || point.visibility < 0.45)) {
    return null;
  }

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const bodyY = nose.y * 0.45 + shoulderY * 0.35 + hipY * 0.2;

  if (detector.bodyBaselineY === null || detector.hipBaselineY === null) {
    detector.bodyBaselineY = bodyY;
    detector.hipBaselineY = hipY;
    detectorStatus.textContent = "MODEL CALIB";
    return null;
  }

  const sensitivity = Number(sensitivityInput.value);
  const jumpThreshold = 0.13 - sensitivity * 0.0014;
  const duckThreshold = 0.095 - sensitivity * 0.0008;
  const movedUp = detector.bodyBaselineY - bodyY;
  const movedDown = hipY - detector.hipBaselineY;

  detector.bodyBaselineY = detector.bodyBaselineY * 0.985 + bodyY * 0.015;
  detector.hipBaselineY = detector.hipBaselineY * 0.985 + hipY * 0.015;
  detectorStatus.textContent = "MODEL TRACK";

  if (movedUp > jumpThreshold && now - detector.lastJumpTime > 700) {
    detector.lastJumpTime = now;
    return "JUMP";
  }
  if (movedDown > duckThreshold && now - detector.lastDuckTime > 120) {
    detector.lastDuckTime = now;
    return "DUCK";
  }
  return null;
}

function getMouthThreshold() {
  return 0.42 - Number(sensitivityInput.value) * 0.003;
}

function clearStaleAction(now) {
  if (now - detector.lastActionTime > 350) {
    actionStatus.textContent = "ACTION NONE";
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playTone(frequency, duration, type) {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audio = playTone.audio || new AudioContext();
  playTone.audio = audio;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.04, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function toggleSound() {
  state.sound = !state.sound;
  soundButton.classList.toggle("is-active", state.sound);
}

primaryAction.addEventListener("click", resetGame);
restartButton.addEventListener("click", resetGame);
cameraButton.addEventListener("click", toggleCamera);
soundButton.addEventListener("click", toggleSound);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }
  if (event.code === "KeyR") {
    resetGame();
  }
  if (event.code === "KeyC") {
    toggleCamera();
  }
  if (event.code === "KeyS") {
    toggleSound();
  }
  if (event.code === "ArrowDown") {
    event.preventDefault();
    setDuck(true);
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown") {
    event.preventDefault();
    setDuck(false);
  }
});

canvas.addEventListener("pointerdown", jump);

updateScore();
soundButton.classList.add("is-active");
gameLoop();
