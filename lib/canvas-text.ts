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
