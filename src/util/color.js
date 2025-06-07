/**
 * https://stackoverflow.com/a/47270991
 * @param {[r: number, g: number, b: number, a?: number]} color
 * @returns {[h: number, s: number, l: number, a: number]} 
 */
function rgbToHsl(rgb) {
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

  return [h, s / 100, l / 100, a];
}

export class RGB {
  r = 0;
  g = 0;
  b = 0;
  a = 1;

  /**
   * @param {[r: number, g: number, b: number, a?: number] | string | number} p0 
   * @param {number?} p1 
   * @param {number?} p2 
   * @param {number?} p3 
   */
  constructor(p0, p1, p2, p3) {
    if (typeof p0 === "string") {
      p0 = p0.slice(1);
      let sliced = [];
      if (p0.length === 3 || p0.length === 4) p0 = Array.from(p0).map(c => c + c).join("");
      if (p0.length === 6 || p0.length === 8) sliced = p0.match(/../g).map(v => parseInt(v, 16));
      else throw TypeError("Invaild color string.");
      [p0, p1, p2, p3] = sliced;
    }
    if (p0 instanceof Array) [p0, p1, p2, p3] = p0;
    if (p3 > 1) p3 /= 255;
    this.r = p0, this.g = p1, this.b = p2, this.a = p3 ?? this.a;
  }

  convertToHSL() {
    return new HSL(rgbToHsl([this.r, this.g, this.b, this.a]));
  }

  toString() {
    return this.a >= 1 ?
      `rgb(${this.r}, ${this.g}, ${this.b})` :
      `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a * 100}%)`;
  }
}

export class HSL {
  h = 0;
  s = 0;
  l = 0;
  a = 1;

  /**
   * @param {[h: number, s: number, l: number, a?: number] | number} p0 
   * @param {number?} p1 
   * @param {number?} p2 
   * @param {number?} p3 
   */
  constructor(p0, p1, p2, p3) {
    if (p0 instanceof Array) [p0, p1, p2, p3] = p0;
    this.h = p0, this.s = p1, this.l = p2, this.a = p3 ?? this.a;
  }

  toString() {
    return this.a >= 1 ?
      `hsl(${this.h}, ${this.s * 100}%, ${this.l * 100}%)` :
      `hsla(${this.h}, ${this.s * 100}%, ${this.l * 100}%, ${this.a * 100}%)`;
  }
}
