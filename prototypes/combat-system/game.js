const targetArea = document.getElementById('target-area');
const target = document.getElementById('target');
const crosshair = document.getElementById('crosshair');
const ring = document.querySelector('.reload-ring');
const ringCircle = document.querySelector('.reload-ring .ring');
const hpFill = document.getElementById('hp-fill');
const magFill = document.getElementById('mag-fill');
const hpText = document.getElementById('hp-text');
const magText = document.getElementById('mag-text');
const targetMessage = document.getElementById('target-message');
const timeToKillText = document.getElementById('time-to-kill');
const dpsValueText = document.getElementById('dps-value');
const ttkResetButton = document.getElementById('ttk-reset');
const dpsResetButton = document.getElementById('dps-reset');

const inputs = {
  hitDamage: document.getElementById('hit-damage'),
  damageVariance: document.getElementById('damage-variance'),
  magSize: document.getElementById('mag-size'),
  reloadSpeed: document.getElementById('reload-speed'),
  holdFire: document.getElementById('hold-fire'),
  fireRate: document.getElementById('fire-rate'),
  horizontalSpread: document.getElementById('horizontal-spread'),
  verticalSpread: document.getElementById('vertical-spread'),
  spreadRecovery: document.getElementById('spread-recovery'),
  targetHealth: document.getElementById('target-health'),
};

const state = {
  currentHP: Number(inputs.targetHealth.value),
  maxHP: Number(inputs.targetHealth.value),
  ammo: Number(inputs.magSize.value),
  magSize: Number(inputs.magSize.value),
  lastShotTime: 0,
  isFiring: false,
  isReloading: false,
  reloadStart: 0,
  shotsInBurst: 0,
  lastBurstTime: 0,
  crosshairPos: { x: 0, y: 0 },
  firstShotTime: null,
  lastKillTime: null,
  damageLog: [],
};

const ringCircumference = 2 * Math.PI * 52;
ringCircle.style.strokeDasharray = `${ringCircumference}`;
ringCircle.style.strokeDashoffset = `${ringCircumference}`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateBars = () => {
  const hpPercent = (state.currentHP / state.maxHP) * 100;
  hpFill.style.width = `${hpPercent}%`;
  hpText.textContent = `${state.currentHP} / ${state.maxHP}`;

  const magPercent = (state.ammo / state.magSize) * 100;
  magFill.style.width = `${magPercent}%`;
  magText.textContent = `${state.ammo} / ${state.magSize}`;
};

const updateTimeToKill = () => {
  if (state.lastKillTime === null) {
    timeToKillText.textContent = '--';
    return;
  }
  timeToKillText.textContent = `${state.lastKillTime.toFixed(2)}s`;
};

const updateDamagePerSecond = (now) => {
  const cutoff = now - 60000;
  state.damageLog = state.damageLog.filter((entry) => entry.time >= cutoff);
  const totalDamage = state.damageLog.reduce((sum, entry) => sum + entry.damage, 0);
  const dps = totalDamage / 60;
  dpsValueText.textContent = dps.toFixed(1);
};

const resetTimeToKill = () => {
  state.firstShotTime = null;
  state.lastKillTime = null;
  updateTimeToKill();
};

const resetDamagePerSecond = () => {
  state.damageLog = [];
  updateDamagePerSecond(performance.now());
};

const showTargetDown = () => {
  targetMessage.classList.add('show');
  setTimeout(() => targetMessage.classList.remove('show'), 700);
};

const applyDamage = (now) => {
  const baseDamage = Number(inputs.hitDamage.value);
  const variance = Number(inputs.damageVariance.value);
  const offset = variance > 0 ? Math.floor(Math.random() * (variance * 2 + 1)) - variance : 0;
  const damage = Math.max(0, baseDamage + offset);

  if (state.firstShotTime === null) {
    state.firstShotTime = now;
  }

  state.damageLog.push({ time: now, damage });
  state.currentHP = clamp(state.currentHP - damage, 0, state.maxHP);
  if (state.currentHP === 0) {
    state.lastKillTime = (now - state.firstShotTime) / 1000;
    state.firstShotTime = null;
    showTargetDown();
    state.currentHP = state.maxHP;
  }
  updateBars();
  updateTimeToKill();
  updateDamagePerSecond(now);
};

const startReload = () => {
  if (state.isReloading) {
    return;
  }
  state.isReloading = true;
  state.reloadStart = performance.now();
  ring.classList.add('active');
};

const finishReload = () => {
  state.isReloading = false;
  state.ammo = state.magSize;
  ring.classList.remove('active');
  ringCircle.style.strokeDashoffset = `${ringCircumference}`;
  updateBars();
};

const updateReloadRing = (now) => {
  if (!state.isReloading) {
    return;
  }
  const reloadDuration = Math.max(0.05, Number(inputs.reloadSpeed.value)) * 1000;
  const elapsed = now - state.reloadStart;
  const progress = clamp(elapsed / reloadDuration, 0, 1);
  ringCircle.style.strokeDashoffset = `${ringCircumference * (1 - progress)}`;
  if (progress >= 1) {
    finishReload();
  }
};

const spawnBulletHole = (x, y) => {
  const hole = document.createElement('div');
  hole.className = 'bullet-hole';
  hole.style.left = `${x}px`;
  hole.style.top = `${y}px`;
  targetArea.appendChild(hole);
  setTimeout(() => hole.remove(), 3200);
};

const getSpreadOffset = (now) => {
  const recoveryMs = Math.max(0, Number(inputs.spreadRecovery.value)) * 1000;
  if (now - state.lastBurstTime > recoveryMs) {
    state.shotsInBurst = 0;
  }

  if (state.shotsInBurst === 0) {
    return { x: 0, y: 0 };
  }

  const horizontalSpread = Number(inputs.horizontalSpread.value);
  const verticalSpread = Number(inputs.verticalSpread.value);
  const offsetX = (Math.random() * 2 - 1) * horizontalSpread;
  const offsetY = (Math.random() * 2 - 1) * verticalSpread;
  return { x: offsetX, y: offsetY };
};

const attemptShot = (now) => {
  const fireRateMs = Math.max(0.01, Number(inputs.fireRate.value)) * 1000;
  if (now - state.lastShotTime < fireRateMs) {
    return;
  }

  if (state.isReloading) {
    return;
  }

  if (state.ammo <= 0) {
    startReload();
    return;
  }

  const offset = getSpreadOffset(now);
  const shotX = state.crosshairPos.x + offset.x;
  const shotY = state.crosshairPos.y + offset.y;
  spawnBulletHole(shotX, shotY);

  const targetRect = target.getBoundingClientRect();
  const areaRect = targetArea.getBoundingClientRect();
  const absoluteX = areaRect.left + shotX;
  const absoluteY = areaRect.top + shotY;

  if (
    absoluteX >= targetRect.left &&
    absoluteX <= targetRect.right &&
    absoluteY >= targetRect.top &&
    absoluteY <= targetRect.bottom
  ) {
    applyDamage(now);
  }

  state.ammo = clamp(state.ammo - 1, 0, state.magSize);
  state.lastShotTime = now;
  state.lastBurstTime = now;
  state.shotsInBurst += 1;

  if (state.ammo === 0) {
    startReload();
  }

  updateBars();
};

const setCrosshairPosition = (event) => {
  const rect = targetArea.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  state.crosshairPos = {
    x: clamp(x, 0, rect.width),
    y: clamp(y, 0, rect.height),
  };
  crosshair.style.left = `${state.crosshairPos.x}px`;
  crosshair.style.top = `${state.crosshairPos.y}px`;
};

const handlePointerDown = (event) => {
  if (event.button !== 0) {
    return;
  }
  if (inputs.holdFire.checked) {
    state.isFiring = true;
  }
  attemptShot(performance.now());
};

const handlePointerUp = () => {
  state.isFiring = false;
};

const handlePointerLeave = () => {
  crosshair.classList.remove('visible');
  state.isFiring = false;
};

const handlePointerEnter = () => {
  crosshair.classList.add('visible');
};

const bindInput = (input, callback) => {
  input.addEventListener('input', () => {
    callback();
    updateBars();
  });
};

bindInput(inputs.magSize, () => {
  state.magSize = Math.max(1, Number(inputs.magSize.value));
  state.ammo = clamp(state.ammo, 0, state.magSize);
});

bindInput(inputs.targetHealth, () => {
  state.maxHP = Math.max(1, Number(inputs.targetHealth.value));
  state.currentHP = state.maxHP;
  resetTimeToKill();
});

inputs.holdFire.addEventListener('change', () => {
  state.isFiring = false;
});

updateBars();
resetTimeToKill();
resetDamagePerSecond();

const loop = (now) => {
  if (state.isFiring && inputs.holdFire.checked) {
    attemptShot(now);
  }

  if (!inputs.holdFire.checked && state.isFiring) {
    state.isFiring = false;
  }

  updateReloadRing(now);
  updateDamagePerSecond(now);
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);

['input', 'change'].forEach((eventType) => {
  inputs.hitDamage.addEventListener(eventType, updateBars);
  inputs.damageVariance.addEventListener(eventType, updateBars);
  inputs.reloadSpeed.addEventListener(eventType, updateBars);
  inputs.fireRate.addEventListener(eventType, updateBars);
  inputs.horizontalSpread.addEventListener(eventType, updateBars);
  inputs.verticalSpread.addEventListener(eventType, updateBars);
  inputs.spreadRecovery.addEventListener(eventType, updateBars);
});

targetArea.addEventListener('mousemove', setCrosshairPosition);

targetArea.addEventListener('pointerdown', (event) => {
  setCrosshairPosition(event);
  handlePointerDown(event);
});

targetArea.addEventListener('pointerup', handlePointerUp);

targetArea.addEventListener('pointerleave', handlePointerLeave);

targetArea.addEventListener('pointerenter', handlePointerEnter);

document.addEventListener('pointerup', handlePointerUp);

ttkResetButton.addEventListener('click', resetTimeToKill);
dpsResetButton.addEventListener('click', resetDamagePerSecond);
