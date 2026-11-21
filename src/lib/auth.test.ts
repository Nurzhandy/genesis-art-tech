import { describe, expect, it } from 'vitest';
import { requestUser, requireUser } from './auth';

describe('requestUser', () => {
  it('без токена — никто не вошёл, requireUser отвечает 401', async () => {
    const req = new Request('http://x/api/me/diaries');
    expect(await requestUser(req)).toBeNull();
    await expect(requireUser(req)).rejects.toMatchObject({ status: 401 });
  });
  it('мусор вместо Bearer — тоже никто', async () => {
    expect(await requestUser(new Request('http://x', { headers: { authorization: 'Basic abc' } }))).toBeNull();
  });
});
