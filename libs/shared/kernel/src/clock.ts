/**
 * Fonte de tempo injetável. Nenhum código de domínio chama `new Date()` direto:
 * sem isso não dá para testar regra que depende de data.
 */
export interface Clock {
  /** Instante atual. Sempre em UTC — o fuso é problema da apresentação. */
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Relógio parado, para teste. */
export class FixedClock implements Clock {
  private instant: Date;

  constructor(instant: Date | string) {
    this.instant = new Date(instant);
  }

  now(): Date {
    return new Date(this.instant);
  }

  set(instant: Date | string): void {
    this.instant = new Date(instant);
  }

  advanceBy(milliseconds: number): void {
    this.instant = new Date(this.instant.getTime() + milliseconds);
  }
}
