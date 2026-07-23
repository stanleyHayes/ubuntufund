export class TrustScore {
  readonly value: number;

  static readonly MIN = 0;
  static readonly MAX = 100;
  static readonly DEFAULT = 50;

  constructor(value: number) {
    if (value < TrustScore.MIN || value > TrustScore.MAX) {
      throw new Error(
        `Trust score must be between ${TrustScore.MIN} and ${TrustScore.MAX}, got ${value}`
      );
    }
    this.value = Math.round(value);
  }

  static default(): TrustScore {
    return new TrustScore(TrustScore.DEFAULT);
  }

  increase(points: number): TrustScore {
    return new TrustScore(Math.min(this.value + points, TrustScore.MAX));
  }

  decrease(points: number): TrustScore {
    return new TrustScore(Math.max(this.value - points, TrustScore.MIN));
  }

  isAbove(threshold: number): boolean {
    return this.value > threshold;
  }

  equals(other: TrustScore): boolean {
    return this.value === other.value;
  }
}
