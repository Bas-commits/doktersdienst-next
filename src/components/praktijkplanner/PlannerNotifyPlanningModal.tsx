'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function PlannerNotifyPlanningModal({
  open,
  onClose,
  groupId,
  participantId,
  participantName,
}: {
  open: boolean;
  onClose: () => void;
  groupId: number;
  participantId: number;
  participantName: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSend() {
    setSubmitting(true);
    try {
      const response = await fetch('/api/praktijkplanner/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'notify',
          plannerType: 'activiteiten',
          idwaarneemgroep: groupId,
          iddeelnemer: participantId,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'E-mail versturen mislukt.');
      toast.success('E-mail verstuurd.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'E-mail versturen mislukt.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notify-planning-modal-title"
      onClick={onClose}
      data-testid="notify-planning-modal"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="notify-planning-modal-title" className="mb-2 text-lg font-semibold tracking-tight">
          Planning per e-mail melden
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Stuur {participantName} een e-mail dat er een nieuwe planning beschikbaar is in de
          Praktijkplanner, met een verzoek om deze te bekijken?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuleren
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={submitting}
            data-testid="notify-planning-confirm"
            className="border-[#c91b23] bg-[#c91b23] text-white hover:bg-[#a8161d] hover:text-white"
          >
            {submitting ? 'Versturen…' : 'E-mail versturen'}
          </Button>
        </div>
      </div>
    </div>
  );
}
