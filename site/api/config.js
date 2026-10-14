// Public sign-in settings for the page (the Command Center's public Supabase URL and anon key).
import { send, ccUrl, ccAnonKey } from './_lib.js';

export default function handler(req, res) {
  return send(res, 200, { ok: true, supabaseUrl: ccUrl(), anonKey: ccAnonKey(), ready: Boolean(ccAnonKey()) });
}
