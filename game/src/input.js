// Pointer + keyboard state, polled by the main loop. Clicks are queued as
// discrete events (with canvas coordinates) so UI hit-testing lives in one
// place in main.js; keys are exposed both as held-state and an event queue.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0, inside: false };
    this.clicks = [];
    this.keys = new Set();
    this.keyEvents = [];

    const toGame = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    };
    canvas.addEventListener('mousemove', (e) => {
      const p = toGame(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inside = true;
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouse.inside = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = toGame(e);
      this.clicks.push({ x: p.x, y: p.y, button: e.button });
    });
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.keyEvents.push(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  takeClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  takeKeys() {
    const out = this.keyEvents;
    this.keyEvents = [];
    return out;
  }
}
