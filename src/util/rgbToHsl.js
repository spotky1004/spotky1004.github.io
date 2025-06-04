/**
 * https://stackoverflow.com/a/47270991
 * @param {[r: number, g: number, b: number, a?: number]} color
 * @returns {[h: number, s: number, l: number, a: number]} 
 */
export default function rgbToHsl(rgb) {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  const add = max + min;

  const hue =
    min === max ?
      0
    : r === max ?
      (((60 * (g - b)) / diff) + 360) % 360
    : g === max ?
      ((60 * (b - r)) / diff) + 120
    :
      ((60 * (r - g)) / diff) + 240;

  const lum = 0.5 * add;

  const sat =
    lum === 0 ?
      0
    : lum === 1 ?
      1
    : lum <= 0.5 ?
      diff / add
    :
      diff / (2 - add);

  const h = Math.round(hue);
  const s = Math.round(sat * 100);
  const l = Math.round(lum * 100);
  const a = rgb[3] ?? 1;

  return [h, s, l, a];
}