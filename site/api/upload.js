// Issues one-time tokens so the browser can upload quote PDFs straight to private Blob storage
// (quote PDFs are often larger than a function request allows).
import { handleUpload } from '@vercel/blob/client';
import { send, tokenOk, QUOTES, readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!tokenOk(clientPayload || '')) throw new Error('Unauthorized');
        if (!pathname.startsWith(QUOTES) || pathname.includes('..') || !/\.pdf$/i.test(pathname)) {
          throw new Error('Only PDF quotes can be uploaded');
        }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 30 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return send(res, 200, result);
  } catch (e) {
    return send(res, 400, { ok: false, error: e.message });
  }
}
