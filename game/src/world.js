// The game's rules and state, with no drawing and no browser in it: the warden, the
// lantern's pulse, the shadow kinds, embers, experience, blessings, flares, particles and
// the night's timer. step() advances one fixed step and returns what happened as bit flags,
// so the caller can react without the world knowing about screens or sound. The pools are
// allocated once, at boot; step() allocates nothing but floater text.
import {
  BLESSINGS,
  BLESS_FLARE,
  BLESS_HEART,
  BLESS_HOT,
  BLESS_MAGNET,
  BLESS_QUICK,
  BLESS_SWIFT,
  BLESS_WIDE,
  ENEMY,
  FIELD,
  FLARE,
  GLOOM_PERIOD,
  KIND_BULWARK,
  KIND_DART,
  KIND_GLOOM,
  KIND_WISP,
  LANTERN,
  NIGHT_LENGTH,
  PLAYER,
  POOL_EMBER,
  POOL_ENEMY,
  POOL_FLOATER,
  POOL_PARTICLE,
  SPAWN,
  UNLOCK,
  xpForLevel,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_EMBER = 4;
export const EVENT_LEVEL = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_FLARE = 64;
export const EVENT_PULSE = 128;

const TAU = Math.PI * 2;

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    invulnerable: 0,
    speed: PLAYER.speed,
    magnet: 90,
    pulseRadius: LANTERN.radius,
    pulseDamage: LANTERN.damage,
    pulseInterval: LANTERN.interval,
    pulseTimer: 0.8,
    flareCharges: FLARE.maxCharges,
    flareMax: FLARE.maxCharges,
    flareTimer: 0,
  };
  const enemies = [];
  for (let index = 0; index < POOL_ENEMY; index += 1) {
    enemies.push({ active: false, kind: KIND_WISP, x: 0, y: 0, vx: 0, vy: 0, hp: 1, radius: 13, speed: 60, wobble: 0, phase: 0, state: 0, timer: 0, flash: 0 });
  }
  const embers = [];
  for (let index = 0; index < POOL_EMBER; index += 1) {
    embers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const particles = [];
  for (let index = 0; index < POOL_PARTICLE; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  }
  const floaters = [];
  for (let index = 0; index < POOL_FLOATER; index += 1) {
    floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff' });
  }
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({ x: 0, y: 0, r: 1, phase: 0 });
  }
  const blessingCounts = new Array(BLESSINGS.length).fill(0);
  const pendingBlessings = [0, 0, 0];

  const state = {
    player,
    enemies,
    embers,
    particles,
    floaters,
    stars,
    blessingCounts,
    pendingBlessings,
    hasPending: false,
    score: 0,
    best: 0,
    kills: 0,
    embersCollected: 0,
    elapsed: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    combo: 0,
    comboTimer: 0,
    spawnTimer: SPAWN.startInterval,
    gloomTimer: UNLOCK[KIND_GLOOM],
    pulseRing: 0,
    flareRing: 0,
    shake: 0,
    flashRed: 0,
    won: false,
    over: false,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.hp = PLAYER.maxHp;
    player.maxHp = PLAYER.maxHp;
    player.invulnerable = 0;
    player.speed = PLAYER.speed;
    player.magnet = 90;
    player.pulseRadius = LANTERN.radius;
    player.pulseDamage = LANTERN.damage;
    player.pulseInterval = LANTERN.interval;
    player.pulseTimer = 0.8;
    player.flareCharges = FLARE.maxCharges;
    player.flareMax = FLARE.maxCharges;
    player.flareTimer = 0;
    for (const enemy of enemies) enemy.active = false;
    for (const ember of embers) ember.active = false;
    for (const particle of particles) particle.active = false;
    for (const floater of floaters) floater.active = false;
    for (const star of stars) {
      star.x = random() * FIELD.width;
      star.y = random() * FIELD.height;
      star.r = 0.6 + random() * 1.4;
      star.phase = random() * TAU;
    }
    for (let index = 0; index < blessingCounts.length; index += 1) blessingCounts[index] = 0;
    state.hasPending = false;
    state.score = 0;
    state.kills = 0;
    state.embersCollected = 0;
    state.elapsed = 0;
    state.level = 1;
    state.xp = 0;
    state.xpNext = xpForLevel(1);
    state.combo = 0;
    state.comboTimer = 0;
    state.spawnTimer = SPAWN.startInterval;
    state.gloomTimer = UNLOCK[KIND_GLOOM];
    state.pulseRing = 0;
    state.flareRing = 0;
    state.shake = 0;
    state.flashRed = 0;
    state.won = false;
    state.over = false;
  }

  function freeEnemy() {
    for (let index = 0; index < enemies.length; index += 1) if (!enemies[index].active) return enemies[index];
    return null;
  }

  function freeEmber() {
    for (let index = 0; index < embers.length; index += 1) if (!embers[index].active) return embers[index];
    return null;
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) if (!particles[index].active) return particles[index];
    return null;
  }

  function freeFloater() {
    for (let index = 0; index < floaters.length; index += 1) if (!floaters[index].active) return floaters[index];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const particle = freeParticle();
      if (particle === null) return;
      const angle = random() * TAU;
      const velocity = speed * (0.3 + random() * 0.7);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.maxLife = 0.35 + random() * 0.4;
      particle.life = particle.maxLife;
      particle.size = 1.5 + random() * 2.5;
      particle.color = color;
    }
  }

  function floater(x, y, text, color) {
    const item = freeFloater();
    if (item === null) return;
    item.active = true;
    item.x = x;
    item.y = y;
    item.text = text;
    item.life = 0.9;
    item.color = color;
  }

  function multiplier() {
    return 1 + Math.min(state.combo, 20) * 0.1;
  }

  function killEnemy(enemy, events) {
    const def = ENEMY[enemy.kind];
    enemy.active = false;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 2.5;
    const gained = Math.round(def.score * multiplier());
    state.score += gained;
    floater(enemy.x, enemy.y - enemy.radius, `+${gained}`, '#fde68a');
    burst(enemy.x, enemy.y, def.color, enemy.kind === KIND_GLOOM ? 26 : 12, 180);
    burst(enemy.x, enemy.y, '#fb923c', 6, 120);
    for (let index = 0; index < def.embers; index += 1) {
      const ember = freeEmber();
      if (ember === null) break;
      ember.active = true;
      ember.x = enemy.x + (random() - 0.5) * 24;
      ember.y = enemy.y + (random() - 0.5) * 24;
      const angle = random() * TAU;
      ember.vx = Math.cos(angle) * 90;
      ember.vy = Math.sin(angle) * 90;
    }
    if (enemy.kind === KIND_BULWARK) {
      for (let index = 0; index < 2; index += 1) {
        const wisp = freeEnemy();
        if (wisp === null) break;
        spawnAt(wisp, KIND_WISP, enemy.x + (index === 0 ? -20 : 20), enemy.y);
      }
    }
    return events | EVENT_KILL;
  }

  function damageEnemy(enemy, amount, events) {
    enemy.hp -= amount;
    enemy.flash = 0.12;
    if (enemy.hp <= 0) return killEnemy(enemy, events);
    return events;
  }

  function spawnAt(enemy, kind, x, y) {
    const def = ENEMY[kind];
    enemy.active = true;
    enemy.kind = kind;
    enemy.x = x;
    enemy.y = y;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.hp = def.hp + (state.elapsed >= 105 && (kind === KIND_WISP || kind === KIND_DART) ? 1 : 0);
    enemy.radius = def.radius;
    enemy.speed = def.speed * (1 + Math.min(0.5, state.elapsed / NIGHT_LENGTH) * 0.6);
    enemy.wobble = random() * TAU;
    enemy.phase = random() * TAU;
    enemy.state = 0;
    enemy.timer = 1.5 + random() * 1.5;
    enemy.flash = 0;
  }

  function spawnEdge() {
    const enemy = freeEnemy();
    if (enemy === null) return;
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = random() * FIELD.width;
      y = -30;
    } else if (edge === 1) {
      x = FIELD.width + 30;
      y = random() * FIELD.height;
    } else if (edge === 2) {
      x = random() * FIELD.width;
      y = FIELD.height + 30;
    } else {
      x = -30;
      y = random() * FIELD.height;
    }
    const roll = random();
    let kind = KIND_WISP;
    if (state.elapsed >= UNLOCK[KIND_BULWARK] && roll < 0.14) kind = KIND_BULWARK;
    else if (state.elapsed >= UNLOCK[KIND_DART] && roll < 0.42) kind = KIND_DART;
    spawnAt(enemy, kind, x, y);
  }

  function aliveCount() {
    let count = 0;
    for (const enemy of enemies) if (enemy.active) count += 1;
    return count;
  }

  function rollBlessings() {
    const available = [];
    for (let index = 0; index < BLESSINGS.length; index += 1) {
      if (blessingCounts[index] < BLESSINGS[index].max) available.push(index);
    }
    for (let index = available.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      const held = available[index];
      available[index] = available[swap];
      available[swap] = held;
    }
    for (let slot = 0; slot < 3; slot += 1) {
      pendingBlessings[slot] = available.length > 0
        ? available[slot % available.length]
        : Math.floor(random() * BLESSINGS.length);
    }
    state.hasPending = true;
  }

  function applyBlessing(id) {
    blessingCounts[id] += 1;
    if (id === BLESS_WIDE) player.pulseRadius += 28;
    else if (id === BLESS_HOT) player.pulseDamage += 1;
    else if (id === BLESS_QUICK) player.pulseInterval = Math.max(LANTERN.minInterval, player.pulseInterval - 0.18);
    else if (id === BLESS_SWIFT) player.speed += 40;
    else if (id === BLESS_MAGNET) player.magnet += 55;
    else if (id === BLESS_HEART) {
      player.maxHp += 1;
      player.hp = Math.min(player.maxHp, player.hp + 1);
    } else if (id === BLESS_FLARE) {
      player.flareMax += 1;
      player.flareCharges = Math.min(player.flareMax, player.flareCharges + 1);
    }
    state.hasPending = false;
  }

  /**
   * One fixed step. `dirX`/`dirY` steer the warden (normalised). `useFlare` spends a flare
   * charge. With `harmless` set (the title screen's backdrop) wisps drift in but nothing
   * touches the warden and nothing scores.
   */
  function step(dt, dirX, dirY, useFlare, harmless) {
    let events = 0;
    state.elapsed += dt;

    if (!harmless && state.elapsed >= NIGHT_LENGTH) {
      state.won = true;
      state.score += 500;
      return EVENT_WIN;
    }

    const speed = player.speed * dt;
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + dirX * speed));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + dirY * speed));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.pulseRing > 0) state.pulseRing = Math.min(1, state.pulseRing + dt / 0.4);
    if (state.flareRing > 0) state.flareRing = Math.min(1, state.flareRing + dt / 0.5);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flashRed > 0) state.flashRed = Math.max(0, state.flashRed - dt * 2.5);

    // The lantern's pulse.
    player.pulseTimer -= dt;
    if (player.pulseTimer <= 0 && !harmless) {
      player.pulseTimer += player.pulseInterval;
      state.pulseRing = 0.0001;
      events |= EVENT_PULSE;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        if (distanceSquared(enemy.x, enemy.y, player.x, player.y) <= (player.pulseRadius + enemy.radius) ** 2) {
          events = damageEnemy(enemy, player.pulseDamage, events);
        }
      }
    }

    // Flare.
    if (useFlare && !harmless && player.flareCharges > 0) {
      player.flareCharges -= 1;
      player.flareTimer = 0;
      state.flareRing = 0.0001;
      events |= EVENT_FLARE;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        if (distanceSquared(enemy.x, enemy.y, player.x, player.y) <= (FLARE.radius + enemy.radius) ** 2) {
          events = damageEnemy(enemy, FLARE.damage, events);
        }
      }
    }
    if (player.flareCharges < player.flareMax) {
      player.flareTimer += dt;
      if (player.flareTimer >= FLARE.recharge) {
        player.flareCharges += 1;
        player.flareTimer = 0;
      }
    }

    // Spawning.
    if (!harmless) {
      const progress = Math.min(1, state.elapsed / NIGHT_LENGTH);
      const interval = SPAWN.startInterval + (SPAWN.endInterval - SPAWN.startInterval) * progress;
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (aliveCount() < SPAWN.maxAlive) spawnEdge();
        state.spawnTimer += interval;
      }
      state.gloomTimer -= dt;
      if (state.gloomTimer <= 0) {
        const gloom = freeEnemy();
        if (gloom !== null) {
          spawnAt(gloom, KIND_GLOOM, random() * FIELD.width, -40);
          state.gloomTimer += GLOOM_PERIOD;
        }
      }
    } else {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (aliveCount() < 12) spawnEdge();
        state.spawnTimer += 1.4;
      }
    }

    // Enemies.
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      enemy.phase += dt;
      if (enemy.kind === KIND_WISP) {
        const wobble = Math.sin(enemy.phase * 2.2) * 0.6;
        enemy.x += (nx * enemy.speed + -ny * wobble * enemy.speed * 0.5) * dt;
        enemy.y += (ny * enemy.speed + nx * wobble * enemy.speed * 0.5) * dt;
      } else if (enemy.kind === KIND_DART) {
        enemy.timer -= dt;
        if (enemy.state === 0) {
          enemy.x += nx * enemy.speed * 0.5 * dt;
          enemy.y += ny * enemy.speed * 0.5 * dt;
          if (enemy.timer <= 0) {
            enemy.state = 1;
            enemy.timer = 0.5;
          }
        } else if (enemy.state === 1) {
          if (enemy.timer <= 0) {
            enemy.state = 2;
            enemy.timer = 0.45;
            enemy.vx = nx * 430;
            enemy.vy = ny * 430;
          }
        } else {
          enemy.x += enemy.vx * dt;
          enemy.y += enemy.vy * dt;
          if (enemy.timer <= 0) {
            enemy.state = 0;
            enemy.timer = 1.5 + random() * 1.5;
          }
        }
      } else {
        enemy.x += nx * enemy.speed * dt;
        enemy.y += ny * enemy.speed * dt;
      }
      if (harmless) continue;
      const touch = enemy.radius + player.radius - 2;
      if (distanceSquared(enemy.x, enemy.y, player.x, player.y) <= touch * touch) {
        if (player.invulnerable === 0) {
          player.hp -= 1;
          player.invulnerable = PLAYER.invulnerable;
          state.shake = 1;
          state.flashRed = 1;
          state.combo = 0;
          state.comboTimer = 0;
          burst(player.x, player.y, '#f43f5e', 14, 200);
          events |= EVENT_HIT;
          events = damageEnemy(enemy, 1, events);
          if (player.hp <= 0) {
            state.over = true;
            return events | EVENT_OVER;
          }
        } else if (enemy.kind !== KIND_WISP) {
          // Brushed while invulnerable: shove the heavy ones away instead of a second hit.
          enemy.x -= nx * 30;
          enemy.y -= ny * 30;
        }
      }
    }

    // Embers.
    for (const ember of embers) {
      if (!ember.active) continue;
      const dx = player.x - ember.x;
      const dy = player.y - ember.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (!harmless && dist < player.magnet) {
        ember.vx += (dx / dist) * 900 * dt;
        ember.vy += (dy / dist) * 900 * dt;
      } else {
        ember.vx *= 1 - 2.4 * dt;
        ember.vy *= 1 - 2.4 * dt;
      }
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      if (!harmless && dist < player.radius + 12) {
        ember.active = false;
        state.embersCollected += 1;
        const gained = Math.round(5 * multiplier());
        state.score += gained;
        state.xp += 1;
        events |= EVENT_EMBER;
        const spark = freeParticle();
        if (spark !== null) {
          spark.active = true;
          spark.x = ember.x;
          spark.y = ember.y;
          spark.vx = 0;
          spark.vy = -40;
          spark.maxLife = 0.3;
          spark.life = 0.3;
          spark.size = 3;
          spark.color = '#fbbf24';
        }
        if (state.xp >= state.xpNext) {
          state.level += 1;
          state.xp -= state.xpNext;
          state.xpNext = xpForLevel(state.level);
          rollBlessings();
          return events | EVENT_LEVEL;
        }
      }
    }

    // Particles and floaters.
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 2 * dt;
      particle.vy *= 1 - 2 * dt;
    }
    for (const floater of floaters) {
      if (!floater.active) continue;
      floater.life -= dt;
      if (floater.life <= 0) floater.active = false;
      else floater.y -= 34 * dt;
    }
    return events;
  }

  reset();
  return { state, reset, step, applyBlessing };
}
