import { createHash } from 'crypto';

/**
 * Deterministic Fisher-Yates shuffle seeded by a string.
 * Uses MD5 hash of the seed to derive a sequence of pseudo-random
 * values so the same seed always produces the same ordering.
 */
export function deterministicShuffle(items: string[], seed: string): string[] {
  const arr = [...items];
  let hashInput = seed;
  const randomValues: number[] = [];

  while (randomValues.length < arr.length) {
    const hash = createHash('md5').update(hashInput).digest();
    for (let i = 0; i < hash.length - 3 && randomValues.length < arr.length; i += 4) {
      randomValues.push(hash.readUInt32BE(i));
    }
    hashInput = hash.toString('hex');
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}
