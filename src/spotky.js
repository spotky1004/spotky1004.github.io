import els from "./els.js";
import getImagePixels from "./util/getImagePixels.js";
import gen2dArray from "./util/gen2dArray.js";
import Vec2 from "./util/Vec2.js";
import * as Color from "./util/color.js";
import Particle from "./util/Particle.js";

const GROUND_TYPES = {
  empty: 0,
  grass_light: 1,
  grass_dark: 2,
  dirt_light: 3,
  dirt_dark: 4
};
const groundPixels = ["#0000", "#91d966", "#86ca5c", "#e3bdaa", "#cca693"];

const state = {
  /** @type {Color.RGB[][]} */
  pixels: [],
  /** @type {number[][]} */
  ground: [],
  /** @type {Vec2[][]} */
  wind: [],
  /** @type {Vec2[][]} */
  pixelDiffs: [],
  /** @type {Vec2[][]} */
  pixelForces: [],
  /** @type {Set<Particle>} */
  particles: new Set(),
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

const imagePath = "./resource/image/SpotkyTree E7.png";
const image = new Image();
image.src = imagePath;
image.addEventListener("load", e => {
  const pixels = getImagePixels(image);
  state.pixels = pixels.map(row => row.map(color => new Color.RGB(color)));
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
    p += (1 - p) / 50;
    if (Math.random() < p) {
      if (minHeight === curHeight) curHeight++;
      else if (maxHeight === curHeight) curHeight--;
      else curHeight += Math.floor(Math.random() * 2) * 2 - 1;
      curHeight = Math.max(minHeight, Math.max(minHeight, curHeight));
      p = 0;
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
  cheek: 5, // <      ~ >
  eyes: 4,  //   |_ -|
  mouth: 6
};
function groupifyPixels() {
  const cache = state.cache.pixelGroups;
  if (cache.isVaild) return cache.value;

  const { pixels, width, height } = state;
  cache.value = gen2dArray(height, width, (i, j) => {
    const { r, g, b, a } = pixels[i][j];
    const rgb = new Color.RGB(r, g, b, a);
    const hsl = rgb.convertToHSL();
    if (a === 0) return PIXEL_TYPES.empty;
    if (i <= 30 && Math.abs(hsl.h - 45) < 5) return PIXEL_TYPES.hat;
    if (["rgb(255, 255, 255)", "rgb(13, 26, 2)", "rgb(19, 35, 5)", "rgb(40, 63, 20)"].includes(rgb.toString())) return PIXEL_TYPES.eyes;
    if (hsl.h === 313) return PIXEL_TYPES.cheek;
    if (hsl.h === 91) return PIXEL_TYPES.mouth;
    if (Math.abs(hsl.h - 92) < 5) return PIXEL_TYPES.leaf;
    return PIXEL_TYPES.trunk;
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
    const type = types[i][j];
    if (PIXEL_TYPES.empty === type) return Infinity;
    if (PIXEL_TYPES.trunk === type) return 60;
    if (PIXEL_TYPES.leaf === type) {
      const hsl = pixels[i][j].convertToHSL();
      return 25 * 0.95 ** i * ((3 - 1 / hsl.l) ** 2.4 * 2) * (1 + Math.abs(j - 32) / 16);
    }
    if (PIXEL_TYPES.hat === type) return 35;
    if (PIXEL_TYPES.cheek === type) return 12;
    if (PIXEL_TYPES.eyes === type) return 999;
    if (PIXEL_TYPES.mouth === type) return 60;
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
  if (dir.norm() > 20) return;
  const { width, height, wind } = state;

  const f = from.floor();
  for (let i = -8; i <= 8; i++) {
    const yt = f.y + i;
    if (0 > yt || yt >= height) continue;
    for (let j = -8; j <= 8; j++) {
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
      pixelDiffs[i][j] = pixelDiffs[i][j].add(pixelForces[i][j].mul(5 * dt));
    }
  }
}

const particleCreater = {
  /** @type {(i: number, j: number) => Particle} */
  leaf: (i, j) => {
    const color = state.pixels[i][j].convertToHSL();
    color.s *= 0.95;
    color.l *= (0.9 - 0.1 * Math.random());
    color.l = Math.min(1, color.l + 0.2 - i / 150);
    color.a *= 0.7;

    let lastT = 0;
    let pos = new Vec2(j + Math.random(), i + Math.random());
    let force = new Vec2(0, 0);
    const size = 0.4 + Math.random() / 2;
    return new Particle({
      color: t => {
        const aMult = t > 3 ? 1 - (t - 3) / 2 : 1;
        const lAdd = Math.random() / 20 + 0.2;
        return new Color.HSL(
          color.h,
          color.s,
          Math.min(1, color.l + lAdd),
          color.a * aMult
        ).toString();
      },
      pos: t => {
        const dt = t - lastT;
        lastT = t;

        const fPos = pos.floor()
        let wind = (state.wind[fPos.y] ? state.wind[fPos.y][fPos.x] : undefined);
        if (!wind) wind = new Vec2();

        const loss = FORCE_LOSS ** (20 * dt);
        const autoForce = new Vec2(Math.cos(2 * t), Math.abs(Math.sin(2 * t))).mul(0.1 * (1 + t / 3));
        force = force.mul(loss);
        if (wind) force = force.add(wind.add(autoForce).mul(dt * 160));
        pos = pos.add(force.mul(dt));
        return pos;
      },
      size: t => size * (0.8 ** (1 + t)),
      lifetime: 5
    });
  },
  wind: (i, j) => {
    const color = new Color.HSL(0, 0, 1, 0.1);
    let lastT = 0;
    let pos = new Vec2(j + Math.random(), i + Math.random());
    let force = state.wind[i][j];
    const particle = new Particle({
      color: t => {
        const aMult = 1 - 2 * t;
        color.a *= aMult;
        const out = color.toString();
        color.a /= aMult;
        return out;
      },
      pos: t => {
        const dt = t - lastT;
        lastT = t;
        
        const fPos = pos.floor()
        const wind = (state.wind[fPos.y] ? state.wind[fPos.y][fPos.x] : undefined);
        if (wind) {
          const div = 0.5 ** (dt * 100);
          force = wind.mul(1 - div).add(force.mul(div));
        }
        const adjForce = force.norm() > 0.1 ? force : force.mul(0.1 / force.norm());

        pos = pos.add(adjForce.mul(dt * 30));
        return pos;
      },
      size: t => (Math.sqrt(force.norm()) / 1.5 + 0.1) / (1 + 2 * t),
      lifetime: 0.5
    });
    return particle;
  }
};

function updateParticles(dt) {
  const { particles, width, height } = state;
  const types = groupifyPixels();
  
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const type = types[i][j];
      const windPower = state.wind[i][j].norm();
      if (PIXEL_TYPES.leaf === type) {
        if (windPower < 0.2) continue;
        const chance = 1 - (0.9 - i / height / 3) ** (windPower * dt / 2);
        if (Math.random() < chance) particles.add(particleCreater.leaf(i, j));
      }

      if (0.2 < windPower) {
        const chance = 1 - 0.1 ** (windPower * dt / 2);
        if (Math.random() < chance) particles.add(particleCreater.wind(i, j));
      }
    }
  }

  for (const particle of particles) {
    particle.update(dt);
    if (particle.time > particle.lifetime) particles.delete(particle);
  }
}

/**
 * @param {Vec2} pos 
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
  const { pixels, particles, pixelDiffs, pixelForces, width, height } = state;
  const canvas = els.spotky.canvas;
  
  canvas.width = document.body.clientWidth;
  canvas.height = document.body.clientHeight;
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
  for (let z = 0; z <= 6; z++) {
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (pixelTypes[i][j] !== z) continue;
        const pixel = pixels[i][j].convertToHSL();
        if (pixel.a === 0 || pixel.l === 1) continue;
        pixel.l = Math.min(1, pixel.l * 1.02);
        drawSquare(
          convertToCanvasPos(new Vec2(j, i)),
          unitSize,
          pixel.toString()
        );
      }
    }
  }
  for (let z = 0; z <= 6; z++) {
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (pixelTypes[i][j] !== z) continue;
        const pixel = pixels[i][j].convertToHSL();
        if (pixel.a === 0) continue;
        const posDif = pixelDiffs[i][j];
        const posF = pixelForces[i][j];
        pixel.l = Math.min(1, pixel.l + (posF.norm() ** (1/8)) / 15);
        drawSquare(
          convertToCanvasPos(new Vec2(j, i)).add(posDif.mul(unitSize)),
          unitSize,
          pixel.toString()
        );
      }
    }
  }

  // ✨✨
  for (const particle of particles) {
    drawSquare(
      convertToCanvasPos(particle.pos),
      unitSize * particle.size,
      particle.color
    );
  }
}

function loop() {
  if (!state.isRunning) return;

  const t = new Date().getTime();
  const dt = Math.min(0.1, (t - state.t) / 1000) * state.speed;
  state.t = t;
  updateWind(dt);
  updateForce(dt);
  updateParticles(dt);
  render();
  // renderWindArrow();

  requestAnimationFrame(loop);
}

function start() {
  state.t = new Date().getTime();
  state.isRunning = true;
  requestAnimationFrame(loop);
}

/**
 * @type {Map<string, Vec2>}
 */
const prevPoses = new Map();
/**
 * @param {string} id 
 * @param {Vec2} pos 
 * @param {number} mult 
 */
function mouseMoveHandler(id, pos, mult) {
  if (!prevPoses.has(id)) {
    prevPoses.set(id, pos);
    return;
  }

  const prevPos = prevPoses.get(id);
  const delta = pos.sub(prevPos);
  prevPoses.set(id, pos);

  const unitSize = calcUnitSize();
  addWind(convertToPixelPos(prevPos.sub(delta)), delta.div(unitSize).mul(mult));
}

els.spotky.canvas.addEventListener("mousemove", e => {
  let mult = 1;
  if (e.buttons === 1) mult *= 2;
  mouseMoveHandler("mouse", new Vec2(e.clientX, e.clientY), mult);
});

els.spotky.canvas.addEventListener("touchmove", e => {
  for (const touch of e.touches) {
    const touchId = `touch_${touch.identifier.toString()}`;
    const mult = 1 + touch.force;
    mouseMoveHandler(touchId, new Vec2(touch.clientX, touch.clientY),mult);
  }
});

els.spotky.canvas.addEventListener("touchend", e => {
  const vailds = [...e.touches].map(v => v.identifier);
  for (let i = 0; i < 10; i++) {
    const touchId = `touch_${i}`;
    if (!prevPoses.has(touchId) || vailds.includes(i)) continue;
    prevPoses.delete(touchId);
  }
});
