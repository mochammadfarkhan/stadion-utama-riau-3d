import { describe, it, expect } from 'vitest';
import { readCommand } from '../src/entities/Bicycle.js';

describe('readCommand (R14)', () => {
  it('sumbu analog menang atas tombol; steer = -moveX', () => {
    const input = { isDown: () => false, axis: (n) => ({ moveX: 0.5, moveY: 0.3 })[n] };
    expect(readCommand(input)).toEqual({ pedal: 0.3, steer: -0.5, sprint: false });
  });
  it('tombol W tanpa sumbu = pedal 1', () => {
    const input = { isDown: (c) => c === 'KeyW', axis: () => 0 };
    expect(readCommand(input).pedal).toBe(1);
  });
});
