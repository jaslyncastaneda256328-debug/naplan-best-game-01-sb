// The screenshot scenes behind ?shot=start|play|level|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase the nearest ember when it is safe, keep clear of the nearest shadows, flare when
// surrounded), so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_LEVEL, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 45;
const LEVEL_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Steer toward the nearest ember, away from near shadows; flare when surrounded. */
function autopilot(state, options) {
  const player = state.player;
  let moveX = 0;
  let moveY = 0;
  if (options.seekEmbers) {
    let ember = null;
    let emberDist = Infinity;
    for (const item of state.embers) {
      if (!item.active) continue;
      const dx = item.x - player.x;
      const dy = item.y - player.y;
      const dist = dx * dx + dy * dy;
      if (dist < emberDist) {
        emberDist = dist;
        ember = item;
      }
    }
    if (ember !== null && emberDist < 320 * 320) {
      moveX += (ember.x - player.x) / Math.sqrt(emberDist);
      moveY += (ember.y - player.y) / Math.sqrt(emberDist);
    }
  }
  let near = 0;
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dist < options.fleeRadius) {
      const weight = (options.fleeRadius - dist) / options.fleeRadius;
      moveX += (dx / dist) * weight * 2.2;
      moveY += (dy / dist) * weight * 2.2;
      if (dist < 210) near += 1;
    }
  }
  // Drift back toward the middle when nothing pulls either way, and keep off the edges
  // so the warden stays on screen (the screenshots read best with the action central).
  // The end scene's autopilot opts out of the centring: it is meant to lose.
  if (options.center !== false) {
    if (moveX === 0 && moveY === 0) {
      moveX = (FIELD.width / 2 - player.x) / 400;
      moveY = (FIELD.height / 2 - player.y) / 400;
    }
    moveX += (FIELD.width / 2 - player.x) / 1600;
    moveY += (FIELD.height / 2 - player.y) / 1600;
    const edge = 200;
    if (player.x < edge) moveX += (edge - player.x) / edge * 2.5;
    if (player.x > FIELD.width - edge) moveX -= (player.x - (FIELD.width - edge)) / edge * 2.5;
    if (player.y < edge) moveY += (edge - player.y) / edge * 2.5;
    if (player.y > FIELD.height - edge) moveY -= (player.y - (FIELD.height - edge)) / edge * 2.5;
  }
  const length = Math.sqrt(moveX * moveX + moveY * moveY) || 1;
  const flare = options.useFlare && near >= 4 && player.flareCharges > 0;
  return { x: moveX / length, y: moveY / length, flare };
}

/**
 * Set `world` to the named scene (start, play, level or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'level' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'level') {
    for (let index = 0; index < LEVEL_LIMIT_SECONDS / STEP; index += 1) {
      const pilot = autopilot(world.state, { seekEmbers: true, fleeRadius: 150, useFlare: true });
      const events = world.step(STEP, pilot.x, pilot.y, pilot.flare, false);
      if (events & EVENT_LEVEL) return { screen: SCREEN_LEVEL, best: world.state.score };
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const pilot = autopilot(world.state, { seekEmbers: false, fleeRadius: 40, useFlare: false, center: false });
      const events = world.step(STEP, pilot.x, pilot.y, false, false);
      if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
      if (events & EVENT_WIN) break;
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
  }
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    const pilot = autopilot(world.state, { seekEmbers: true, fleeRadius: 150, useFlare: true });
    const events = world.step(STEP, pilot.x, pilot.y, pilot.flare, false);
    if (events & EVENT_LEVEL) world.applyBlessing(world.state.pendingBlessings[0]);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  // Step on until a lantern pulse is visibly expanding, so the play frame shows the ring.
  for (let index = 0; index < 2 / STEP; index += 1) {
    if (world.state.pulseRing > 0.08 && world.state.pulseRing < 0.65) break;
    const pilot = autopilot(world.state, { seekEmbers: true, fleeRadius: 150, useFlare: false });
    world.step(STEP, pilot.x, pilot.y, false, false);
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
