export default class Vec2 {
  x = 0;
  y = 0;
  
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * @param {Vec2 | number} val 
   */
  add(val) {
    if (typeof val === "number") return new Vec2(this.x + val, this.y + val);
    return new Vec2(this.x + val.x, this.y + val.y);
  }

  /**
   * @param {Vec2 | number} val 
   */
  sub(val) {
    if (typeof val === "number") return new Vec2(this.x - val, this.y - val);
    return new Vec2(this.x - val.x, this.y - val.y);
  }

  /**
   * @param {Vec2} x 
   */
  mul(x) {
    return new Vec2(x * this.x, x * this.y);
  }

  /**
   * @param {Vec2} x 
   */
  div(x) {
    return new Vec2(this.x / x, this.y / x);
  }

  norm() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  unit() {
    return this.div(this.norm);
  }

  floor() {
    return new Vec2(Math.floor(this.x), Math.floor(this.y));
  }

  abs() {
    return new Vec2(Math.abs(this.x), Math.abs(this.y));
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  [Symbol.iterator]() {
    let idx = -1;
    return {
      next: () => {
        idx++;
        return { value: idx === 0 ? this.x : this.y , done: idx === 2};
      }
    }
  }
}