import { describe, expect, it } from 'vitest';
import { FixedClock, SystemClock } from './clock';

describe('F0-04 Clock', () => {
  it('SystemClock devolve o instante atual', () => {
    const antes = Date.now();
    const agora = new SystemClock().now().getTime();

    expect(agora).toBeGreaterThanOrEqual(antes);
    expect(agora).toBeLessThanOrEqual(Date.now());
  });

  it('FixedClock fica parado no instante dado', () => {
    const clock = new FixedClock('2026-03-10T12:00:00.000Z');

    expect(clock.now().toISOString()).toBe('2026-03-10T12:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });

  it('FixedClock anda e é reposicionado sob demanda', () => {
    const clock = new FixedClock('2026-03-10T12:00:00.000Z');

    clock.advanceBy(90_000);
    expect(clock.now().toISOString()).toBe('2026-03-10T12:01:30.000Z');

    clock.set('2027-01-01T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('FixedClock devolve cópia: mexer no Date recebido não move o relógio', () => {
    const clock = new FixedClock('2026-03-10T12:00:00.000Z');

    clock.now().setFullYear(1999);

    expect(clock.now().toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });
});
