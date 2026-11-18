// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (start,
// restart, pause, flare, blessing choice, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.
// A click during play is a flare; a click on a blessing card (left, middle or right third
// of the screen) chooses it; a click elsewhere is a confirm.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_FLARE = 4;
export const ACTION_BLESS_1 = 8;
export const ACTION_BLESS_2 = 16;
export const ACTION_BLESS_3 = 32;
export const ACTION_MUTE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const FLARE_KEYS = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const BLESS = new Map([['Digit1', ACTION_BLESS_1], ['Digit2', ACTION_BLESS_2], ['Digit3', ACTION_BLESS_3]]);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (FLARE_KEYS.has(event.code)) {
      if (!event.repeat) actions |= ACTION_FLARE;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (BLESS.has(event.code)) {
      if (!event.repeat) actions |= BLESS.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (x < 1 / 3) actions |= ACTION_BLESS_1;
    else if (x < 2 / 3) actions |= ACTION_BLESS_2;
    else actions |= ACTION_BLESS_3;
    actions |= ACTION_FLARE;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Steering vector, each component -1, 0 or 1 (normalised by the caller). */
    vector() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
