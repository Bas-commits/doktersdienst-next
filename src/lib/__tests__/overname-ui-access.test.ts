import { describe, expect, it } from 'vitest';
import {
  computeOvernameCaps,
  canCurrentUserProposeOvername,
  OVERNAME_ACTION_FORBIDDEN_TOAST,
} from '@/lib/overname-ui-access';
import {
  GROEP_ADMINISTRATOR,
  GROEP_DEELNEMER,
  GROEP_SECRETARIS,
} from '@/lib/roles';

const self = 42;
const other = 99;

describe('overname-ui-access', () => {
  it('exports the exact forbidden toast string', () => {
    expect(OVERNAME_ACTION_FORBIDDEN_TOAST).toBe(
      'U kunt overnames enkel wijzigen als ze u betreffen of als u secretaris bent'
    );
  });

  it('global admin: full caps', () => {
    const c = computeOvernameCaps({
      currentDeelnemerId: other,
      globalIdgroep: GROEP_ADMINISTRATOR,
      roleTier: GROEP_ADMINISTRATOR,
      middleId: self,
      senderId: self,
    });
    expect(c.canRespondPending).toBe(true);
    expect(c.canManageProposalLifecycle).toBe(true);
  });

  it('secretaris tier: full caps', () => {
    const c = computeOvernameCaps({
      currentDeelnemerId: other,
      globalIdgroep: null,
      roleTier: GROEP_SECRETARIS,
      middleId: self,
      senderId: self,
    });
    expect(c.canRespondPending).toBe(true);
    expect(c.canManageProposalLifecycle).toBe(true);
  });

  it('deelnemer target only: respond, not lifecycle', () => {
    const c = computeOvernameCaps({
      currentDeelnemerId: self,
      globalIdgroep: null,
      roleTier: GROEP_DEELNEMER,
      middleId: self,
      senderId: other,
    });
    expect(c.canRespondPending).toBe(true);
    expect(c.canManageProposalLifecycle).toBe(false);
  });

  it('deelnemer sender only: lifecycle, not respond', () => {
    const c = computeOvernameCaps({
      currentDeelnemerId: self,
      globalIdgroep: null,
      roleTier: GROEP_DEELNEMER,
      middleId: other,
      senderId: self,
    });
    expect(c.canRespondPending).toBe(false);
    expect(c.canManageProposalLifecycle).toBe(true);
  });

  it('plain deelnemer outsider: neither', () => {
    const c = computeOvernameCaps({
      currentDeelnemerId: self,
      globalIdgroep: null,
      roleTier: GROEP_DEELNEMER,
      middleId: other,
      senderId: other,
    });
    expect(c.canRespondPending).toBe(false);
    expect(c.canManageProposalLifecycle).toBe(false);
  });

  it('senderId 0: no lifecycle for deelnemer', () => {
    const c = computeOvernameCaps({
      currentDeelnemerId: self,
      globalIdgroep: null,
      roleTier: GROEP_DEELNEMER,
      middleId: self,
      senderId: 0,
    });
    expect(c.canRespondPending).toBe(true);
    expect(c.canManageProposalLifecycle).toBe(false);
  });

  it('canCurrentUserProposeOvername: middle or elevated', () => {
    expect(
      canCurrentUserProposeOvername({
        currentDeelnemerId: self,
        globalIdgroep: null,
        roleTier: GROEP_DEELNEMER,
        assignedMiddleId: self,
      })
    ).toBe(true);
    expect(
      canCurrentUserProposeOvername({
        currentDeelnemerId: self,
        globalIdgroep: null,
        roleTier: GROEP_DEELNEMER,
        assignedMiddleId: other,
      })
    ).toBe(false);
    expect(
      canCurrentUserProposeOvername({
        currentDeelnemerId: self,
        globalIdgroep: GROEP_ADMINISTRATOR,
        roleTier: GROEP_ADMINISTRATOR,
        assignedMiddleId: other,
      })
    ).toBe(true);
  });
});
