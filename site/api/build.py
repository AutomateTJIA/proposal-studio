# Builds the proposal HTML and client email from proposal.json using the locked skill
# (site/skill). The same code runs in Claude chats, so the site and the skill never drift.
#   POST {"mode": "build", "proposal": {...}}  -> {html, file_name, pages, email: {subject, text, html}}
#   POST {"mode": "check", "proposal": {...}, "html": "...", "heights": [...], "pdf_count": n}
#        -> {results: [{name, passed, detail}], failed: n}
import hmac, importlib.util, json, os, pathlib
from http.server import BaseHTTPRequestHandler

SKILL = pathlib.Path(__file__).resolve().parent.parent / "skill"


def _load(name):
    spec = importlib.util.spec_from_file_location(name, SKILL / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bp = _load("build_proposal")
em = _load("build_email")
BRAND = json.loads((SKILL / "branding.json").read_text())


def _authorized(header):
    expected = os.environ.get("STAFF_PASSWORD", "")
    given = header[7:] if header.startswith("Bearer ") else ""
    return bool(expected) and bool(given) and hmac.compare_digest(expected.encode(), given.encode())


def build(data):
    b = bp.Builder(data, BRAND)
    doc = b.build()
    subject, blocks = em.compose(data, BRAND)
    return {"html": doc, "file_name": b.file_name, "pages": b.total,
            "email": {"subject": subject, "text": em.to_text(subject, blocks), "html": em.to_html(subject, blocks, BRAND)}}


def check(data, html_doc, heights, pdf_count):
    b = bp.Builder(data, BRAND)
    results = bp.run_checks(data, BRAND, html_doc, b.total, heights, pdf_count)
    subject, blocks = em.compose(data, BRAND)
    results += em.email_checks(data, BRAND, em.to_text(subject, blocks))
    out = [{"name": n, "passed": bool(p), "detail": d} for n, p, d in results]
    return {"results": out, "failed": sum(1 for r in out if not r["passed"])}


class handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        if not _authorized(self.headers.get("Authorization", "")):
            return self._send(401, {"ok": False, "error": "Unauthorized"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            data = req["proposal"]
            if req.get("mode") == "check":
                return self._send(200, {"ok": True, **check(data, req["html"], req.get("heights"), req.get("pdf_count"))})
            return self._send(200, {"ok": True, **build(data)})
        except Exception as e:  # the caller shows this to Claude for a fix round
            return self._send(422, {"ok": False, "error": f"{type(e).__name__}: {e}"})
