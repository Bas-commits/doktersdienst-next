'use client';

export type PlannerViewMode = 'week' | 'month';

/**
 * De keuze tussen de week- en de maandweergave, met de maandnaam ernaast.
 *
 * De maandnaam staat alleen in de maandweergave, want in de week zegt de weekbalk al waar je
 * bent. Hij hoort hier en niet boven het rooster: de maandtabel heeft weeknummers en
 * dagnummers in zijn kop, maar nergens de maand zelf.
 */
export function PlannerViewModeSwitch({
  value,
  onChange,
  monthLabel,
}: {
  value: PlannerViewMode;
  onChange: (value: PlannerViewMode) => void;
  monthLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {value === 'month' ? <span className="text-sm font-semibold">{monthLabel}</span> : null}
      <div className="inline-flex overflow-hidden rounded-md border">
        {(['week', 'month'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            className={[
              'px-2 py-1 text-xs font-medium transition',
              value === mode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            ].join(' ')}
            onClick={() => onChange(mode)}
          >
            {mode === 'week' ? 'Week' : 'Maand'}
          </button>
        ))}
      </div>
    </div>
  );
}
