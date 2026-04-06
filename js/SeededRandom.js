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

  /**
   * FRandomStream child-seed pattern: derive a deterministic child RNG
   * from this stream using the given index. The child gets its own
   * independent sequence so it doesn't consume values from the parent.
   * Callers pass a stable index (e.g. floor number) to get the same
   * child stream every time without ordering dependencies.
   */
  child(n) {
    const s = (Math.imul(this.seed ^ 0xdeadbeef, (n + 1) * 0x9e3779b9 | 0) ^ (n * 0x517cc1b7 | 0)) | 0;
    return new SeededRandom(s === 0 ? 1 : s);
  }
}
