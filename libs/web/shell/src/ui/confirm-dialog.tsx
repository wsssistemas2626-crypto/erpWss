import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Padrão: "Confirmar ação". */
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Pode ser assíncrono: o botão fica desabilitado enquanto a promessa não resolve. */
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmação de ação destrutiva. Os textos padrão vêm do i18n (CLAUDE.md §5); quem
 * chama sobrescreve com o texto específico da ação.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm(): Promise<void> {
    setConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? t('confirm.title')}</DialogTitle>
          <DialogDescription>{description ?? t('confirm.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {cancelLabel ?? t('confirm.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void handleConfirm()}
            disabled={confirming}
          >
            {confirmLabel ?? t('confirm.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
