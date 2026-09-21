import { paginated } from '@erp/shared-contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ptBRTranslations } from '../i18n/pt-BR';
import { renderWithShell } from '../testing';
import { ConfirmDialog } from './confirm-dialog';
import { DataTable } from './data-table';
import { EmptyState } from './empty-state';
import { Form, FormActions, FormField, useZodForm } from './form';

interface Linha {
  readonly nome: string;
  readonly horas: string;
}

const COLUNAS: ColumnDef<Linha, unknown>[] = [
  { accessorKey: 'nome', header: 'Nome' },
  { accessorKey: 'horas', header: 'Horas' },
];

function paginaDeLinhas(page: number, total: number) {
  const items: Linha[] = Array.from(
    { length: Math.min(2, total - (page - 1) * 2) },
    (_, index) => ({
      nome: `Linha ${(page - 1) * 2 + index + 1}`,
      horas: '7.50',
    }),
  );
  return paginated(items, { page, pageSize: 2 }, total);
}

describe('F0-13 tabela paginada', () => {
  it('desenha só a página recebida e resume o intervalo', async () => {
    renderWithShell(
      <DataTable columns={COLUNAS} page={paginaDeLinhas(1, 5)} onPageChange={vi.fn()} />,
    );

    expect(await screen.findByText('Linha 1')).toBeDefined();
    expect(screen.getByText('Linha 2')).toBeDefined();
    expect(screen.queryByText('Linha 3')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('1–2 de 5');
  });

  it('pede a próxima página ao clicar em avançar', async () => {
    const onPageChange = vi.fn();
    renderWithShell(
      <DataTable columns={COLUNAS} page={paginaDeLinhas(1, 5)} onPageChange={onPageChange} />,
    );

    await userEvent.click(await screen.findByRole('button', { name: ptBRTranslations.table.next }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('desabilita a navegação nos limites', async () => {
    renderWithShell(
      <DataTable columns={COLUNAS} page={paginaDeLinhas(3, 5)} onPageChange={vi.fn()} />,
    );

    const anterior = await screen.findByRole('button', { name: ptBRTranslations.table.previous });
    const proxima = screen.getByRole('button', { name: ptBRTranslations.table.next });
    expect(anterior).toHaveProperty('disabled', false);
    expect(proxima).toHaveProperty('disabled', true);
  });

  it('cai no estado vazio quando não há resultado', async () => {
    renderWithShell(
      <DataTable columns={COLUNAS} page={paginaDeLinhas(1, 0)} onPageChange={vi.fn()} />,
    );

    expect(await screen.findByText(ptBRTranslations.table.empty)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('F0-13 estado vazio', () => {
  it('usa os textos padrão em pt-BR', async () => {
    renderWithShell(<EmptyState />);

    expect(
      await screen.findByRole('heading', { name: ptBRTranslations.empty.title }),
    ).toBeDefined();
    expect(screen.getByText(ptBRTranslations.empty.description)).toBeDefined();
  });
});

describe('F0-13 diálogo de confirmação', () => {
  function DialogoDeTeste({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(true);
    return <ConfirmDialog open={open} onOpenChange={setOpen} onConfirm={onConfirm} destructive />;
  }

  it('confirma a ação e fecha', async () => {
    const onConfirm = vi.fn();
    renderWithShell(<DialogoDeTeste onConfirm={onConfirm} />);

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo.textContent).toContain(ptBRTranslations.confirm.title);

    await userEvent.click(screen.getByRole('button', { name: ptBRTranslations.confirm.confirm }));

    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('cancelar fecha sem executar a ação', async () => {
    const onConfirm = vi.fn();
    renderWithShell(<DialogoDeTeste onConfirm={onConfirm} />);

    await userEvent.click(
      await screen.findByRole('button', { name: ptBRTranslations.confirm.cancel }),
    );

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('F0-13 formulário validado pelo schema zod', () => {
  const schema = z.object({
    nome: z.string().min(3, 'Informe ao menos 3 caracteres.'),
  });

  function FormularioDeTeste({ onSubmit }: { onSubmit: (values: { nome: string }) => void }) {
    const form = useZodForm(schema, { defaultValues: { nome: '' } });
    return (
      <Form form={form} onSubmit={onSubmit} label="Formulário de teste">
        <FormField name="nome" label="Nome" required />
        <FormActions />
      </Form>
    );
  }

  it('mostra a mensagem de erro em pt-BR e não envia', async () => {
    const onSubmit = vi.fn();
    renderWithShell(<FormularioDeTeste onSubmit={onSubmit} />);

    await userEvent.type(await screen.findByLabelText(/Nome/), 'ab');
    await userEvent.click(screen.getByRole('button', { name: ptBRTranslations.form.save }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Informe ao menos 3 caracteres.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia os valores quando o schema aceita', async () => {
    const onSubmit = vi.fn();
    renderWithShell(<FormularioDeTeste onSubmit={onSubmit} />);

    await userEvent.type(await screen.findByLabelText(/Nome/), 'Projeto Alfa');
    await userEvent.click(screen.getByRole('button', { name: ptBRTranslations.form.save }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ nome: 'Projeto Alfa' });
  });
});
