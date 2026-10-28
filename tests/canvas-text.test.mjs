import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextFitter } from '../lib/canvas-text.ts';

function context() {
  return {
    font: '11px sans-serif', calls: 0,
    measureText(text) {
      this.calls++;
      const fontSize = Number.parseFloat(this.font);
      return { width: Array.from(text).reduce((width, character) =>
        width + (character === 'W' ? 1 : 0.5) * fontSize, 0) };
    },
  };
}

test('long meeting titles fit by measured width without horizontal squeezing', () => {
  const ctx = context();
  const fit = createTextFitter();
  for (const width of [40, 60, 88, 100]) {
    const result = fit(ctx, 'WWWW Alignment Meeting', width);
    assert.ok(result.endsWith('…'));
    assert.ok(ctx.measureText(result).width <= width);
    assert.ok(ctx.measureText(result.slice(0, -1) + 'g…').width > width);
  }
  assert.equal(fit(ctx, 'Sync', 88), 'Sync');
});

test('cached text is remeasured when the font changes, not on every frame', () => {
  const ctx = context();
  const fit = createTextFitter();
  fit(ctx, 'Architecture Council', 88);
  const measured = ctx.calls;
  fit(ctx, 'Architecture Council', 88);
  assert.equal(ctx.calls, measured);
  ctx.font = '10px sans-serif';
  fit(ctx, 'Architecture Council', 88);
  assert.ok(ctx.calls > measured);
});

test('narrow widths and Unicode text never exceed the available width', () => {
  const ctx = context();
  const fit = createTextFitter();
  assert.equal(fit(ctx, 'Meeting', 0), '');
  assert.equal(fit(ctx, 'Meeting', 2), '');
  const result = fit(ctx, '🎯 Calendar cleanup', 50);
  assert.ok(ctx.measureText(result).width <= 50);
  assert.ok(!/[\uD800-\uDBFF]$/.test(result.slice(0, -1)));
});
