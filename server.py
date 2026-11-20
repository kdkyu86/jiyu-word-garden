"""Private family gateway: all learning files and shared progress require a session."""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import timedelta
from pathlib import Path
from flask import Flask, abort, g, jsonify, redirect, render_template, request, send_from_directory, session, url_for
from werkzeug.security import check_password_hash

ROOT = Path(__file__).resolve().parent
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CARD = re.compile(r"^(ivy(?:2)?-\d+|custom-\d+)$")
MAX_BYTES = 16 * 1024 * 1024


def validate_state(data):
    """Keep the existing app format, reject values that could break its renderer."""
    if not isinstance(data, dict):
        raise ValueError("State must be an object.")
    for key, kind in [("progress", dict), ("history", list), ("custom", list), ("edits", dict), ("settings", dict)]:
        if not isinstance(data.get(key), kind):
            raise ValueError("Invalid " + key)
    if len(data["custom"]) > 3000 or len(data["history"]) > 30000:
        raise ValueError("Too many records.")
    for card_id, p in data["progress"].items():
        if not CARD.fullmatch(card_id) or not isinstance(p, dict):
            raise ValueError("Invalid progress.")
        for name in ["level", "misses", "views", "practices", "attempts", "correct", "checkAttempts", "checkCorrect"]:
            value = p.get(name, 0)
            if type(value) is not int or value < 0 or value > 10**9:
                raise ValueError("Invalid counter.")
        if p.get("level", 0) > 5 or not isinstance(p.get("due", ""), str) or p.get("due") and not DATE.fullmatch(p["due"]):
            raise ValueError("Invalid review date or level.")
    def validate_word(w):
        if not isinstance(w, dict) or not CARD.fullmatch(str(w.get("id", ""))):
            raise ValueError("Invalid word ID.")
        for key in ["word", "meaning", "example"]:
            if not isinstance(w.get(key), str) or len(w[key]) > 20000:
                raise ValueError("Invalid word content.")
        if w.get("image") and (not isinstance(w["image"], str) or not re.match(r"^data:image/(png|jpeg|webp);base64,", w["image"])):
            raise ValueError("Invalid picture.")
        for key in ["book", "note", "source", "imageAlt", "addedAt"]:
            if key in w and not isinstance(w[key], str):
                raise ValueError("Invalid word metadata.")
    for w in data["custom"]:
        validate_word(w)
    for card_id, w in data["edits"].items():
        if not CARD.fullmatch(card_id):
            raise ValueError("Invalid edited ID.")
        validate_word({**w, "id": card_id})
    for h in data["history"]:
        if not isinstance(h, dict) or not DATE.fullmatch(str(h.get("date", ""))) or not isinstance(h.get("ids"), list) or not all(isinstance(i, str) and CARD.fullmatch(i) for i in h["ids"]):
            raise ValueError("Invalid history.")
        for name in ["correct", "total", "checkCorrect", "checkTotal"]:
            value = h.get(name, 0)
            if type(value) is not int or value < 0 or value > 100000:
                raise ValueError("Invalid history score.")
    settings = data["settings"]
    if settings.get("size") not in [30, 35, 40] or settings.get("rate") not in [.65, .8, 1] or type(settings.get("auto")) is not bool:
        raise ValueError("Invalid settings.")
    # Resume payloads must only refer to known cards and expected stage names.
    known = {f"ivy-{i}" for i in range(63)} | {f"ivy2-{i}" for i in range(116)} | {w["id"] for w in data["custom"]}
    def validate_session(s):
        if s is None:
            return
        if not isinstance(s, dict) or s.get("stage") not in ["cards", "match", "quiz", "check"]:
            raise ValueError("Invalid saved game.")
        ids = s.get("ids")
        if not isinstance(ids, list) or not ids or len(ids) > 3000 or not all(i in known for i in ids):
            raise ValueError("Unknown saved-game cards.")
        if not isinstance(s.get("order"), list) or sorted(s["order"]) != sorted(ids):
            raise ValueError("Invalid card order.")
        for key in ["index", "matchBatch", "quizIndex", "checkIndex"]:
            value = s.get(key, 0)
            if type(value) is not int or value < 0 or value > 100000:
                raise ValueError("Invalid saved-game position.")
        if s.get("round") not in [1, 2, 3]:
            raise ValueError("Invalid saved-game round.")
        if s.get("stage") == "cards" and s.get("index", 0) >= len(ids):
            raise ValueError("Invalid card position.")
        for key in ["key", "label"]:
            if key in s and (not isinstance(s[key], str) or len(s[key]) > 1000):
                raise ValueError("Invalid saved-game label.")
    validate_session(data.get("session"))
    paused = data.get("pausedSessions", {})
    if not isinstance(paused, dict) or len(paused) > 1000:
        raise ValueError("Invalid paused games.")
    for s in paused.values():
        validate_session(s)
    return data


def create_app(overrides=None):
    app = Flask(__name__, static_folder=None, template_folder=str(ROOT / "templates"))
    instance = Path(os.environ.get("DATA_DIR", str(ROOT / "instance")))
    if overrides and overrides.get("DATA_DIR"):
        instance = Path(overrides["DATA_DIR"])
    instance.mkdir(parents=True, exist_ok=True)
    secret = os.environ.get("SECRET_KEY")
    if not secret:
        secret_file = instance / "session-secret"
        try:
            fd = os.open(secret_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as f:
                f.write(secrets.token_hex(32))
        except FileExistsError:
            pass
        secret = secret_file.read_text().strip()
    app.config.update(
        SECRET_KEY=secret,
        DATA_DIR=str(instance),
        DATABASE=str(instance / "word-garden.sqlite3"),
        FAMILY_USERNAME=os.environ.get("FAMILY_USERNAME"),
        FAMILY_PASSWORD_HASH=os.environ.get("FAMILY_PASSWORD_HASH"),
        SESSION_COOKIE_NAME="word_garden_family",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "true").lower() != "false",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        PERMANENT_SESSION_LIFETIME=timedelta(days=7),
        MAX_CONTENT_LENGTH=MAX_BYTES,
    )
    if overrides:
        app.config.update(overrides)
    if not app.config["FAMILY_USERNAME"] or not app.config["FAMILY_PASSWORD_HASH"]:
        raise RuntimeError("Set FAMILY_USERNAME and FAMILY_PASSWORD_HASH before starting the app.")
    with sqlite3.connect(app.config["DATABASE"]) as db:
        db.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS family_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT, updated_at INTEGER);
        INSERT OR IGNORE INTO family_state VALUES(1,0,NULL,NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS login_failures (ip_hash TEXT NOT NULL, failed_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS failures_ip_time ON login_failures(ip_hash, failed_at);
        """)
    def db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"], timeout=15)
            g.db.row_factory = sqlite3.Row
        return g.db
    @app.teardown_appcontext
    def close_db(error=None):
        if "db" in g:
            g.db.close()
    def sid_hash():
        return hashlib.sha256(session.get("sid", "").encode()).hexdigest()
    def logged_in():
        return bool(session.get("sid") and db().execute("SELECT 1 FROM sessions WHERE token_hash=? AND expires_at>?", (sid_hash(), int(time.time()))).fetchone())
    def csrf():
        token = session.get("csrf")
        if not token:
            token = session["csrf"] = secrets.token_urlsafe(32)
        return token
    def valid_csrf():
        supplied = request.headers.get("X-CSRF-Token") or request.form.get("csrf", "")
        return bool(session.get("csrf") and isinstance(supplied, str) and hmac.compare_digest(session["csrf"], supplied))

    @app.before_request
    def protect():
        # Flask static hosting is disabled. Every file goes through this gate.
        if request.endpoint in ["login", "health"]:
            return None
        if not logged_in():
            if request.path == "/":
                return redirect(url_for("login"))
            return jsonify(error="authentication_required"), 401
        if request.method in ["POST", "PUT", "PATCH", "DELETE"] and not valid_csrf():
            return jsonify(error="invalid_csrf"), 403

    @app.after_request
    def headers(response):
        response.headers.update({
            "Cache-Control": "no-store, private",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "same-origin",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
        })
        if app.config["SESSION_COOKIE_SECURE"]:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.route("/health")
    def health():
        return jsonify(status="ok")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if logged_in():
            return redirect("/")
        error = ""
        status = 200
        if request.method == "POST":
            if not valid_csrf():
                abort(403)
            now = int(time.time())
            ip = hashlib.sha256((request.remote_addr or "unknown").encode()).hexdigest()
            db().execute("DELETE FROM login_failures WHERE failed_at<?", (now - 900,))
            count = db().execute("SELECT count(*) FROM login_failures WHERE ip_hash=?", (ip,)).fetchone()[0]
            if count >= 8:
                error, status = "Too many tries. Please try again in 15 minutes.", 429
            else:
                username = request.form.get("username", "")[:200]
                password = request.form.get("password", "")[:1000]
                password_ok = check_password_hash(app.config["FAMILY_PASSWORD_HASH"], password)
                if hmac.compare_digest(username, app.config["FAMILY_USERNAME"]) and password_ok:
                    sid = secrets.token_urlsafe(32)
                    db().execute("DELETE FROM sessions WHERE expires_at<?", (now,))
                    db().execute("INSERT INTO sessions VALUES(?,?)", (hashlib.sha256(sid.encode()).hexdigest(), now + 604800))
                    db().execute("DELETE FROM login_failures WHERE ip_hash=?", (ip,))
                    db().commit()
                    session.clear()
                    session["sid"] = sid
                    session["csrf"] = secrets.token_urlsafe(32)
                    session.permanent = True
                    return redirect("/")
                db().execute("INSERT INTO login_failures VALUES(?,?)", (ip, now))
                error, status = "The username or password is not right. Try again.", 401
            db().commit()
        return render_template("login.html", csrf=csrf(), username=app.config["FAMILY_USERNAME"], error=error), status

    @app.post("/logout")
    def logout():
        db().execute("DELETE FROM sessions WHERE token_hash=?", (sid_hash(),))
        db().commit()
        session.clear()
        return jsonify(ok=True)

    @app.route("/api/state", methods=["GET", "PUT"])
    def shared_state():
        if request.method == "GET":
            row = db().execute("SELECT * FROM family_state WHERE id=1").fetchone()
            return jsonify(state=json.loads(row["payload"]) if row["payload"] else None, revision=row["revision"], updated_at=row["updated_at"], csrf=csrf(), account=app.config["FAMILY_USERNAME"])
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or type(body.get("revision")) is not int:
            return jsonify(error="invalid_request"), 400
        try:
            payload = json.dumps(validate_state(body.get("state")), ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        except (ValueError, TypeError, OverflowError):
            return jsonify(error="invalid_state"), 400
        connection = db()
        connection.execute("BEGIN IMMEDIATE")
        revision = connection.execute("SELECT revision FROM family_state WHERE id=1").fetchone()[0]
        if revision != body["revision"]:
            connection.rollback()
            return jsonify(error="version_conflict", revision=revision), 409
        now = int(time.time())
        connection.execute("UPDATE family_state SET payload=?,revision=?,updated_at=? WHERE id=1", (payload, revision + 1, now))
        connection.commit()
        return jsonify(ok=True, revision=revision + 1, updated_at=now)

    @app.get("/")
    def home():
        return send_from_directory(ROOT / "dist", "index.html")

    @app.get("/<path:filename>")
    def learning_file(filename):
        # No arbitrary filesystem roots or runtime credentials can be downloaded.
        allowed = {p.name for p in (ROOT / "dist").iterdir() if p.is_file() and p.suffix in [".html", ".css", ".js", ".png", ".ico"]}
        if filename not in allowed:
            abort(404)
        return send_from_directory(ROOT / "dist", filename)

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), debug=False)
