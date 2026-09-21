import { describe, expect, it } from 'vitest';
import { isEntityId, newId } from './ids';

describe('F0-04 identificadores', () => {
  it('gera uuid v7', () => {
    const id = newId();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isEntityId(id)).toBe(true);
  });

  it('não repete', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));

    expect(ids.size).toBe(1000);
  });

  it('cresce em ordem temporal, o que mantém o índice do Postgres compacto', () => {
    const ids = Array.from({ length: 50 }, () => newId());

    expect([...ids].sort()).toEqual(ids);
  });

  it('recusa o que não for uuid v7', () => {
    expect(isEntityId('não é uuid')).toBe(false);
    // uuid v4 válido, mas versão errada
    expect(isEntityId('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')).toBe(false);
  });
});
