// Issues short-lived presigned URLs so the browser can upload quote PDFs straight to private Blob
// storage (quote PDFs are often larger than a function request allows). Works with Vercel's
// keyless store connection (BLOB_STORE_ID + OIDC) as well as a read-write token.
import { handleUploadPresigned } from '@vercel/blob/client';
import { issueSignedToken } from '@vercel/blob';
import { send, userFromToken, QUOTES, readBody } from './_lib.js';

const MAX_BYTES = 30 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const body = await readBody(req);
    const result = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname, clientPayload) => {
        if (!(await userFromToken(clientPayload || ''))) throw new Error('Please sign in again.');
        if (!pathname.startsWith(QUOTES) || pathname.includes('..') || !/\.pdf$/i.test(pathname)) {
          throw new Error('Only PDF quotes can be uploaded');
        }
        const limits = { allowedContentTypes: ['application/pdf'], maximumSizeInBytes: MAX_BYTES };
        const token = await issueSignedToken({
          pathname, operations: ['put'], validUntil: Date.now() + 15 * 60_000, ...limits,
        });
        return { token, urlOptions: { ...limits, addRandomSuffix: true } };
      },
    });
    return send(res, 200, result);
  } catch (e) {
    return send(res, 400, { ok: false, error: e.message });
  }
}
