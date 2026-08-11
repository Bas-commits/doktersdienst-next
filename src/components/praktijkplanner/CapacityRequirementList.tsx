import type { PraktijkplannerCapacityComparison } from '@/types/praktijkplanner';

export type CapacityRequirementItem = {
  id: number;
  label: string;
};

export type CapacityRequirementSection = {
  key: string;
  title: string;
  items: CapacityRequirementItem[];
};

const STATUS_CLASS: Record<PraktijkplannerCapacityComparison['status'], string> = {
  groen: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  oranje: 'bg-amber-100 text-amber-800 ring-amber-300',
  rood: 'bg-red-100 text-red-800 ring-red-300',
};

type EditableProps = {
  mode: 'edit';
  aantalDeelnemers: number;
  onAantalDeelnemersChange: (value: number) => void;
  sections: CapacityRequirementSection[];
  getValue: (sectionKey: string, itemId: number) => number;
  onValueChange: (sectionKey: string, itemId: number, value: number) => void;
  /**
   * De normale week, als er een regime wordt bewerkt.
   *
   * Een regime vervangt de normale week, dus na het invullen is niet meer te zien wat er is
   * weggehaald. Dit zet de normale waarde en het verschil erbij.
   */
  normaal?: {
    aantalDeelnemers: number;
    getValue: (sectionKey: string, itemId: number) => number;
  };
};

type StatusProps = {
  mode: 'status';
  totaal: PraktijkplannerCapacityComparison;
  sections: Array<{
    key: string;
    title: string;
    items: PraktijkplannerCapacityComparison[];
  }>;
};

type CapacityRequirementListProps = EditableProps | StatusProps;

function NumberInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      className="h-6 w-12 shrink-0 rounded border bg-background px-1 text-right text-xs tabular-nums"
    />
  );
}

/**
 * De normale waarde bij een eis in een regime, met het verschil erachter.
 *
 * Staat er niets in het regime en ook niets in de normale week, dan valt de regel weg: een
 * cel met bij elke eis "normaal 0" is niet te lezen en zegt niets.
 */
function NormaalHint({ waarde, normaal }: { waarde: number; normaal: number }) {
  if (waarde === 0 && normaal === 0) return null;
  const verschil = waarde - normaal;
  return (
    <span className="block text-right text-[10px] leading-tight text-muted-foreground tabular-nums">
      normaal {normaal}
      {verschil === 0 ? '' : `, ${verschil > 0 ? '+' : ''}${verschil}`}
    </span>
  );
}

function StatusBadge({ comparison }: { comparison: PraktijkplannerCapacityComparison }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ${STATUS_CLASS[comparison.status]}`}
    >
      {comparison.gepland}/{comparison.benodigd}
    </span>
  );
}

export function CapacityRequirementList(props: CapacityRequirementListProps) {
  if (props.mode === 'edit') {
    const { aantalDeelnemers, onAantalDeelnemersChange, sections, getValue, onValueChange, normaal } =
      props;
    return (
      <div className="min-w-[140px] space-y-1.5 text-xs">
        <div>
          <label className="flex items-center justify-between gap-2 font-medium">
            <span>Aantal dokters:</span>
            <NumberInput
              value={aantalDeelnemers}
              onChange={onAantalDeelnemersChange}
              ariaLabel="Aantal dokters"
            />
          </label>
          {normaal ? (
            <NormaalHint waarde={aantalDeelnemers} normaal={normaal.aantalDeelnemers} />
          ) : null}
        </div>
        {sections.map((section) =>
          section.items.length === 0 ? null : (
            <div key={section.key} className="space-y-1 border-t border-border/60 pt-1.5">
              <p className="font-semibold text-muted-foreground">{section.title}</p>
              {section.items.map((item) => (
                <div key={item.id}>
                  <label className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    <NumberInput
                      value={getValue(section.key, item.id)}
                      onChange={(value) => onValueChange(section.key, item.id, value)}
                      ariaLabel={`${section.title} ${item.label}`}
                    />
                  </label>
                  {normaal ? (
                    <NormaalHint
                      waarde={getValue(section.key, item.id)}
                      normaal={normaal.getValue(section.key, item.id)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    );
  }

  const { totaal, sections } = props;
  return (
    <div className="min-w-[140px] space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-2 font-medium">
        <span>Aantal dokters:</span>
        <StatusBadge comparison={totaal} />
      </div>
      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <div key={section.key} className="space-y-1 border-t border-border/60 pt-1.5">
            <p className="font-semibold text-muted-foreground">{section.title}</p>
            {section.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2">
                <span className="truncate">{item.label}</span>
                <StatusBadge comparison={item} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
