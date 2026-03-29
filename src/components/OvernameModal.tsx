import { useState } from 'react';
import type { ShiftBlockView } from '@/types/diensten';

export interface OvernameDoctor {
  id: number;
  voornaam: string;
  achternaam: string;
  initialen?: string;
}

export interface OvernameModalProps {
  /** The shift block that is being proposed for overname. */
  shift: ShiftBlockView;
  /** List of doctors in the waarneemgroep (excluding the proposing doctor). */
  doctors: OvernameDoctor[];
  /** Called when the user submits the proposal. */
  onSubmit: (data: {
    iddeelnovern: number;
    van: number;
    tot: number;
    isPartial: boolean;
  }) => void;
  /** Called when the user closes the modal. */
  onClose: () => void;
  /** Whether the submission is in progress. */
  submitting?: boolean;
  /** Error message to display. */
  error?: string | null;
}

export function OvernameModal({
  shift,
  doctors,
  onSubmit,
  onClose,
  submitting,
  error,
}: OvernameModalProps) {
  const [selectedDoctor, setSelectedDoctor] = useState<number | ''>('');
  const [isPartial, setIsPartial] = useState(false);
  const [partialStart, setPartialStart] = useState(shift.startTime);
  const [partialEnd, setPartialEnd] = useState(shift.endTime);
  const [validationError, setValidationError] = useState<string | null>(null);

  const shiftDate = new Date(shift.van * 1000);
  const dateStr = shiftDate.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function parseTimeToUnix(timeStr: string, baseDate: Date): number {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  function handleSubmit() {
    setValidationError(null);

    if (!selectedDoctor) {
      setValidationError('Selecteer een arts');
      return;
    }

    let van = shift.van;
    let tot = shift.tot;

    if (isPartial) {
      van = parseTimeToUnix(partialStart, shiftDate);
      tot = parseTimeToUnix(partialEnd, shiftDate);

      // Handle overnight shifts: if end < start, it means next day
      if (tot <= van) {
        tot += 24 * 60 * 60;
      }

      if (van < shift.van || tot > shift.tot) {
        setValidationError('Tijdvenster moet binnen de oorspronkelijke dienst vallen');
        return;
      }

      if (van >= tot) {
        setValidationError('Starttijd moet voor eindtijd liggen');
        return;
      }
    }

    onSubmit({
      iddeelnovern: Number(selectedDoctor),
      van,
      tot,
      isPartial,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Overname voorstel</h2>

        {/* Shift details */}
        <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm">
          <p className="font-medium">{dateStr}</p>
          <p className="text-gray-600">
            {shift.startTime} – {shift.endTime}
            {shift.label && <span className="ml-2">({shift.label})</span>}
          </p>
          {shift.middle && (
            <p className="text-gray-600">
              Arts: {shift.middle.name} ({shift.middle.shortName})
            </p>
          )}
        </div>

        {/* Doctor selector */}
        <label className="block text-sm font-medium mb-1">Overname naar arts</label>
        <select
          className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 text-sm"
          value={selectedDoctor}
          onChange={(e) => setSelectedDoctor(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Selecteer een arts…</option>
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.voornaam} {doc.achternaam}
              {doc.initialen ? ` (${doc.initialen})` : ''}
            </option>
          ))}
        </select>

        {/* Partial overname checkbox */}
        <label className="flex items-center gap-2 mb-4 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isPartial}
            onChange={(e) => setIsPartial(e.target.checked)}
            className="rounded border-gray-300"
          />
          Deels overname
        </label>

        {/* Time pickers for partial overname */}
        {isPartial && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Van</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={partialStart}
                onChange={(e) => setPartialStart(e.target.value)}
                min={shift.startTime}
                max={shift.endTime}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Tot</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={partialEnd}
                onChange={(e) => setPartialEnd(e.target.value)}
                min={shift.startTime}
                max={shift.endTime}
              />
            </div>
          </div>
        )}

        {/* Error messages */}
        {(validationError || error) && (
          <p className="text-red-600 text-sm mb-4">{validationError || error}</p>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Annuleren
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Bezig…' : 'Voorstel indienen'}
          </button>
        </div>
      </div>
    </div>
  );
}
