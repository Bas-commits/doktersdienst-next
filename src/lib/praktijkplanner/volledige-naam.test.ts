import { describe, expect, it } from 'vitest';
import { volledigeActiviteitNaam, volledigeTaakNaam } from './volledige-naam';

describe('volledigeActiviteitNaam', () => {
  it('geeft de naam en niet de afkorting', () => {
    expect(
      volledigeActiviteitNaam({ naam: 'OK Longtransplantatie', afkorting: 'OK Trans' }, null)
    ).toBe('OK Longtransplantatie');
  });

  it('zet de specificatie erachter', () => {
    expect(
      volledigeActiviteitNaam(
        { naam: 'Spreekuur Oncologie', afkorting: 'SprOnco' },
        { naam: 'Nieuwe patienten', afkorting: 'NP' }
      )
    ).toBe('Spreekuur Oncologie · Nieuwe patienten');
  });

  it('valt terug op de afkorting als de naam leeg is', () => {
    expect(volledigeActiviteitNaam({ naam: '', afkorting: 'OK Onco' }, null)).toBe('OK Onco');
  });

  it('geeft null zonder activiteit', () => {
    expect(volledigeActiviteitNaam(null, null)).toBeNull();
  });
});

describe('volledigeTaakNaam', () => {
  it('geeft de omschrijving, want de afkorting is niet uniek', () => {
    expect(volledigeTaakNaam({ id: 1, afkorting: 'Spoed', omschrijving: 'Spoedsein Utrecht' })).toBe(
      'Spoedsein Utrecht'
    );
    expect(
      volledigeTaakNaam({ id: 6, afkorting: 'Spoed', omschrijving: 'Spoedsein Nieuwegein' })
    ).toBe('Spoedsein Nieuwegein');
  });

  it('valt terug op de afkorting en daarna op het nummer', () => {
    expect(volledigeTaakNaam({ id: 9, afkorting: 'TopZrg', omschrijving: null })).toBe('TopZrg');
    expect(volledigeTaakNaam({ id: 9, afkorting: null, omschrijving: null })).toBe('Taak 9');
  });
});
