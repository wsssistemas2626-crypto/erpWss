/**
 * Superfície pública de @erp/platform-iam/testing.
 * Só para testes: provedor de identidade com chave local, sem rede (ADR-004).
 */
export {
  FAKE_AUTHORIZED_PARTY,
  FakeIdentityProvider,
  type FakeTokenOptions,
} from './fake-identity-provider';
