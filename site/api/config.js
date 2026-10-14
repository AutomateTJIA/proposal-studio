// Tells the page whether sign-in is set up. No keys are ever sent to the browser.
import { send, ccApiKey } from './_lib.js';

export default function handler(req, res) {
  return send(res, 200, { ok: true, ready: Boolean(ccApiKey()) });
}
