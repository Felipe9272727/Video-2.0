import './styles.css';
import { RiftRider } from './game.js';
import { AudioSystem } from './audio.js';

const $ = (selector) => document.querySelector(selector);
const ui = {
  start: $('#start-screen'),
  pause: $('#pause-screen'),
  over: $('#game-over-screen'),
  hud: $('#hud'),
  controls: $('#controls'),
  reticle: $('#reticle'),
  pauseBtn: $('#pause-btn'),
  soundBtn: $('#sound-btn'),
  boostBtn: $('#boost-btn'),
  score: $('#score'),
  zone: $('#zone'),
  combo: $('#combo'),
  comboFill: $('#combo-fill'),
  energyFill: $('#energy-fill'),
  shield: $('#shield-indicator'),
  speedLines: $('#speed-lines'),
  toast: $('#toast'),
  damage: $('#damage-flash'),
  best: $('#best-score'),
  finalScore: $('#final-score'),
  finalShards: $('#final-shards'),
  finalCombo: $('#final-combo'),
  newRecord: $('#new-record'),
  joystickZone: $('#joystick-zone'),
  joystickThumb: $('#joystick-thumb'),
};

const audio = new AudioSystem();
let bestScore = Number(localStorage.getItem('rift-rider-best') || 0);
ui.best.textContent = `RECORDE // ${String(bestScore).padStart(5, '0')}`;

const vibrate = (pattern) => {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
};

const game = new RiftRider($('#scene'), {
  onState(state) {
    ui.start.classList.toggle('active', state === 'menu');
    ui.pause.classList.toggle('active', state === 'paused');
    ui.over.classList.toggle('active', state === 'over');
    const playing = state === 'running';
    ui.hud.classList.toggle('hidden', !playing);
    ui.controls.classList.toggle('hidden', !playing);
    ui.reticle.classList.toggle('hidden', !playing);
    ui.pauseBtn.classList.toggle('hidden', !playing);
    audio.setEngine(playing, false);
  },
  onHud(data) {
    ui.score.textContent = String(data.score).padStart(5, '0');
    ui.zone.textContent = String(data.zone).padStart(2, '0');
    ui.combo.textContent = `COMBO ×${data.combo}`;
    ui.comboFill.style.transform = `scaleX(${data.comboProgress})`;
    ui.energyFill.style.transform = `scaleX(${data.energy})`;
    ui.shield.classList.toggle('hidden', !data.shield);
    ui.boostBtn.classList.toggle('empty', data.energy < 0.03);
    ui.boostBtn.classList.toggle('active', data.boosting);
    ui.speedLines.classList.toggle('active', data.boosting);
    audio.setEngine(true, data.boosting);
  },
  onShard(combo) {
    audio.shard(combo);
    vibrate(12);
  },
  onShield() {
    audio.shield();
    vibrate([20, 30, 20]);
  },
  onShieldBreak() {
    audio.hit();
    flashDamage();
    vibrate([70, 35, 45]);
  },
  onNearMiss() {
    audio.nearMiss();
    vibrate(18);
  },
  onCrash(result) {
    audio.hit();
    audio.setEngine(false);
    flashDamage();
    vibrate([120, 45, 180]);
    ui.finalScore.textContent = String(result.score).padStart(5, '0');
    ui.finalShards.textContent = String(result.shards).padStart(2, '0');
    ui.finalCombo.textContent = `×${result.bestCombo}`;
    const isRecord = result.score > bestScore;
    if (isRecord) {
      bestScore = result.score;
      localStorage.setItem('rift-rider-best', String(bestScore));
      ui.best.textContent = `RECORDE // ${String(bestScore).padStart(5, '0')}`;
    }
    ui.newRecord.classList.toggle('hidden', !isRecord);
  },
  onToast(message) {
    showToast(message);
  },
});

function startGame() {
  audio.init();
  audio.start();
  game.start();
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth;
  ui.toast.classList.add('show');
}

function flashDamage() {
  ui.damage.classList.remove('flash');
  void ui.damage.offsetWidth;
  ui.damage.classList.add('flash');
}

$('#start-btn').addEventListener('click', startGame);
$('#restart-btn').addEventListener('click', startGame);
$('#resume-btn').addEventListener('click', () => game.resume());
$('#pause-btn').addEventListener('click', () => game.pause());
$('#restart-pause-btn').addEventListener('click', startGame);
$('#home-btn').addEventListener('click', () => game.showMenu());

let soundEnabled = true;
ui.soundBtn.addEventListener('click', () => {
  audio.init();
  soundEnabled = !soundEnabled;
  audio.setEnabled(soundEnabled);
  ui.soundBtn.classList.toggle('off', !soundEnabled);
  ui.soundBtn.textContent = soundEnabled ? '♪' : '×';
});

const setBoost = (active) => {
  audio.init();
  game.setBoost(active);
};
ui.boostBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  ui.boostBtn.setPointerCapture?.(event.pointerId);
  setBoost(true);
  vibrate(15);
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  ui.boostBtn.addEventListener(eventName, () => setBoost(false));
}

let joystickPointer = null;
let joystickOrigin = { x: 0, y: 0 };
const maxStick = 34;

function moveJoystick(event) {
  if (event.pointerId !== joystickPointer) return;
  const dx = event.clientX - joystickOrigin.x;
  const dy = event.clientY - joystickOrigin.y;
  const length = Math.hypot(dx, dy) || 1;
  const scale = Math.min(maxStick, length) / length;
  const x = dx * scale;
  const y = dy * scale;
  ui.joystickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  game.setMove(x / maxStick, -y / maxStick);
}

ui.joystickZone.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  audio.init();
  joystickPointer = event.pointerId;
  const rect = ui.joystickZone.getBoundingClientRect();
  joystickOrigin = { x: rect.left + 65, y: rect.bottom - 53 };
  ui.joystickZone.setPointerCapture?.(event.pointerId);
  moveJoystick(event);
});
ui.joystickZone.addEventListener('pointermove', moveJoystick);

function releaseJoystick(event) {
  if (event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  game.setMove(0, 0);
  ui.joystickThumb.style.transform = 'translate(-50%, -50%)';
}
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  ui.joystickZone.addEventListener(eventName, releaseJoystick);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'running') game.pause();
});

window.addEventListener('contextmenu', (event) => event.preventDefault());
