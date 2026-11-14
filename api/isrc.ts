import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveTrackIsrc } from '../server/api.js';

type ApiReq = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

type ApiRes = ServerResponse & {
  status?: (code: number) => ApiRes;
  json?: (body: unknown) => void;
};

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const rawId = req.query?.id ?? parsedUrl.searchParams.get('id') ?? '';
  const rawSource = req.query?.source ?? parsedUrl.searchParams.get('source') ?? 'deezer';

  const id = Array.isArray(rawId) ? (rawId[0] ?? '').trim() : rawId.trim();
  const source = Array.isArray(rawSource) ? (rawSource[0] ?? 'deezer').trim() : rawSource.trim();

  if (!id) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Track id is required.', isrc: null }));
    return;
  }

  const isrc = await resolveTrackIsrc(id, source);
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify({ isrc }));
}
