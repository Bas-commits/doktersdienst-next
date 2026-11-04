# Dienst Types Reference

This file documents the `diensten.type` values used in this codebase.

## Assignment Types (Rooster)

| Type | Name | Stripe / Usage | Notes |
|---|---|---|---|
| `1` | Base Slot | Anchor row (no stripe) | Defines the slot boundaries (`van`/`tot`). |
| `0` | Standaard | Middle stripe | Regular assigned doctor. |

| `5` | Achterwacht | Top stripe | Backup/on-call doctor. |
| `11` | Extra Dokter | Bottom stripe | **Authoritative Extra Dokter assignment type.** |

## Overname Types

| Type | Name | Usage | Notes |
|---|---|---|---|
| `4` | Overname voorstel | Overlay | Distinguished from legacy `4` by non-`NULL` `status` (`pending`/`declined`). |
| `6` | Overname accepted | Overlay | Distinguished from legacy `6` by `status='accepted'`. |

## Preference Types (Voorkeuren)

| Type | Name | Usage |
|---|---|---|
| `2` | Liever niet | Preference chip |
| `3` | Liever wel | Preference chip |
| `9` | Vakantie | Preference chip |
| `10` | Nascholing | Preference chip |
| `5001` | FTE | Preference chip |

## Other / Legacy

| Type | Name | Notes |
|---|---|---|
| `8` | Taak | Legacy task type. |

## Clarification Rules

- `type=11` is used for **Extra Dokter assignments** (bottom stripe).
- `type=9` is reserved for **Vakantie preference** entries.
- `type=4` and `type=6` are context-dependent:
  - legacy standaard assignment when `status` is `NULL`
  - overname records when `status` is set
