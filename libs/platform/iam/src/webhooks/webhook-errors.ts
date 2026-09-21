import { DomainError } from '@erp/shared-kernel';

export const WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID';

export class WebhookSignatureInvalidError extends DomainError {
  constructor(reason: string) {
    super(WEBHOOK_SIGNATURE_INVALID, 'Assinatura do webhook inválida.', { reason });
    this.name = 'WebhookSignatureInvalidError';
  }
}
