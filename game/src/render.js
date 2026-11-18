// Everything drawn: the night field, the lantern's glow, the shadow kinds, embers and
// particles, the HUD, and the title, level-up, pause, game-over and dawn screens.
// The canvas is a fixed 1280x720 logical area scaled to the window by CSS.

import {
  BLESSINGS,
  ENEMY,
  FIELD,
  FLARE,
  FONT,
  KIND_BULWARK,
  KIND_DART,
  KIND_GLOOM,
  KIND_WISP,
  NIGHT_LENGTH,
  PALETTE,
} from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_LEVEL = 2;
export const SCREEN_PAUSED = 3;
export const SCREEN_OVER = 4;
export const SCREEN_WIN = 5;

const TAU = Math.PI * 2;

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function drawHeart(x, y, size, filled) {
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.9);
    ctx.bezierCurveTo(x - size * 1.2, y + size * 0.1, x - size * 0.6, y - size * 0.9, x, y - size * 0.2);
    ctx.bezierCurveTo(x + size * 0.6, y - size * 0.9, x + size * 1.2, y + size * 0.1, x, y + size * 0.9);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = PALETTE.hp;
      ctx.fill();
    } else {
      ctx.strokeStyle = '#5b6478';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawBackground(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.backdropTop);
    gradient.addColorStop(1, PALETTE.backdropBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of state.stars) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.elapsed * 1.5 + star.phase));
      ctx.globalAlpha = twinkle * 0.8;
      ctx.fillStyle = '#dbe4ff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Low mist drifting across the field.
    ctx.fillStyle = PALETTE.groundMist;
    ctx.globalAlpha = 0.16;
    for (let index = 0; index < 3; index += 1) {
      const x = ((state.elapsed * 12 + index * 480) % (FIELD.width + 360)) - 180;
      ctx.beginPath();
      ctx.ellipse(x, 560 + index * 56, 260, 34, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGlow(state) {
    const player = state.player;
    const glow = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, player.pulseRadius * 1.7);
    glow.addColorStop(0, 'rgba(253, 230, 138, 0.20)');
    glow.addColorStop(0.5, 'rgba(251, 191, 36, 0.08)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(player.x - player.pulseRadius * 1.8, player.y - player.pulseRadius * 1.8, player.pulseRadius * 3.6, player.pulseRadius * 3.6);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawEmbers(state) {
    ctx.globalCompositeOperation = 'lighter';
    for (const ember of state.embers) {
      if (!ember.active) continue;
      const flicker = 0.7 + 0.3 * Math.sin(state.elapsed * 6 + ember.x);
      ctx.globalAlpha = flicker;
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, 5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = flicker * 0.35;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, 10, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawEnemy(enemy, elapsed) {
    const def = ENEMY[enemy.kind];
    const bob = Math.sin(elapsed * 3 + enemy.phase) * 3;
    const y = enemy.y + bob;
    if (enemy.kind === KIND_WISP) {
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : def.color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(enemy.x, y, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(enemy.x, y, enemy.radius + 6, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1b1030';
      ctx.beginPath();
      ctx.arc(enemy.x - 4, y - 2, 2.4, 0, TAU);
      ctx.arc(enemy.x + 4, y - 2, 2.4, 0, TAU);
      ctx.fill();
    } else if (enemy.kind === KIND_DART) {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      ctx.save();
      ctx.translate(enemy.x, y);
      ctx.rotate(enemy.state === 1 && enemy.timer > 0 ? angle : Math.atan2(0, 1) + Math.sin(elapsed * 2 + enemy.phase) * 0.3);
      ctx.fillStyle = enemy.flash > 0 || enemy.state === 1 ? '#ffffff' : def.color;
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 6, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius * 0.4, 0);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (enemy.state === 1) {
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, y, enemy.radius + 10 + Math.sin(elapsed * 20) * 3, 0, TAU);
        ctx.stroke();
      }
    } else if (enemy.kind === KIND_BULWARK) {
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : def.color;
      ctx.beginPath();
      for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * TAU + elapsed * 0.4;
        const px = enemy.x + Math.cos(angle) * enemy.radius;
        const py = y + Math.sin(angle) * enemy.radius;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a0a2e';
      ctx.beginPath();
      ctx.arc(enemy.x, y, enemy.radius * 0.45, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f0abfc';
      ctx.font = `bold ${Math.round(enemy.radius * 0.8)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(enemy.hp), enemy.x, y + 1);
    } else if (enemy.kind === KIND_GLOOM) {
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#3f0d2b';
      ctx.beginPath();
      ctx.arc(enemy.x, y, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(enemy.x, y, enemy.radius * 0.4 + Math.sin(elapsed * 5) * 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff1f2';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`HP ${enemy.hp}`, enemy.x, y - enemy.radius - 12);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(state.elapsed * 14) % 2 === 0) return;
    // Cloak.
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 18);
    ctx.lineTo(player.x - 14, player.y + 14);
    ctx.lineTo(player.x + 14, player.y + 14);
    ctx.closePath();
    ctx.fill();
    // Hood.
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 8, 9, 0, TAU);
    ctx.fill();
    // The lantern, swinging ahead of the warden.
    const swing = Math.sin(state.elapsed * 2.4) * 3;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x + 10, player.y - 4);
    ctx.lineTo(player.x + 18 + swing, player.y + 6);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(253, 230, 138, 0.5)';
    ctx.beginPath();
    ctx.arc(player.x + 18 + swing, player.y + 8, 10, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PALETTE.lanternGlow;
    ctx.beginPath();
    ctx.arc(player.x + 18 + swing, player.y + 8, 5, 0, TAU);
    ctx.fill();
  }

  function drawRings(state) {
    const player = state.player;
    if (state.pulseRing > 0) {
      const radius = player.pulseRadius * state.pulseRing;
      ctx.strokeStyle = `rgba(253, 230, 138, ${0.85 * (1 - state.pulseRing)})`;
      ctx.lineWidth = 5 * (1 - state.pulseRing) + 1;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, TAU);
      ctx.stroke();
    }
    if (state.flareRing > 0) {
      const radius = FLARE.radius * state.flareRing;
      ctx.strokeStyle = `rgba(251, 146, 60, ${0.9 * (1 - state.flareRing)})`;
      ctx.lineWidth = 8 * (1 - state.flareRing) + 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(251, 146, 60, ${0.25 * (1 - state.flareRing)})`;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, TAU);
      ctx.fill();
    }
  }

  function drawParticles(state) {
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of state.particles) {
      if (!particle.active) continue;
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFloaters(state) {
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const floater of state.floaters) {
      if (!floater.active) continue;
      ctx.globalAlpha = Math.min(1, floater.life / 0.5);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const player = state.player;
    // Hearts.
    for (let index = 0; index < player.maxHp; index += 1) {
      drawHeart(36 + index * 34, 36, 11, index < player.hp);
    }
    // Night timer, centred.
    const remaining = Math.max(0, NIGHT_LENGTH - state.elapsed);
    const progress = Math.min(1, state.elapsed / NIGHT_LENGTH);
    ctx.fillStyle = 'rgba(10, 12, 24, 0.65)';
    ctx.fillRect(460, 18, 360, 34);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(460, 18, 360, 34);
    const barGradient = ctx.createLinearGradient(460, 0, 820, 0);
    barGradient.addColorStop(0, '#818cf8');
    barGradient.addColorStop(1, '#fbbf24');
    ctx.fillStyle = barGradient;
    ctx.fillRect(464, 22, 352 * progress, 26);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`NIGHT  ${formatTime(remaining)}`, 640, 36);
    // Score block, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillText(String(state.score), 1252, 34);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${best}   •   ${state.kills} BANISHED`, 1252, 60);
    if (state.combo >= 3) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px ' + FONT;
      ctx.fillText(`COMBO x${(1 + Math.min(state.combo, 20) * 0.1).toFixed(1)}  (${state.combo})`, 1252, 86);
    }
    // XP bar, bottom.
    const xpProgress = Math.min(1, state.xp / state.xpNext);
    ctx.fillStyle = 'rgba(10, 12, 24, 0.65)';
    ctx.fillRect(24, 686, 1232, 12);
    ctx.fillStyle = PALETTE.xp;
    ctx.fillRect(24, 686, 1232 * xpProgress, 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(`LV ${state.level}`, 24, 676);
    // Flare charges, bottom left above the XP bar.
    ctx.textAlign = 'left';
    for (let index = 0; index < player.flareMax; index += 1) {
      ctx.fillStyle = index < player.flareCharges ? '#fb923c' : '#3b4a6b';
      ctx.beginPath();
      ctx.arc(34 + index * 26, 656, 8, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('FLARE — SPACE / CLICK', 34 + player.flareMax * 26 + 10, 660);
    ctx.textAlign = 'right';
    ctx.fillText('P PAUSE   •   M SOUND', 1252, 660);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(5, 7, 16, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillText('EMBERWARDEN', 640, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `26px ${FONT}`;
    ctx.fillText('Keeper of the Last Lantern', 640, 296);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText('Shadows drift in from the dark. Your lantern burns them.', 640, 344);
    ctx.fillText('Gather their embers, grow stronger, and hold the light until dawn.', 640, 372);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    ctx.fillText('MOVE  WASD / ARROWS      FLARE  SPACE / CLICK      PAUSE  P', 640, 440);
    ctx.fillText('Level up to choose blessings  •  Survive 2:30 to win', 640, 470);
    if (best > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px ' + FONT;
      ctx.fillText(`BEST  ${best}`, 640, 512);
    }
    const pulse = 0.65 + 0.35 * Math.sin(state.elapsed * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('PRESS SPACE OR CLICK TO BEGIN', 640, 580);
    ctx.globalAlpha = 1;
  }

  function drawLevel(state) {
    ctx.fillStyle = 'rgba(5, 7, 16, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 44px ' + FONT;
    ctx.fillText(`LEVEL ${state.level} — CHOOSE A BLESSING`, 640, 150);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `17px ${FONT}`;
    ctx.fillText('Press 1, 2 or 3 — or click a card', 640, 186);
    const cardWidth = 300;
    const cardHeight = 200;
    const gap = 28;
    const total = cardWidth * 3 + gap * 2;
    const startX = (FIELD.width - total) / 2;
    const y = 250;
    for (let slot = 0; slot < 3; slot += 1) {
      const blessing = BLESSINGS[state.pendingBlessings[slot]];
      const x = startX + slot * (cardWidth + gap);
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(x, y, cardWidth, cardHeight);
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cardWidth, cardHeight);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(`PRESS ${slot + 1}`, x + cardWidth / 2, y + 34);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 24px ' + FONT;
      ctx.fillText(blessing.name, x + cardWidth / 2, y + 82);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `17px ${FONT}`;
      ctx.fillText(blessing.desc, x + cardWidth / 2, y + 118);
      const owned = state.blessingCounts[blessing.id];
      ctx.fillStyle = '#fbbf24';
      ctx.font = `14px ${FONT}`;
      ctx.fillText('●'.repeat(owned) + '○'.repeat(Math.max(0, blessing.max - owned)), x + cardWidth / 2, y + 158);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 7, 16, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 52px ' + FONT;
    ctx.fillText('PAUSED', 640, 340);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('Press P to resume', 640, 386);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(10, 4, 10, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 56px ' + FONT;
    ctx.fillText('THE LIGHT GOES OUT', 640, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `22px ${FONT}`;
    ctx.fillText(`The night lasted ${formatTime(state.elapsed)} — the shadows close in.`, 640, 292);
    ctx.font = 'bold 40px ' + FONT;
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`SCORE  ${state.score}`, 640, 360);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(`${state.kills} banished  •  ${state.embersCollected} embers  •  reached level ${state.level}`, 640, 404);
    ctx.fillText(`BEST  ${best}`, 640, 434);
    const pulse = 0.65 + 0.35 * Math.sin(state.elapsed * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('PRESS SPACE OR CLICK TO TRY AGAIN', 640, 500);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, best) {
    const dawn = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    dawn.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
    dawn.addColorStop(1, 'rgba(5, 7, 16, 0.55)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('DAWN BREAKS', 640, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `22px ${FONT}`;
    ctx.fillText('You kept the lantern lit all night. The field is yours.', 640, 292);
    ctx.font = 'bold 40px ' + FONT;
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`SCORE  ${state.score}`, 640, 360);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(`${state.kills} banished  •  ${state.embersCollected} embers  •  level ${state.level}`, 640, 404);
    ctx.fillText(`BEST  ${best}`, 640, 434);
    const pulse = 0.65 + 0.35 * Math.sin(state.elapsed * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', 640, 500);
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, best) {
    ctx.save();
    if (state.shake > 0) {
      const magnitude = state.shake * 7;
      ctx.translate(Math.sin(state.elapsed * 97) * magnitude, Math.cos(state.elapsed * 89) * magnitude);
    }
    drawBackground(state);
    drawGlow(state);
    drawEmbers(state);
    for (const enemy of state.enemies) {
      if (enemy.active) drawEnemy(enemy, state.elapsed);
    }
    if (screen !== SCREEN_TITLE) drawPlayer(state);
    else {
      // On the title screen the warden stands lit at the centre of the field.
      drawPlayer(state);
    }
    drawRings(state);
    drawParticles(state);
    drawFloaters(state);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_LEVEL || screen === SCREEN_PAUSED) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_LEVEL) drawLevel(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
    if (state.flashRed > 0) {
      ctx.fillStyle = `rgba(244, 63, 94, ${state.flashRed * 0.22})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw };
}
