import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const mockGetAuthenticatedUser = vi.fn();
const mockHasGroupManagementAccess = vi.fn();
const mockSelect = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();

let selectQueue: Array<() => unknown> = [];

vi.mock('@/lib/api-auth', () => ({
  GROEP_ADMINISTRATOR: 999,
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
  hasGroupManagementAccess: (...args: unknown[]) => mockHasGroupManagementAccess(...args),
}));

vi.mock('@/lib/welkom-wav-s3', () => ({
  getWelkomWavBucket: vi.fn(() => null),
  welkomWelkomstFilePresent: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
    update: vi.fn(() => ({
      set: mockUpdateSet,
    })),
  },
  schema: {
    waarneemgroepen: {
      id: 'waarneemgroepen.id',
      naam: 'waarneemgroepen.naam',
      idspecialisme: 'waarneemgroepen.idspecialisme',
      idregio: 'waarneemgroepen.idregio',
      idinstelling: 'waarneemgroepen.idinstelling',
      regiobeschrijving: 'waarneemgroepen.regiobeschrijving',
      telnringaand: 'waarneemgroepen.telnringaand',
      telnrnietopgenomen: 'waarneemgroepen.telnrnietopgenomen',
      telnronzecentrale: 'waarneemgroepen.telnronzecentrale',
      telnronzecentrale2: 'waarneemgroepen.telnronzecentrale2',
      telnrconference: 'waarneemgroepen.telnrconference',
      idfacturering: 'waarneemgroepen.idfacturering',
      idinvoegendewaarneemgroep: 'waarneemgroepen.idinvoegendewaarneemgroep',
      afgemeld: 'waarneemgroepen.afgemeld',
      smsdienstbegin: 'waarneemgroepen.smsdienstbegin',
      eigentelwelkomwav: 'waarneemgroepen.eigentelwelkomwav',
      eigentelwelkomlocatie: 'waarneemgroepen.eigentelwelkomlocatie',
      gebruiktVoicemail: 'waarneemgroepen.gebruikt_voicemail',
      abomaatschapplanner: 'waarneemgroepen.abomaatschapplanner',
      idcoordinatorwaarneemgroep: 'waarneemgroepen.idcoordinatorwaarneemgroep',
      idliason1: 'waarneemgroepen.idliason1',
      idliason2: 'waarneemgroepen.idliason2',
      idliason3: 'waarneemgroepen.idliason3',
      idliason4: 'waarneemgroepen.idliason4',
    },
    specialismen: {},
    regios: {},
    instellingen: {},
    deelnemers: {},
    waarneemgroepdeelnemers: {},
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((value: unknown) => value),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  max: vi.fn((value: unknown) => ({ max: value })),
  or: vi.fn((...args: unknown[]) => args),
}));

function makeReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'POST',
    headers: { cookie: 's=1' },
    body: {
      naam: 'Bas Test 01',
      telnronzecentrale: '0880026453',
    },
    query: { id: '77' },
    ...overrides,
  } as unknown as NextApiRequest;
}

function makeRes(): NextApiResponse & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  };
  return res as unknown as NextApiResponse & { _status: number; _json: unknown };
}

function selectDuplicateRows(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(rows)),
      })),
    })),
  };
}

function selectRows(rows: unknown[]) {
  return {
    from: vi.fn(() => Promise.resolve(rows)),
  };
}

function selectCurrentWaarneemgroep() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() =>
          Promise.resolve([{ eigentelwelkomwav: false, eigentelwelkomlocatie: null }])
        ),
      })),
    })),
  };
}

describe('waarneemgroep centrale telefoonnummer persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    selectQueue = [];
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 1,
      email: 'admin@test.nl',
      idgroep: 5,
      isAdmin: true,
    });
    mockHasGroupManagementAccess.mockResolvedValue(true);
    mockSelect.mockImplementation(() => {
      const next = selectQueue.shift();
      if (!next) throw new Error('Unexpected select call');
      return next();
    });
    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: vi.fn(() => Promise.resolve(undefined)) });
  });

  it('stores normalized telnronzecentrale2 when creating a waarneemgroep', async () => {
    selectQueue = [() => selectDuplicateRows([]), () => selectRows([{ maxId: 76 }])];

    const { default: handler } = await import('@/pages/api/waarneemgroep-toevoegen/index');
    const res = makeRes();
    await handler(makeReq(), res);

    expect(res._status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        telnronzecentrale: '31880026453',
        telnronzecentrale2: '31880026453',
      })
    );
  });

  it('stores normalized telnronzecentrale2 from formatted international input', async () => {
    selectQueue = [() => selectDuplicateRows([]), () => selectRows([{ maxId: 76 }])];

    const { default: handler } = await import('@/pages/api/waarneemgroep-toevoegen/index');
    const res = makeRes();
    await handler(
      makeReq({
        body: {
          naam: 'Bas Test 01',
          telnronzecentrale: '+31 88 773 27 52',
        },
      }),
      res
    );

    expect(res._status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        telnronzecentrale: '31887732752',
        telnronzecentrale2: '31887732752',
      })
    );
  });

  it('stores selected central number sent as telnronzecentrale2 during create', async () => {
    selectQueue = [() => selectDuplicateRows([]), () => selectRows([{ maxId: 76 }])];

    const { default: handler } = await import('@/pages/api/waarneemgroep-toevoegen/index');
    const res = makeRes();
    await handler(
      makeReq({
        body: {
          naam: 'Bas Test 01',
          telnronzecentrale2: '0880026453',
        },
      }),
      res
    );

    expect(res._status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        telnronzecentrale: '31880026453',
        telnronzecentrale2: '31880026453',
      })
    );
  });

  it('stores null telnronzecentrale2 when creating without a central number', async () => {
    selectQueue = [() => selectRows([{ maxId: 76 }])];

    const { default: handler } = await import('@/pages/api/waarneemgroep-toevoegen/index');
    const res = makeRes();
    await handler(makeReq({ body: { naam: 'Geen centrale' } }), res);

    expect(res._status).toBe(201);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        telnronzecentrale: null,
        telnronzecentrale2: null,
      })
    );
  });

  it('rejects invalid phone values when creating a waarneemgroep', async () => {
    const { default: handler } = await import('@/pages/api/waarneemgroep-toevoegen/index');
    const res = makeRes();
    await handler(
      makeReq({
        body: {
          naam: 'Bas Test 01',
          telnronzecentrale: '0880026453',
          telnringaand: 'invalid-phone',
        },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('updates telnronzecentrale2 alongside the displayed central number', async () => {
    selectQueue = [() => selectCurrentWaarneemgroep()];

    const { default: handler } = await import('@/pages/api/waarneemgroep-wijzigen/[id]');
    const res = makeRes();
    await handler(makeReq({ method: 'PUT' }), res);

    expect(res._status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        telnronzecentrale: '31880026453',
        telnronzecentrale2: '31880026453',
      })
    );
  });

  it('normalizes additional waarneemgroep phone fields on update', async () => {
    selectQueue = [() => selectCurrentWaarneemgroep()];

    const { default: handler } = await import('@/pages/api/waarneemgroep-wijzigen/[id]');
    const res = makeRes();
    await handler(
      makeReq({
        method: 'PUT',
        body: {
          naam: 'Bas Test 01',
          telnronzecentrale: '0880026453',
          telnringaand: '06 12 34 56 78',
          telnrnietopgenomen: '+31 88 773 27 52',
        },
      }),
      res
    );

    expect(res._status).toBe(200);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        telnringaand: '31612345678',
        telnrnietopgenomen: '31887732752',
      })
    );
  });

  it('rejects invalid telnronzecentrale values when updating', async () => {
    selectQueue = [() => selectCurrentWaarneemgroep()];

    const { default: handler } = await import('@/pages/api/waarneemgroep-wijzigen/[id]');
    const res = makeRes();
    await handler(
      makeReq({
        method: 'PUT',
        body: {
          naam: 'Bas Test 01',
          telnronzecentrale: 'abc',
        },
      }),
      res
    );

    expect(res._status).toBe(400);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
