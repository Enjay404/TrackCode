import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveTrackIsrcAndPreview } from '../server/api.js';

type ApiReq = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

type ApiRes = ServerResponse & {
  status?: (code: number) => ApiRes;
  json?: (body: unknown) => void;
};

function readQueryParam(
  req: ApiReq,
  parsedUrl: URL,
  key: string,
  fallback = ''
): string {
  const raw = req.query?.[key] ?? parsedUrl.searchParams.get(key) ?? fallback;
  return Array.isArray(raw) ? (raw[0] ?? fallback).trim() : raw.trim();
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const id = readQueryParam(req, parsedUrl, 'id');
  const source = readQueryParam(req, parsedUrl, 'source', 'deezer');
  const isrc = readQueryParam(req, parsedUrl, 'isrc');
  const q = readQueryParam(req, parsedUrl, 'q');

  if (!id && !isrc && !q) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: 'Track id, isrc, or query is required.',
        isrc: null,
        previewUrl: null,
      })
    );
    return;
  }

  const result = await resolveTrackIsrcAndPreview({ id, source, isrc, q });
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify(result));
}
