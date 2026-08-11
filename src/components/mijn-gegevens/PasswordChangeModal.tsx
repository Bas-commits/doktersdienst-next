'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getStrongPasswordFailures, strongPasswordRules } from '@/lib/password-policy';

interface PasswordChangeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /**
   * Waar bij je eigen account. Onwaar voor de beheerder die een ander helpt:
   * die kent het huidige wachtwoord niet, en dat is juist waarom hij gebeld is.
   */
  vraagHuidigWachtwoord?: boolean;
  /** Gezet als de beheerder het wachtwoord van een andere deelnemer zet. */
  deelnemerId?: number | null;
}

export function PasswordChangeModal({
  open,
  onClose,
  onSuccess,
  vraagHuidigWachtwoord = true,
  deelnemerId = null,
}: PasswordChangeModalProps) {
  const [huidig, setHuidig] = useState('');
  const [passa, setPassa] = useState('');
  const [passb, setPassb] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openstaandeRegels = getStrongPasswordFailures(passa);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (vraagHuidigWachtwoord && !huidig) {
      setError('Vul uw huidige wachtwoord in');
      return;
    }
    if (!passa) {
      setError('Vul een nieuw wachtwoord in');
      return;
    }
    if (openstaandeRegels.length > 0) {
      setError(`Kies een sterker wachtwoord. Vereist: ${openstaandeRegels
        .map((r) => r.label)
        .join('; ')}.`);
      return;
    }
    if (passa !== passb) {
      setError('Nieuw password en herhaling komen niet overeen');
      return;
    }
    setIsSubmitting(true);
    const url = deelnemerId != null ? `/api/mijn-gegevens?deelnemerId=${deelnemerId}` : '/api/mijn-gegevens';
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        passa,
        passb,
        ...(vraagHuidigWachtwoord ? { huidigWachtwoord: huidig } : {}),
      }),
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? 'Wachtwoord wijzigen mislukt');
      return;
    }
    leegmaken();
    onSuccess?.();
    onClose();
  }

  function leegmaken() {
    setHuidig('');
    setPassa('');
    setPassb('');
  }

  function handleClose() {
    leegmaken();
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
          {vraagHuidigWachtwoord && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="modal-huidig">Huidig wachtwoord</Label>
              <Input
                id="modal-huidig"
                type="password"
                value={huidig}
                onChange={(e) => setHuidig(e.target.value)}
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>
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
              aria-describedby="modal-wachtwoordregels"
            />
          </div>
          {/* De regels staan er altijd, ook voor een leeg veld. Ze pas tonen als
              het misgaat maakt van een bekende eis een verrassing achteraf. */}
          <ul id="modal-wachtwoordregels" className="flex flex-col gap-0.5 text-xs">
            {strongPasswordRules.map((regel) => {
              const gehaald = regel.ok(passa);
              return (
                <li
                  key={regel.id}
                  className={
                    gehaald
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  }
                >
                  {gehaald ? '✓' : '•'} {regel.label}
                </li>
              );
            })}
          </ul>
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
