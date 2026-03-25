export class SeededRandom {
  constructor(seed) {
    this.seed = typeof seed === 'string'
      ? [...seed].reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0)
      : seed;
  }
  next() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}
