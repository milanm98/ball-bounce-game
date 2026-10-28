import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import * as game from '../lib/game.ts';
import * as canvasText from '../lib/canvas-text.ts';
import * as meetings from '../lib/meetings.ts';

// Load the actual TSX component without running a Next server or a browser.
const require = createRequire(import.meta.url);
const componentCode = ts.transpileModule(readFileSync(new URL('../components/GamePage.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText;
function loadGame(engine) {
  const compiledModule = { exports: {} };
  runInThisContext('(function(require,module,exports){' + componentCode + '\n})')(
    name => name === '../lib/game' ? engine : name === '../lib/canvas-text' ? canvasText : name === '../lib/meetings' ? meetings : require(name), compiledModule, compiledModule.exports);
  return compiledModule.exports.default;
}

async function setup(engine = game, {pixelRatio = 1, displayWidth = 840} = {}) {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(dom.window, 'devicePixelRatio', {value: pixelRatio});
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const frames = new Map();
  const timers = new Map();
  let nextId = 0;
  let now = 1;
  let ball = null;
  let paddle = null;
  const counters = [];
  const labels = [];
  let transform = null;
  const context = new Proxy({
    setTransform(...values) { transform = values; },
    measureText(text) { return {width: text.length * 6}; },
    arc(x, y) { ball = {x, y}; },
    moveTo(x, y) { if (y === game.PADDLE_Y) paddle = {left: x - 8}; },
    fillText(text, x, y) {
      if (/^\d+ meetings? to cancel$/.test(text)) counters.push(Number.parseInt(text));
      if (this.fillStyle === '#111827' && Number.parseFloat(this.font) <= 11) labels.push({text, x, y, size:Number.parseFloat(this.font)});
    },
  }, {get(target, key) { return key in target ? target[key] : () => {}; }});
  dom.window.HTMLCanvasElement.prototype.getContext = () => context;
  dom.window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({left: 0, top: 0, width: displayWidth, height: displayWidth / 1.5});
  globalThis.requestAnimationFrame = callback => { const id = ++nextId; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  dom.window.setTimeout = callback => { const id = ++nextId; timers.set(id, callback); return id; };
  dom.window.clearTimeout = id => timers.delete(id);
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  await act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(loadGame(engine)))));
  async function click(button) {
    const event = new dom.window.MouseEvent('click', {bubbles: true});
    Object.defineProperty(event, 'timeStamp', {value: now});
    await act(() => button.dispatchEvent(event));
  }
  async function frame() {
    now += game.FRAME_MS;
    const callbacks = [...frames.values()];
    frames.clear();
    await act(() => callbacks.forEach(callback => callback(now)));
  }
  return {
    frames, timers, counters, labels, click, frame,
    get transform() { return transform; },
    get ball() { return ball; },
    get paddle() { return paddle; },
    async start() {
      const input = document.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
      await act(() => {
        setter.call(input, 'Stability Test');
        input.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
      });
      const button = document.querySelector('button');
      assert.equal(button.disabled, false);
      await click(button);
    },
    async close() { await act(() => root.unmount()); dom.window.close(); },
  };
}

test('actual component: live counter, controls, game over, restart, and unmount cleanup', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.5;
  const h = await setup();
  try {
    assert.equal(document.querySelector('button').disabled, true);
    await h.start();
    assert.equal(document.querySelector('input'), null);
    assert.doesNotMatch(document.body.textContent, /All regular meetings canceled/);
    assert.equal(h.frames.size, 1);
    await h.frame();
    const initialCount = h.counters.at(-1);
    assert.ok(initialCount > 0);
    const initialBall = h.ball;
    for (let i = 0; i < 100; i++) await h.frame();
    assert.deepEqual(h.ball, initialBall);
    // Mouse coordinates respect canvas scaling and keep the full paddle on-board.
    await act(() => document.querySelector('canvas').dispatchEvent(new window.MouseEvent('mousemove', {bubbles: true, clientX: -500})));
    await h.frame();
    assert.equal(h.paddle.left, 0);
    const key = new window.KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true});
    await act(() => window.dispatchEvent(key));
    assert.equal(key.defaultPrevented, true);
    await h.frame();
    assert.equal(h.paddle.left, 24);
    // Leave the paddle at the edge and let a real round run until it is lost.
    for (let i = 0; i < 5000 && !document.querySelector('input'); i++) await h.frame();
    assert.ok(document.querySelector('input'), 'game over must return to the intro: ' + JSON.stringify({ball:h.ball, count:h.counters.at(-1), frames:h.frames.size, text:document.body.textContent}));
    assert.match(document.body.textContent, /Game over/);
    assert.equal(h.frames.size, 0, 'game over must stop scheduling frames');
    assert.ok(h.counters.some(count => count < initialCount), 'canvas counter must update on a hit');
    await h.start();
    assert.equal(h.frames.size, 1, 'restart creates exactly one loop');
    assert.equal(h.timers.size, 0, 'old game-over and toast timers are cleared');
    assert.doesNotMatch(document.body.textContent, /Game over/);
  } finally {
    await h.close();
    Math.random = originalRandom;
  }
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});

test('actual component: final hit stops loop and New day restarts it', async () => {
  const h = await setup({...game, stepGame(state, bricks) {
    const hit = bricks.find(brick => brick.active && !brick.isMilan);
    if (hit) hit.active = false;
    return {hit: hit ?? null, lost: false};
  }});
  try {
    await h.start();
    for (let i = 0; i < 100 && h.frames.size; i++) await h.frame();
    assert.match(document.body.textContent, /All regular meetings canceled/);
    assert.equal(h.counters.at(-1), 0);
    assert.equal(h.frames.size, 0);
    await h.click([...document.querySelectorAll('button')].find(button => button.textContent === 'New day'));
    assert.doesNotMatch(document.body.textContent, /All regular meetings canceled/);
    assert.equal(h.frames.size, 1);
    assert.equal(h.timers.size, 0);
    await h.frame();
    assert.ok(h.counters.at(-1) > 0);
  } finally { await h.close(); }
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});


test('unmount during a round cancels frames and a pending hit toast', async () => {
  let calls = 0;
  const h = await setup({...game, stepGame(state, bricks) {
    calls++;
    const hit = calls === 1 ? bricks.find(brick => !brick.isMilan) : null;
    if (hit) hit.active = false;
    return {hit, lost: false};
  }});
  try {
    await h.start();
    await h.frame();
    await h.frame();
    assert.equal(h.frames.size, 1);
    assert.equal(h.timers.size, 1);
  } finally { await h.close(); }
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
});


test('rendering scales the backing buffer for high-DPI and pointer coordinates stay logical', async () => {
  const h = await setup(game, {pixelRatio: 2, displayWidth: 1100});
  try {
    await h.start();
    await h.frame();
    const canvas = document.querySelector('canvas');
    assert.equal(canvas.width, 2200);
    assert.equal(canvas.height, 1467);
    assert.deepEqual(h.transform, [2200 / 840, 0, 0, 1467 / 560, 0, 0]);
    await act(() => canvas.dispatchEvent(new window.MouseEvent('mousemove', {bubbles:true, clientX:825})));
    await h.frame();
    assert.equal(h.paddle.left, 560);
  } finally { await h.close(); }
});

test('half-hour meeting text stays inside the shortest generated boxes', async () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  const h = await setup();
  try {
    await h.start();
    await h.frame();
    assert.ok(h.labels.length > 0);
    assert.equal(h.labels.length, h.counters.at(-1));
    for (const label of h.labels) {
      assert.ok(label.size >= 10);
      assert.ok(label.y - label.size / 2 >= 58);
      assert.ok(label.y + label.size / 2 <= 72);
      assert.ok(label.text.length * 6 <= 88);
    }
  } finally { await h.close(); Math.random = originalRandom; }
});


test('Milan collision opens a persistent popup, stops the loop, and Try again starts a fresh round', async () => {
  const rounds = [];
  let hitMilan = true;
  const h = await setup({...game, stepGame(state, bricks) {
    if (!rounds.includes(bricks)) rounds.push(bricks);
    return hitMilan ? {hit:bricks.find(brick => brick.isMilan),lost:true} : {hit:null,lost:false};
  }});
  try {
    assert.match(document.body.textContent, /two pink/);
    await h.start();
    await h.frame();
    const count = h.counters.at(-1);
    await h.frame();
    const dialog = document.querySelector('dialog');
    assert.ok(dialog.open);
    assert.equal(document.getElementById('milan-game-over-message').textContent, meetings.MILAN_GAME_OVER_MESSAGE);
    assert.equal(h.frames.size, 0);
    assert.equal(h.timers.size, 0, 'popup must persist until user action');
    assert.doesNotMatch(document.body.textContent, /Meeting canceled:/);
    assert.ok(rounds[0].filter(brick => brick.isMilan).every(brick => brick.active));
    assert.equal(count, rounds[0].filter(brick => !brick.isMilan).length);
    hitMilan = false;
    await h.click([...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Try again'));
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(h.frames.size, 1);
    await h.frame();
    await h.frame();
    assert.equal(rounds.length, 2);
    assert.equal(rounds[1].filter(brick => brick.isMilan).length, 2);
  } finally { await h.close(); }
});
