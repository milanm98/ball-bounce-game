// Measure using the active canvas font, rather than squeezing text with fillText's
// maxWidth argument. Cache the result so labels need no remeasurement each frame.
export function createTextFitter() {
  const cache = new Map<string, string>();
  return (ctx: CanvasRenderingContext2D, text: string, width: number) => {
    if (width <= 0) return '';
    const key = JSON.stringify([ctx.font, text, width]);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let fitted = text;
    if (ctx.measureText(text).width > width) {
      const characters = Array.from(text);
      let low = 0;
      let high = characters.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (ctx.measureText(characters.slice(0, middle).join('') + '…').width <= width) low = middle;
        else high = middle - 1;
      }
      fitted = ctx.measureText('…').width <= width
        ? characters.slice(0, low).join('') + '…'
        : '';
    }
    if (cache.size >= 128) cache.clear();
    cache.set(key, fitted);
    return fitted;
  };
}

// Wrap the complete title, without ellipses or horizontal compression. The
// cache avoids measuring unchanged meeting names on every animation frame.
export function createTextWrapper() {
  const cache = new Map<string, string[]>();
  return (ctx: CanvasRenderingContext2D, text: string, width: number): string[] => {
    if (width <= 0 || !text.trim()) return [];
    const key = JSON.stringify([ctx.font, text, width]);
    const cached = cache.get(key);
    if (cached) return cached;
    const lines: string[] = [];
    let line = '';
    for (const word of text.trim().split(/\s+/u)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      // A long word can also wrap rather than disappearing or being shortened.
      for (const character of Array.from(word)) {
        if (line && ctx.measureText(line + character).width > width) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    if (line) lines.push(line);
    if (cache.size >= 128) cache.clear();
    cache.set(key, lines);
    return lines;
  };
}
