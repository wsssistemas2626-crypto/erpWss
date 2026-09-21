import { describe, expect, it } from 'vitest';
import { AuditRegistry, DEFAULT_PII_FIELDS } from './audit-registry';
import { PII_PREFIX, maskPii, maskValue } from './masking';

describe('F0-09 mascaramento de PII', () => {
  const pii = new Set(['email', 'cpf']);

  it('troca o valor por um resumo, não por um marcador fixo', () => {
    const mascarado = maskValue('pessoa@example.com');

    expect(mascarado.startsWith(PII_PREFIX)).toBe(true);
    expect(mascarado).not.toContain('pessoa');
    // o mesmo valor gera o mesmo resumo: dá para responder "mudou?" sem guardar o dado
    expect(maskValue('pessoa@example.com')).toBe(mascarado);
    expect(maskValue('outra@example.com')).not.toBe(mascarado);
  });

  it('mascara os campos declarados e preserva os demais', () => {
    const resultado = maskPii({ name: 'Ana', email: 'ana@example.com', age: 30 }, pii);

    expect(resultado).toMatchObject({ name: 'Ana', age: 30 });
    expect(String(resultado?.email)).toMatch(/^pii:/);
  });

  it('alcança objetos aninhados e listas', () => {
    const resultado = maskPii(
      { partner: { cpf: '52998224725' }, contacts: [{ email: 'a@b.com' }] },
      pii,
    );

    const partner = resultado?.partner as Record<string, unknown>;
    const contacts = resultado?.contacts as Record<string, unknown>[];
    expect(String(partner.cpf)).toMatch(/^pii:/);
    expect(String(contacts[0]?.email)).toMatch(/^pii:/);
  });

  it('trata nulo e ausente sem quebrar', () => {
    expect(maskPii(null, pii)).toBeNull();
    expect(maskPii(undefined, pii)).toBeNull();
    expect(maskValue(null)).toBe(`${PII_PREFIX}null`);
  });
});

describe('F0-09 registro de entidades auditadas', () => {
  it('soma os campos declarados aos nomes sempre mascarados', () => {
    const registry = new AuditRegistry();
    registry.register([{ module: 'partners', entity: 'partner', piiFields: ['tradeName'] }]);

    const campos = registry.piiFieldsOf('partners', 'partner');

    expect(campos.has('tradeName')).toBe(true);
    for (const padrao of DEFAULT_PII_FIELDS) {
      expect(campos.has(padrao)).toBe(true);
    }
  });

  it('entidade não declarada ainda recebe os nomes sempre mascarados', () => {
    const registry = new AuditRegistry();

    expect(registry.piiFieldsOf('projects', 'work_item').has('email')).toBe(true);
  });
});
