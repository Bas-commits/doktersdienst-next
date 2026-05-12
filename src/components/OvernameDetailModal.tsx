import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { FaRedo } from 'react-icons/fa';
import { toast } from 'sonner';
import { OVERNAME_ACTION_FORBIDDEN_TOAST } from '@/lib/overname-ui-access';
import type { ShiftBlockView, DoctorInfo } from '@/types/diensten';

export interface OvernameDetailModalProps {
  block: ShiftBlockView;
  onRespond: (action: 'accept' | 'decline' | 'delete') => void;
  /** Called when user wants to delete the declined proposal and create a new one. */
  onRecreate?: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
  /** Accept / decline (pending voorstel). Defaults to true when omitted (back-compat). */
  canRespondPending?: boolean;
  /** Delete, redo, trash, confirm delete. Defaults to true when omitted. */
  canManageProposalLifecycle?: boolean;
}

function DoctorRow({ doctor, label }: { doctor: DoctorInfo | null | undefined; label: string }) {
  if (!doctor) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold w-[35px]">{label}</p>
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white"
          style={{ backgroundColor: doctor.color || '#94a3b8' }}
        >
          {doctor.shortName}
        </span>
        <div>
          <p className="font-medium leading-tight">{doctor.name}</p>
        </div>
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
  canRespondPending = true,
  canManageProposalLifecycle = true,
}: OvernameDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalZIndex = 2000;

  const inactiveRespondClass = !canRespondPending ? 'opacity-40 cursor-not-allowed' : '';

  const inactiveLifecycleClass =
    !canManageProposalLifecycle ? 'opacity-40 cursor-not-allowed' : '';

  const handleDelete = () => {
    if (!canManageProposalLifecycle) {
      toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onRespond('delete');
  };

  const confirmFinalizeDelete = () => {
    if (!canManageProposalLifecycle) {
      toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
      return;
    }
    onRespond('delete');
  };

  const onAcceptClick = () => {
    if (!canRespondPending) {
      toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
      return;
    }
    onRespond('accept');
  };

  const onDeclineClick = () => {
    if (!canRespondPending) {
      toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
      return;
    }
    onRespond('decline');
  };

  const vanDt = new Date(block.van * 1000);
  const totDt = new Date(block.tot * 1000);
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const vanDatum = vanDt.toLocaleDateString('nl-NL', dateOpts);
  const totDatum = totDt.toLocaleDateString('nl-NL', dateOpts);

  const isDeclined = block.overnameType === 'vraagtekenOvername';
  const isPending = block.overnameType === 'voorstelOvername';
  const redoTitle = isDeclined
    ? 'Opnieuw voorstellen'
    : 'Een overname moet eerst worden afgewezen voordat je opnieuw kunt voorstellen';

  const statusLabel =
    block.overnameType === 'voorstelOvername' ? 'In afwachting' :
    block.overnameType === 'vraagtekenOvername' ? 'Afgewezen' :
    block.overnameType === 'overname' ? 'Geaccepteerd' : '';

  const statusColor =
    block.overnameType === 'voorstelOvername' ? 'bg-orange-100 text-orange-800' :
    block.overnameType === 'vraagtekenOvername' ? 'bg-red-100 text-red-800' :
    block.overnameType === 'overname' ? 'bg-green-100 text-green-800' : '';

  const overnameTypeLabel = block.isPartial ? 'Overname gedeelte dienst' : 'Overname volledige dienst';

  const redoEnabled = Boolean(isDeclined && onRecreate);

  const handleRedoClick = () => {
    if (submitting) return;
    if (!canManageProposalLifecycle) {
      toast.warning(OVERNAME_ACTION_FORBIDDEN_TOAST);
      return;
    }
    if (redoEnabled && onRecreate) {
      onRecreate();
      return;
    }
    toast.info('Opnieuw toewijzen kan alleen nadat een voorstel is afgewezen');
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: modalZIndex }}
      onClick={onClose}
    >
      <div
        className="relative w-[320px] bg-white border border-gray-300 rounded-lg shadow-lg p-4 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            type="button"
            className="p-1 bg-transparent border-0 cursor-pointer text-gray-600 hover:text-gray-900 rounded-md disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-200 rounded-md p-5 -mt-1">
          <div className="w-full flex justify-between mb-3">
            {/* <div className="flex flex-1" /> */}
            <button
              type="button"
              className={`flex flex-1 justify-center bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 ${inactiveLifecycleClass}`}
              onClick={handleDelete}
              disabled={submitting}
              aria-label="Verwijderen"
            >
              <Trash2 className="w-8 h-8 text-red-500" />
            </button>
            <div className="flex flex-1 justify-center items-center">
              <button
                type="button"
                className={`bg-transparent border-0 p-0 flex items-center justify-center ${redoEnabled ? 'cursor-pointer' : 'cursor-not-allowed'} disabled:opacity-50 ${inactiveLifecycleClass}`}
                onClick={handleRedoClick}
                disabled={submitting}
                aria-label="Opnieuw voorstellen"
                aria-disabled={!redoEnabled}
                title={redoTitle}
              >
                <FaRedo className={`w-6 h-6 ${redoEnabled ? 'text-blue-500' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{overnameTypeLabel}</p>
            {statusLabel ? (
              <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${statusColor}`}>
                {statusLabel}
              </span>
            ) : null}
          </div>

          <div className="flex text-sm mb-3">
            <p className="mb-1">
              Van: <br /> Tot:
            </p>
            <p className="mb-1 ml-2">
              {vanDatum} <strong>{block.startTime}</strong>{' '}
              <br /> {totDatum} <strong>{block.endTime}</strong>
            </p>
          </div>

          <div className="space-y-3 mb-4 text-sm">
            <DoctorRow doctor={block.originalDoctor} label="Van:" />
            <DoctorRow doctor={block.middle} label="Naar:" />
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-3" role="alert">
              {error}
            </p>
          )}

          {confirmDelete && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800 font-medium">
                Weet je zeker dat je deze overname wilt verwijderen?
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  onClick={confirmFinalizeDelete}
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

          {isPending ? (
            <div className="flex justify-center gap-4">
              <button
                type="button"
                className={`flex cursor-pointer items-center justify-center h-10 px-10 rounded-md border border-gray-300 bg-white hover:bg-green-300 disabled:opacity-50 ${inactiveRespondClass}`}
                onClick={onAcceptClick}
                aria-label="Verzoek accepteren"
                data-testid="overname-accept"
                disabled={submitting}
              >
                <Check className="w-6 h-6 text-[#333]" />
              </button>
              <button
                type="button"
                className={`flex cursor-pointer items-center justify-center h-10 px-10 rounded-md border border-gray-300 bg-white hover:bg-red-300 disabled:opacity-50 ${inactiveRespondClass}`}
                onClick={onDeclineClick}
                aria-label="Verzoek afwijzen"
                data-testid="overname-decline"
                disabled={submitting}
              >
                <X className="w-6 h-6 text-[#333]" />
              </button>
            </div>
          ) : null}

          {isDeclined ? (
            <div className="flex justify-center gap-4">
              <button
                type="button"
                className={`flex cursor-pointer items-center justify-center h-10 px-6 rounded-md border border-gray-300 bg-white text-sm hover:bg-red-300 disabled:opacity-50 ${inactiveLifecycleClass}`}
                onClick={handleDelete}
                aria-label="Afgewezen verzoek verwijderen"
                data-testid="overname-delete"
                disabled={submitting}
              >
                <Trash2 className="w-5 h-5 text-[#333] mr-1" /> Verwijderen
              </button>
            </div>
          ) : null}

          {!isPending && !isDeclined && block.overnameType === 'overname' ? (
            <div className="flex justify-center gap-4">
              <button
                type="button"
                className={`flex cursor-pointer items-center justify-center h-10 px-6 rounded-md border border-gray-300 bg-white text-sm hover:bg-red-300 disabled:opacity-50 ${inactiveLifecycleClass}`}
                onClick={handleDelete}
                aria-label="Overname verwijderen"
                data-testid="overname-delete"
                disabled={submitting}
              >
                <Trash2 className="w-5 h-5 text-[#333] mr-1" /> Verwijderen
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
