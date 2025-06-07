import els from "./els.js";
import getImagePixels from "./util/getImagePixels.js";
import rgbToHsl from "./util/rgbToHsl.js";
import gen2dArray from "./util/gen2dArray.js";
import Vec2 from "./util/Vec2.js";

const GROUND_TYPES = {
  empty: 0,
  grass_light: 1,
  grass_dark: 2,
  dirt_light: 3,
  dirt_dark: 4
};
const groundPixels = ["#0000", "#91d966", "#86ca5c", "#e3bdaa", "#cca693"];

const state = {
  /** @type {[r: number, g: number, b: number, a: number][][]} */
  pixels: [],
  /** @type {number[][]} */
  ground: [],
  /** @type {Vec2[][]} */
  wind: [],
  /** @type {Vec2[][]} */
  pixelDiffs: [],
  /** @type {Vec2[][]} */
  pixelForces: [],
  width: 0, height: 0,
  mousePos: null,
  t: 0,
  cache: {
    cavnasSize: {
      value: new Vec2(0, 0),
      t: -1,
    },
    pixelGroups: {
      /** @type {number[][]} */
      value: [],
      isVaild: false
    },
    pixelWeights: {
      /** @type {number[][]} */
      value: [],
      isVaild: false
    }
  },
  speed: 1,
  isLoaded: false,
  isRunning: false
};
window.state = state;

const imagePath = "./resource/image/Spotky E6 NoBG.png";
const image = new Image();
image.src = imagePath;
image.addEventListener("load", e => {
  const pixels = getImagePixels(image);
  state.pixels = pixels;
  state.wind = gen2dArray(pixels.length, pixels[0].length, () => new Vec2());
  state.pixelDiffs = gen2dArray(pixels.length, pixels[0].length, () => new Vec2());
  state.pixelForces = gen2dArray(pixels.length, pixels[0].length, () => new Vec2());
  state.isLoaded = true;
  state.width = (pixels[0] ?? []).length;
  state.height = pixels.length;
  state.ground = generateGround(state.width * 4, 3, 5);
  start();
});

function generateGround(width = 100, minHeight = 3, maxHeight = 5) {
  const out = gen2dArray(maxHeight, width, () => 0);
  let curHeight = Math.round((maxHeight + minHeight) / 2);
  let p = 0;
  for (let j = 0; j < width; j++) {
    p += (1 - p) / 100;
    if (Math.random() < p) {
      if (minHeight === curHeight) curHeight++;
      else if (maxHeight === curHeight) curHeight--;
      else curHeight += Math.floor(Math.random() * 2) * 2 - 1;
      curHeight = Math.max(minHeight, Math.max(minHeight, curHeight));
    }

    out[maxHeight - 1 - (curHeight - 1)][j] = (j % 2 ? GROUND_TYPES.grass_light : GROUND_TYPES.grass_dark);
    for (let i = 0; i < curHeight - 1; i++) {
      if (Math.random() < 0.6 ** (curHeight - 2 - i)) out[maxHeight - 1 - i][j] = GROUND_TYPES.dirt_dark;
      else out[maxHeight - 1 - i][j] = GROUND_TYPES.dirt_light;
    }
  }
  return out;
}

function calcCanvasSize() {
  const cache = state.cache.cavnasSize;
  if (state.t === state.cache.cavnasSize.t) return cache.value.clone();

  const canvas = els.spotky.canvas;
  cache.t = state.t;
  cache.value = new Vec2(canvas.clientWidth, canvas.clientHeight);
  return cache.value;
}

function calcUnitSize() {
  const canvas = calcCanvasSize();
  const { width, height } = state;
  return Math.floor(0.9 * Math.min(canvas.x, canvas.y) / Math.max(width, height));
}

const PIXEL_TYPES = {
  empty: 0,
  trunk: 1, //    _:::_
  leaf: 2,  //   <'^' >
  hat: 3,   //  <   ~  >
  eyes: 4,  // <      ~ >
  mouth: 5  //   |_ -|
};
function groupifyPixels() {
  const cache = state.cache.pixelGroups;
  if (cache.isVaild) return cache.value;

  const { pixels, width, height } = state;
  cache.value = gen2dArray(height, width, (i, j) => {
    const [r, g, b, a] = pixels[i][j];
    if (a === 0) return 0;
    if (i <= 10) return 3;
    if (width - i <= 6 && r >= g) return 1;
    if (r === g && g === b) {
      if (r === 6 * 16) return 5;
      return 4;
    }
    return 2;
  });
  cache.isVaild = true;
  return cache.value;
}

/**
 * @returns {number[][]}
 */
function calcPixelWeights() {
  const cache = state.cache.pixelWeights;
  if (cache.isVaild) return cache.value;

  const { pixels, width, height } = state;
  const types = groupifyPixels();
  cache.value = gen2dArray(height, width, (i, j) => {
    const pixel = pixels[i][j].slice(0, 3);
    const type = types[i][j];
    const mult = pixel.reduce((a, b) => a * (1 - (b / 255) ** 0.1), 1);
    if (PIXEL_TYPES.empty === type) return Infinity;
    if (PIXEL_TYPES.trunk === type) return 80;
    if (PIXEL_TYPES.leaf === type) return 1500 * (40 - i) * mult + 5;
    if (PIXEL_TYPES.hat === type) return 40;
    if (PIXEL_TYPES.eyes === type) return 300;
    if (PIXEL_TYPES.mouth === type) return 250;
  });
  cache.isVaild = true;
  return cache.value;
}

/**
 * @param {Vec2} vec 
 */
function convertToPixelPos(vec) {
  const canvas = calcCanvasSize();
  const { width, height } = state;

  const unitSize = calcUnitSize();
  const s = new Vec2(
    Math.floor(Math.floor(canvas.x / 2) - unitSize * width / 2),
    canvas.y - height * unitSize
  );
  return vec.sub(s).div(unitSize);
}

/**
 * @param {Vec2} vec 
 */
function convertToCanvasPos(vec) {
  const canvas = calcCanvasSize();
  const unitSize = calcUnitSize();
  const { width, height } = state;
  return new Vec2(
    Math.floor((canvas.x / 2) + unitSize * (vec.x - width / 2)),
    canvas.y - unitSize * (height - vec.y)
  );
}

/**
 * @param {Vec2} from 
 * @param {Vec2} dir 
 */
function addWind(from, dir) {
  const { width, height, wind } = state;

  const f = from.floor();
  for (let i = -3; i <= 3; i++) {
    const yt = f.y + i;
    if (0 > yt || yt >= height) continue;
    for (let j = -3; j <= 3; j++) {
      const xt = f.x + j;
      if (0 > xt || xt >= width) continue;
      const div = 1 + Math.sqrt(i * i + j * j) ** 2;
      wind[yt][xt] = wind[yt][xt].add(dir.div(div));
    }
  }
}

const FORCE_LOSS = 0.8;
/**
 * @param {number} dt 
 */
function updateWind(dt) {
  const { wind, width, height } = state;
  const nextState = gen2dArray(width, height, () => new Vec2());
  const loss = FORCE_LOSS ** (60 * dt);

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const dir = wind[i][j];
      const power = dir.norm();
      if (power === 0) continue;

      const deg = (Math.atan2(dir.y, dir.x) + 2 * Math.PI) % (2 * Math.PI);
      const div = Math.floor(deg * 4 / Math.PI);
      let divProgress = (deg * 4 / Math.PI) % 1;
      if (div % 2 === 0) divProgress = 1 - divProgress;

      const moveDir = dir.mul((power / (0.001 + power)) ** (2 / dt));
      const lineWind = moveDir.mul(divProgress).mul(loss);
      const diagWind = moveDir.mul(1 - divProgress).mul(loss);

      nextState[i][j] = nextState[i][j].add(dir.sub(moveDir));

      let iDif = 0, jDif = 0;
      if ((div === 5 || div === 6) && i !== 0) iDif = -1;
      if ((div === 1 || div === 2) && i + 1 !== height) iDif = 1;
      if ((div === 3 || div === 4) && j !== 0) jDif = -1;
      if ((div === 0 || div === 7) && j + 1 !== width) jDif = 1;
      if (iDif !== 0 || jDif !== 0) nextState[i + iDif][j + jDif] = nextState[i + iDif][j + jDif].add(lineWind);

      iDif = 0, jDif = 0;
      if ((div === 4 || div === 5) && i !== 0 && j !== 0) iDif = -1, jDif = -1;
      if ((div === 6 || div === 7) && i !== 0 && j + 1 !== width) iDif = -1, jDif = 1;
      if ((div === 2 || div === 3) && i + 1 !== height && j !== 0) iDif = 1, jDif = -1;
      if ((div === 0 || div === 1) && i + 1 !== height && j + 1 !== width) iDif = 1, jDif = 1;
      if (iDif !== 0 || jDif !== 0) nextState[i + iDif][j + jDif] = nextState[i + iDif][j + jDif].add(diagWind);
    }
  }

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      wind[i][j] = nextState[i][j];
    }
  }
}

function updateForce(dt) {
  const { pixelDiffs, pixelForces, wind, width, height } = state;
  const weights = calcPixelWeights();
  const loss = FORCE_LOSS ** (20 * dt);

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const w = weights[i][j];
      pixelForces[i][j] = pixelForces[i][j]
        .mul(loss)
        .add(
          wind[i][j].mul(50)
            .sub(pixelDiffs[i][j].mul(40))
            .mul(dt / w)
        );
      pixelDiffs[i][j] = pixelDiffs[i][j].add(pixelForces[i][j].mul(10 * dt));
    }
  }
}

/**
 * @param {Vec2} x 
 * @param {number} size 
 * @param {string} color 
 */
function drawSquare(pos, size, color = "#000") {
  const canvas = els.spotky.canvas;
  const cw = canvas.width, ch = canvas.height;
  if (
    0 > pos.x + size || pos.x - size > cw ||
    0 > pos.y + size || pos.y - size > ch
  ) return;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = color;
  ctx.fillRect(...pos, size, size)
}

/**
 * @param {Vec2} dir 
 * @param {number} size 
 * @param {number} deg 
 * @param {string} color 
 */
function drawArrow(dir, size, deg, color = "#000") {
  const canvas = els.spotky.canvas;
  const ctx = canvas.getContext("2d");

  const u = new Vec2(Math.cos(deg), Math.sin(deg));
  const up = new Vec2(Math.cos(deg + 0.3), Math.sin(deg + 0.3));
  const um = new Vec2(Math.cos(deg - 0.3), Math.sin(deg - 0.3));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(...dir.sub(u.mul(size / 2)));
  ctx.lineTo(...dir.add(u.mul(size / 2)));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(...dir.add(u.mul(size / 2)));
  ctx.lineTo(...dir.add(u.mul(size / 2)).sub(up.mul(size / 3)));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(...dir.add(u.mul(size / 2)));
  ctx.lineTo(...dir.add(u.mul(size / 2)).sub(um.mul(size / 3)));
  ctx.stroke();
}

function renderWindArrow() {
  const { wind, width, height } = state;
  const unitSize = calcUnitSize();
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const dir = wind[i][j];
      const power = dir.norm();
      if (power < 0.05) continue;
      const color = `rgb(${255 * power}, 0, ${255 * (1 - power)})`;
      drawArrow(
        convertToCanvasPos(new Vec2(j + 0.5, i + 0.5)),
        unitSize * power * 2, Math.atan2(dir.y, dir.x),
        color
      );
    }
  }
}

function render() {
  const { pixels, pixelDiffs, width, height } = state;
  const canvas = els.spotky.canvas;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // ctx.clearRect(0, 0, sw, sh);

  const unitSize = calcUnitSize();
  const pixelTypes = groupifyPixels();

  // 🌱🟫
  const ground = state.ground;
  const gWidth = ground[0].length, gHeight = ground.length;
  const gOffset = Math.floor(gWidth / 2);
  for (let i = 0; i < gHeight; i++) {
    for (let j = 0; j < gWidth; j++) {
      const color = groundPixels[ground[i][j]];
      drawSquare(convertToCanvasPos(new Vec2(j - gOffset, i + height - gHeight)), unitSize, color);
    }
  }

  // 🌲
  for (let z = 0; z <= 5; z++) {
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (pixelTypes[i][j] !== z) continue;
        const [h, s, l, a] = rgbToHsl(pixels[i][j]);
        if (a === 0) continue;
        drawSquare(
          convertToCanvasPos(new Vec2(j, i)),
          unitSize,
          `hsla(${h}, ${s}%, ${l * (0.993 ** i)}%, ${a}%)`
        );
      }
    }
  }
  for (let z = 0; z <= 5; z++) {
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (pixelTypes[i][j] !== z) continue;
        const posDif = pixelDiffs[i][j];
        const [h, s, l, a] = rgbToHsl(pixels[i][j]);
        if (a === 0) continue;
        drawSquare(
          convertToCanvasPos(new Vec2(j, i)).add(posDif.mul(unitSize)),
          unitSize,
          `hsla(${h}, ${s}%, ${l}%, ${a}%)`
        );
      }
    }
  }
}

function loop() {
  if (!state.isRunning) return;

  const t = new Date().getTime();
  const dt = Math.min(0.1, (t - state.t) / 1000) * state.speed;
  state.t = t;
  render();
  updateWind(dt);
  updateForce(dt);
  // renderWindArrow();

  requestAnimationFrame(loop);
}

function start() {
  state.t = new Date().getTime();
  state.isRunning = true;
  requestAnimationFrame(loop);
}

/**
 * @param {MouseEvent} e 
 */
function mouseMoveHandler(e) {
  const mousePos = new Vec2(e.clientX, e.clientY);
  if (state.mousePos === null) state.mousePos = mousePos;
  const delta = mousePos.sub(state.mousePos);
  state.mousePos = mousePos;
  const unitSize = calcUnitSize();
  addWind(convertToPixelPos(mousePos.sub(delta)), delta.div(unitSize));
}

els.spotky.canvas.addEventListener("mousemove", mouseMoveHandler);
