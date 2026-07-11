import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module (provides `pool`) so no real DB is touched.
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/config/database', () => ({
  __esModule: true,
  default: { query },
  warmPool: vi.fn(),
}));

// Mock the cache so getGames always falls through to pool.query.
vi.mock('../src/utils/cache', () => ({
  cache: {
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}));

import { getGames, getGameById, updateGame, createGame } from '../src/controllers/gameController';

function createRes() {
  const res: any = {
    statusCode: 200,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

beforeEach(() => {
  query.mockReset();
});

describe('gameController.getGames', () => {
  it('returns games from pool.query in the expected envelope', async () => {
    const rows = [
      { id: 1, name: 'Genshin Impact', album_count: '3' },
      { id: 2, name: 'Honkai Star Rail', album_count: '5' },
    ];
    query.mockResolvedValue({ rows });

    const req: any = {};
    const res = createRes();
    await getGames(req, res);

    expect(query).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { games: rows } });
  });

  it('returns a 500 error envelope when the query throws', async () => {
    query.mockRejectedValue(new Error('db down'));

    const req: any = {};
    const res = createRes();
    await getGames(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FETCH_ERROR');
  });
});

describe('gameController.getGameById', () => {
  it('returns 404 when no game matches the id', async () => {
    query.mockResolvedValue({ rows: [] });

    const req: any = { params: { id: '999' } };
    const res = createRes();
    await getGameById(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns game + albums when found', async () => {
    const gameRow = { id: 1, name: 'Genshin Impact' };
    const albumRows = [{ id: 10, title: 'Sky' }];
    query
      .mockResolvedValueOnce({ rows: [gameRow] })
      .mockResolvedValueOnce({ rows: albumRows });

    const req: any = { params: { id: '1' } };
    const res = createRes();
    await getGameById(req, res);

    expect(query).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { game: gameRow, albums: albumRows },
    });
  });
});

describe('gameController.updateGame', () => {
  it('returns 404 when the update matches no rows', async () => {
    query.mockResolvedValue({ rows: [] });

    const req: any = { params: { id: '5' }, body: { name: 'X' } };
    const res = createRes();
    await updateGame(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns the updated game on success', async () => {
    const updated = { id: 5, name: 'Updated' };
    query.mockResolvedValue({ rows: [updated] });

    const req: any = { params: { id: '5' }, body: { name: 'Updated' } };
    const res = createRes();
    await updateGame(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { game: updated } });
  });
});

describe('gameController.createGame', () => {
  it('returns 400 when name is missing/blank', async () => {
    const req: any = { params: {}, body: { name: '   ' } };
    const res = createRes();
    await createGame(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 201 with the created game on success', async () => {
    const created = { id: 7, name: 'New Game' };
    query.mockResolvedValue({ rows: [created] });

    const req: any = { body: { name: 'New Game' } };
    const res = createRes();
    await createGame(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { game: created } });
  });

  it('returns 409 on duplicate (postgres 23505) error', async () => {
    const err: any = new Error('duplicate');
    err.code = '23505';
    query.mockRejectedValue(err);

    const req: any = { body: { name: 'Dup' } };
    const res = createRes();
    await createGame(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE');
  });
});
