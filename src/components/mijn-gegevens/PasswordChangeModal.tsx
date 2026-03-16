'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordChangeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PasswordChangeModal({ open, onClose, onSuccess }: PasswordChangeModalProps) {
  const [passa, setPassa] = useState('');
  const [passb, setPassb] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (passa !== passb) {
      setError('Nieuw password en herhaling komen niet overeen');
      return;
    }
    if (!passa.trim()) {
      setError('Vul een nieuw wachtwoord in');
      return;
    }
    setIsSubmitting(true);
    const res = await fetch('/api/mijn-gegevens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ passa: passa.trim(), passb: passb.trim() }),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? 'Wachtwoord wijzigen mislukt');
      return;
    }
    setPassa('');
    setPassb('');
    onSuccess?.();
    onClose();
  }

  function handleClose() {
    setPassa('');
    setPassb('');
    setError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-modal-title"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-card p-4 shadow-lg ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="password-modal-title" className="text-lg font-semibold tracking-tight">
          Wachtwoord wijzigen
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="modal-passa">Nieuw wachtwoord</Label>
            <Input
              id="modal-passa"
              type="password"
              value={passa}
              onChange={(e) => setPassa(e.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="modal-passb">Nieuw wachtwoord herhalen</Label>
            <Input
              id="modal-passb"
              type="password"
              value={passb}
              onChange={(e) => setPassb(e.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
