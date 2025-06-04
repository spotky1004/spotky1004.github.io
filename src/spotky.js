import els from "./els.js";
import getImagePixels from "./util/getImagePixels.js";
import rgbToHsl from "./util/rgbToHsl.js";
import gen2dArray from "./util/gen2dArray.js";
import Vec2 from "./util/Vec2.js";

const state = {
  /** @type {[r: number, g: number, b: number, a: number][][]} */
  pixels: [],
  /** @type {Vec2[][]} */
  wind: [],
  /** @type {Vec2[][]} */
  pixelDiffs: [],
  /** @type {Vec2[][]} */
  pixelForces: [],
  width: 0, height: 0,
  mousePos: null,
  t: 0,
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
  start();
});

function calcUnitSize() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const { width, height } = state;
  return Math.floor(0.9 * Math.min(sw, sh) / Math.max(width, height));
}

/**
 * @returns {Vec2[][]}
 */
function calcPixelPoses() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const { width, height } = state;

  const unitSize = calcUnitSize();
  const cx = Math.floor(sw / 2);
  return gen2dArray(height, width, (i, j) => new Vec2(
    Math.floor(cx + unitSize * (j - width / 2)),
    sh - (height - i) * unitSize
  ));
}

const PIXEL_TYPES = {
  empty: 0,
  leaf: 1,  //    _:::_
  trunk: 2, //   <'^' >
  hat: 3,   //  <   ~  >
  eyes: 4,  // <      ~ >
  mouth: 5  //   |_ -|
};
function groupifyPixels() {
  const { pixels, width, height } = state;
  return gen2dArray(height, width, (i, j) => {
    const [r, g, b, a] = pixels[i][j];
    if (a === 0) return 0;
    if (i <= 10) return 3;
    if (width - i <= 6 && r >= g) return 2;
    if (r === g && g === b) {
      if (r === 6 * 16) return 5;
      return 4;
    }
    return 1;
  });
}

/**
 * @returns {number[][]}
 */
function calcPixelWeights() {
  const { pixels, width, height } = state;
  const types = groupifyPixels();
  return gen2dArray(height, width, (i, j) => {
    const pixel = pixels[i][j].slice(0, 3);
    const type = types[i][j];
    const mult = pixel.reduce((a, b) => a * (1 - (b / 255) ** 0.1), 1);
    if (PIXEL_TYPES.empty === type) return Infinity;
    if (PIXEL_TYPES.leaf === type) return 1500 * (40 - i) * mult + 5;
    if (PIXEL_TYPES.trunk === type) return 80;
    if (PIXEL_TYPES.hat === type) return 10;
    if (PIXEL_TYPES.eyes === type) return 300;
    if (PIXEL_TYPES.mouth === type) return 250;
  });
}

/**
 * @param {Vec2} vec 
 */
function convertToPixelPos(vec) {
  const sw = window.innerWidth, sh = window.innerHeight;
  const { width, height } = state;

  const unitSize = calcUnitSize();
  const s = new Vec2(
    Math.floor(Math.floor(sw / 2) - unitSize * width / 2),
    sh - height * unitSize
  );
  return vec.sub(s).div(unitSize);
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

      const moveDir = dir.mul((power / (0.001 + power)) ** (2 / dt));
      const moveDirAbs = moveDir.abs();
      const xSign = Math.sign(moveDir.x), ySign = Math.sign(moveDir.y);

      nextState[i][j] = nextState[i][j].add(dir.sub(moveDir));
      let lineWind = new Vec2();
      let diagWind = new Vec2();
      if (moveDirAbs.x > moveDirAbs.y) {
        const diagPower = moveDirAbs.y;
        diagWind = new Vec2(xSign * diagPower, ySign * diagPower);
        lineWind = new Vec2(xSign * (moveDirAbs.x - diagPower), 0);
      } else {
        const diagPower = moveDirAbs.x;
        diagWind = new Vec2(xSign * diagPower, ySign * diagPower);
        lineWind = new Vec2(0, ySign * (moveDirAbs.y - diagPower));
      }
      lineWind = lineWind.mul(loss);
      diagWind = diagWind.mul(loss);

      let iDif = 0, jDif = 0;

      if (lineWind.y < 0 && i !== 0) iDif = -1;
      if (lineWind.y > 0 && i + 1 !== height) iDif = 1;
      if (lineWind.x < 0 && j !== 0) jDif = -1;
      if (lineWind.x > 0 && j + 1 !== width) jDif = 1;
      if (iDif !== 0 || jDif !== 0) nextState[i + iDif][j + jDif] = nextState[i + iDif][j + jDif].add(lineWind);

      iDif = 0, jDif = 0;
      if (diagWind.x < 0 && diagWind.y < 0 && i !== 0 && j !== 0) iDif = -1, jDif = -1;
      if (diagWind.x > 0 && diagWind.y < 0 && i !== 0 && j + 1 !== width) iDif = -1, jDif = 1;
      if (diagWind.x < 0 && diagWind.y > 0 && i + 1 !== height && j !== 0) iDif = 1, jDif = -1;
      if (diagWind.x > 0 && diagWind.y > 0 && i + 1 !== height && j + 1 !== width) iDif = 1, jDif = 1;
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
  const pixelPoses = calcPixelPoses();
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const pos = pixelPoses[i][j];
      const dir = wind[i][j];
      const power = dir.norm();
      const color = `rgb(${255 * power}, 0, ${255 * (1 - power)})`;
      drawArrow(
        pos.add(unitSize / 2),
        unitSize * power, Math.atan2(dir.y, dir.x),
        color
      );
    }
  }
}

function render() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const { pixels, pixelDiffs, width, height } = state;
  const canvas = els.spotky.canvas;
  const ctx = canvas.getContext("2d");

  canvas.width = sw;
  canvas.height = sh;
  // ctx.clearRect(0, 0, sw, sh);

  const unitSize = calcUnitSize();
  const pixelTypes = groupifyPixels();
  const pixelPoses = calcPixelPoses();
  for (let z = 0; z <= 5; z++) {
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (pixelTypes[i][j] !== z) continue;
        const pos = pixelPoses[i][j];
        const posDif = pixelDiffs[i][j];
        const [h, s, l, a] = rgbToHsl(pixels[i][j]);
        if (a === 0) continue;
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l * (0.993 ** i)}%, ${a}%)`;
        ctx.fillRect(pos.x, pos.y, unitSize, unitSize);
        ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${a}%)`;
        ctx.fillRect(...pos.add(posDif.mul(unitSize)), unitSize, unitSize);
      }
    }
  }
}

function loop() {
  if (!state.isRunning) return;

  const t = new Date().getTime();
  const dt = (t - state.t) / 1000;
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
