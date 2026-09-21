import { zodResolver } from '@hookform/resolvers/zod';
import { useId, type ReactNode } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldValues,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ZodType } from 'zod';
import { Button } from './button';
import { cn } from './cn';
import { Input } from './input';

/**
 * Formulário validado pelo mesmo schema zod que o backend usa (CLAUDE.md §5):
 * o contrato de `@erp/shared-contracts` entra aqui sem tradução nenhuma.
 */
export function useZodForm<TValues extends FieldValues>(
  schema: ZodType<TValues, TValues>,
  options?: Omit<UseFormProps<TValues>, 'resolver'>,
): UseFormReturn<TValues> {
  return useForm<TValues>({ ...options, resolver: zodResolver(schema) });
}

export interface FormProps<TValues extends FieldValues, TTransformed extends FieldValues> {
  form: UseFormReturn<TValues, unknown, TTransformed>;
  onSubmit: SubmitHandler<TTransformed>;
  children: ReactNode;
  className?: string;
  /** Rótulo acessível do formulário, já em pt-BR. */
  label?: string;
}

export function Form<TValues extends FieldValues, TTransformed extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  label,
}: FormProps<TValues, TTransformed>) {
  return (
    <FormProvider {...form}>
      {/* `noValidate`: quem valida é o zod, com mensagem em pt-BR, não o navegador. */}
      <form
        noValidate
        aria-label={label}
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        className={cn('flex flex-col gap-4', className)}
      >
        {children}
      </form>
    </FormProvider>
  );
}

export interface FormFieldProps {
  /** Nome do campo no schema. */
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'password';
  placeholder?: string;
  description?: string;
  required?: boolean;
}

/** Campo de texto com rótulo, descrição e a mensagem de erro do zod. */
export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  description,
  required = false,
}: FormFieldProps) {
  const { t } = useTranslation();
  const { register, formState } = useFormContext();
  const id = useId();
  const error = formState.errors[name];
  const message = typeof error?.message === 'string' ? error.message : undefined;
  const describedBy = [
    description === undefined ? null : `${id}-description`,
    message === undefined ? null : `${id}-error`,
  ]
    .filter((value): value is string => value !== null)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="pl-1 text-destructive" title={t('form.requiredMark')} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={message !== undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        {...register(name)}
      />
      {description !== undefined && (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {message !== undefined && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

export interface FormActionsProps {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function FormActions({
  submitLabel,
  cancelLabel,
  onCancel,
  isSubmitting = false,
}: FormActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end gap-2">
      {onCancel !== undefined && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {cancelLabel ?? t('form.cancel')}
        </Button>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('form.saving') : (submitLabel ?? t('form.save'))}
      </Button>
    </div>
  );
}
