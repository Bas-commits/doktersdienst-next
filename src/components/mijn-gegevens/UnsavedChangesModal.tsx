'use client';

import { Button } from '@/components/ui/button';

interface UnsavedChangesModalProps {
  open: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onLeaveWithoutSaving: () => void;
  onSaveAndLeave: () => void;
}

export function UnsavedChangesModal({
  open,
  isSubmitting = false,
  onCancel,
  onLeaveWithoutSaving,
  onSaveAndLeave,
}: UnsavedChangesModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-modal-title"
      onClick={onCancel}
      data-testid="unsaved-changes-modal"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="unsaved-changes-modal-title" className="mb-2 text-lg font-semibold tracking-tight">
          Niet-opgeslagen wijzigingen
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          U heeft niet-opgeslagen wijzigingen. Wilt u deze opslaan voordat u verder gaat?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="unsaved-changes-cancel"
          >
            Annuleren
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onLeaveWithoutSaving}
            disabled={isSubmitting}
            data-testid="unsaved-changes-leave"
          >
            Verlaten zonder opslaan
          </Button>
          <Button
            type="button"
            onClick={onSaveAndLeave}
            disabled={isSubmitting}
            className="font-bold text-white"
            data-testid="unsaved-changes-save"
            style={{
              background: 'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(90deg, rgb(56, 19, 108) 0%, rgb(45, 34, 69) 100%)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'linear-gradient(90deg, rgb(79, 27, 153) 0%, rgb(45, 34, 69) 100%)';
            }}
          >
            {isSubmitting ? 'Opslaan…' : 'Opslaan en verlaten'}
          </Button>
        </div>
      </div>
    </div>
  );
}
