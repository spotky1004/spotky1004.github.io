import Vec2 from "./Vec2.js";

/**
 * @template T
 * @typedef {(t: number) => T} ParticleCallback 
 */
/**
 * @typedef ParticleOptions 
 * @prop {ParticleCallback<Particle["color"]>} color 
 * @prop {ParticleCallback<Particle["pos"]>} pos 
 * @prop {ParticleCallback<Particle["size"]>} size 
 * @prop {Particle["lifetime"]} lifetime 
 */

export default class Particle {
  /** @type {ParticleCallback<string>} */
  #color = () => "#000";
  /** @type {ParticleCallback<Vec2>} */
  #pos = (t) => new Vec2(t, 0);
  /** @type {ParticleCallback<number>} */
  #size = () => 0.5;
  time = 0;
  lifetime = 2;
  
  /**
   * @param {ParticleOptions} option 
   */
  constructor(option) {
    this.#color = option.color ?? this.#color;
    this.#pos = option.pos ?? this.#pos;
    this.#size = option.size ?? this.#size;
    this.lifetime = option.lifetime ?? this.lifetime;
  }

  get color() {
    return this.#color(this.time);
  }

  get pos() {
    return this.#pos(this.time);
  }

  get size() {
    return this.#size(this.time);
  }

  /**
   * @param {number} dt 
   */
  update(dt) {
    this.time += dt;
  }
}
