// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, level-up, paused, game over and
// dawn (win).
//
// ?seed=N fixes the falling pattern. ?shot=start|play|level|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_EMBER,
  EVENT_FLARE,
  EVENT_HIT,
  EVENT_KILL,
  EVENT_LEVEL,
  EVENT_OVER,
  EVENT_PULSE,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_BLESS_1,
  ACTION_BLESS_2,
  ACTION_BLESS_3,
  ACTION_CONFIRM,
  ACTION_FLARE,
  ACTION_MUTE,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_LEVEL,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let flareQueued = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive the night until dawn.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`Dawn breaks. You win with ${world.state.score} points. Best ${best}.`);
    } else {
      audio.lose();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_FLARE)) startGame();
      return;
    }
    if (screen === SCREEN_LEVEL) {
      const slot = actions & ACTION_BLESS_1 ? 0 : actions & ACTION_BLESS_2 ? 1 : actions & ACTION_BLESS_3 ? 2 : -1;
      if (slot >= 0) {
        world.applyBlessing(world.state.pendingBlessings[slot]);
        screen = SCREEN_PLAY;
        announce('Blessing chosen. Keep fighting.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_FLARE) flareQueued = true;
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, 0, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const vector = input.vector();
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y) || 1;
    const useFlare = flareQueued;
    flareQueued = false;
    const events = world.step(
      STEP,
      vector.x / length,
      vector.y / length,
      useFlare,
      false,
    );
    if (events & EVENT_PULSE) audio.pulse();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_EMBER) audio.ember();
    if (events & EVENT_FLARE) audio.flare();
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.player.hp === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.player.hp} hearts left.`);
    }
    if (events & EVENT_LEVEL) {
      audio.level();
      screen = SCREEN_LEVEL;
      announce(`Level ${world.state.level}. Choose a blessing.`);
    } else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_WIN) endGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting shadows close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberwarden. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
