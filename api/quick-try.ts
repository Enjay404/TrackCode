import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleQuickTryRequest } from '../server/api.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await handleQuickTryRequest(req, res);
}
