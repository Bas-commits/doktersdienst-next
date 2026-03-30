import { useState } from 'react';
import type { ShiftBlockView, DoctorInfo } from '@/types/diensten';

export interface OvernameDetailModalProps {
  block: ShiftBlockView;
  onRespond: (action: 'accept' | 'decline' | 'delete') => void;
  /** Called when user wants to delete the declined proposal and create a new one. */
  onRecreate?: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}

function DoctorBadge({ doctor, label }: { doctor: DoctorInfo | null | undefined; label: string }) {
  if (!doctor) return null;
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: doctor.color || '#94a3b8' }}
      >
        {doctor.shortName}
      </span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium">{doctor.name}</p>
      </div>
    </div>
  );
}

export function OvernameDetailModal({
  block,
  onRespond,
  onRecreate,
  onClose,
  submitting,
  error,
}: OvernameDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onRespond('delete');
  };

  const shiftDate = new Date(block.van * 1000);
  const dateStr = shiftDate.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const statusLabel =
    block.overnameType === 'voorstelOvername' ? 'In afwachting' :
    block.overnameType === 'vraagtekenOvername' ? 'Afgewezen' :
    block.overnameType === 'overname' ? 'Geaccepteerd' : '';

  const statusColor =
    block.overnameType === 'voorstelOvername' ? 'bg-orange-100 text-orange-800' :
    block.overnameType === 'vraagtekenOvername' ? 'bg-red-100 text-red-800' :
    block.overnameType === 'overname' ? 'bg-green-100 text-green-800' : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Overname details</h2>
          {statusLabel && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
          )}
        </div>

        {/* Shift details */}
        <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm">
          <p className="font-medium">{dateStr}</p>
          <p className="text-gray-600">{block.startTime} – {block.endTime}</p>
        </div>

        {/* Doctor info */}
        <div className="space-y-3 mb-4">
          <DoctorBadge doctor={block.originalDoctor} label="Van arts (origineel)" />
          <DoctorBadge doctor={block.middle} label="Naar arts (overname)" />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-800 font-medium">Weet je zeker dat je deze overname wilt verwijderen?</p>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                onClick={() => onRespond('delete')}
                disabled={submitting}
              >
                {submitting ? 'Bezig...' : 'Ja, verwijderen'}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={() => setConfirmDelete(false)}
                disabled={submitting}
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Sluiten
          </button>

          {block.overnameType === 'voorstelOvername' && (
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                onClick={handleDelete}
                disabled={submitting}
              >
                Verwijderen
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50"
                onClick={() => onRespond('decline')}
                disabled={submitting}
              >
                {submitting ? 'Bezig...' : 'Afwijzen'}
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                onClick={() => onRespond('accept')}
                disabled={submitting}
              >
                {submitting ? 'Bezig...' : 'Accepteren'}
              </button>
            </>
          )}

          {block.overnameType === 'vraagtekenOvername' && (
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                onClick={handleDelete}
                disabled={submitting}
              >
                Verwijderen
              </button>
              {onRecreate && (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  onClick={onRecreate}
                  disabled={submitting}
                >
                  Opnieuw voorstellen
                </button>
              )}
            </>
          )}

          {block.overnameType === 'overname' && (
            <button
              type="button"
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              onClick={handleDelete}
              disabled={submitting}
            >
              Verwijderen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
