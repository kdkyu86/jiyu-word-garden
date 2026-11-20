import copy
import json
import re
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from werkzeug.security import generate_password_hash
from server import create_app


def blank():
    return {"progress":{},"custom":[],"edits":{},"history":[],"session":None,"pausedSessions":{},"schema":3,"settings":{"size":35,"rate":0.8,"auto":False}}


class FamilyServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = generate_password_hash("test-family-password", method="pbkdf2:sha256:1000")

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.config = {"DATA_DIR":self.tmp.name,"TESTING":True,"FAMILY_USERNAME":"testfamily","FAMILY_PASSWORD_HASH":self.password_hash}
        self.app=create_app(self.config)
        self.client=self.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def login(self, client=None):
        client=client or self.client
        r=client.get("/login",base_url="https://localhost")
        csrf=re.search(rb'name="csrf" value="([^"]+)"',r.data).group(1).decode()
        r=client.post("/login",base_url="https://localhost",data={"csrf":csrf,"username":"testfamily","password":"test-family-password"})
        self.assertEqual(r.status_code,302)
        data=client.get("/api/state",base_url="https://localhost").get_json()
        return data["csrf"]

    def put(self,state,revision,csrf,client=None):
        return (client or self.client).put("/api/state",base_url="https://localhost",json={"state":state,"revision":revision},headers={"X-CSRF-Token":csrf})

    def test_no_learning_material_before_login(self):
        self.assertEqual(self.client.get("/",base_url="https://localhost").status_code,302)
        for path in ["/app.js","/server-sync.js","/data.js","/data-part2.js","/learning.js","/motion.js","/style.css","/atlas.png","/atlas-part2-a.png","/atlas-part2-b.png","/api/state","/dist/data.js","/static/data.js"]:
            with self.subTest(path=path):
                r=self.client.get(path,base_url="https://localhost")
                self.assertEqual(r.status_code,401)
                self.assertIn("no-store",r.headers["Cache-Control"])
                self.assertNotIn(b"WORDS",r.data)
        self.assertEqual(self.client.get("/health").status_code,200)

    def test_login_and_protected_assets_and_cookie_flags(self):
        csrf=self.login()
        for path in ["/","/app.js","/server-sync.js","/data-part2.js","/atlas-part2-b.png"]:
            with self.client.get(path,base_url="https://localhost") as response:
                self.assertEqual(response.status_code,200)
        r=self.client.get("/api/state",base_url="https://localhost")
        self.assertTrue(csrf)
        self.assertEqual(r.get_json()["revision"],0)
        cookie=self.client.get_cookie("word_garden_family")
        self.assertTrue(cookie.secure)
        self.assertTrue(cookie.http_only)
        self.assertEqual(cookie.same_site,"Lax")

    def test_server_credentials_and_files_not_exposed(self):
        self.login()
        for path in ["/server.py","/family_credentials.py","/instance/word-garden.sqlite3","/../server.py","/.env","/templates/login.html"]:
            self.assertEqual(self.client.get(path,base_url="https://localhost").status_code,404)

    def test_csrf_is_required_for_login_and_state_and_logout(self):
        self.assertEqual(self.client.post("/login",base_url="https://localhost",data={}).status_code,403)
        self.login()
        self.assertEqual(self.put(blank(),0,"wrong").status_code,403)
        self.assertEqual(self.client.post("/logout",base_url="https://localhost").status_code,403)

    def test_shared_progress_survives_new_browser_and_restart(self):
        csrf=self.login()
        state=blank()
        state["progress"]["ivy-0"]={"level":2,"due":"2026-11-21","misses":1,"views":6,"practices":2,"attempts":2,"correct":1}
        state["custom"]=[{"id":"custom-123","word":"glow","meaning":"to shine softly","example":"The stars glow.","image":"data:image/png;base64,aGVsbG8="}]
        state["session"]={"key":"deck-part1-0","label":"Part 1 · Set 1","ids":["ivy-0"],"order":["ivy-0"],"stage":"cards","round":2,"index":0}
        r=self.put(state,0,csrf)
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.get_json()["revision"],1)
        app2=create_app(self.config)
        client2=app2.test_client()
        self.login(client2)
        restored=client2.get("/api/state",base_url="https://localhost").get_json()
        self.assertEqual(restored["state"],state)
        self.assertEqual(restored["revision"],1)

    def test_two_devices_do_not_silently_overwrite(self):
        a=self.login()
        client2=self.app.test_client();b=self.login(client2)
        first=blank();first["history"]=[{"id":"a","date":"2026-11-20","ids":["ivy-0"],"total":1,"correct":1}]
        self.assertEqual(self.put(first,0,a).status_code,200)
        stale=blank()
        self.assertEqual(self.put(stale,0,b,client2).status_code,409)
        self.assertEqual(client2.get("/api/state",base_url="https://localhost").get_json()["state"],first)

    def test_invalid_state_is_rejected(self):
        csrf=self.login()
        for changed in [
            {"history":[{"date":"<img src=x>","ids":[],"correct":1,"total":1}]},
            {"progress":{"ivy-0":{"level":"<script>","due":"","misses":0}}},
            {"custom":[{"id":"custom-1","word":"hi","meaning":"hello","example":"Hello!","image":"data:image/svg+xml,<svg/>"}]},
            {"session":{"ids":["not-a-card"],"stage":"cards","order":["not-a-card"],"round":1,"index":0}},
        ]:
            state=blank();state.update(changed)
            self.assertEqual(self.put(state,0,csrf).status_code,400)

    def test_logout_revokes_the_old_cookie(self):
        csrf=self.login()
        cookie=self.client.get_cookie("word_garden_family").value
        self.assertEqual(self.client.post("/logout",base_url="https://localhost",headers={"X-CSRF-Token":csrf}).status_code,200)
        self.client.set_cookie("word_garden_family",cookie,domain="localhost")
        self.assertEqual(self.client.get("/api/state",base_url="https://localhost").status_code,401)
        self.assertEqual(self.client.get("/atlas.png",base_url="https://localhost").status_code,401)

    def test_wrong_password_and_login_rate_limit(self):
        r=self.client.get("/login",base_url="https://localhost")
        token=re.search(rb'name="csrf" value="([^"]+)"',r.data).group(1).decode()
        for _ in range(8):
            r=self.client.post("/login",base_url="https://localhost",data={"csrf":token,"username":"testfamily","password":"wrong"})
            self.assertEqual(r.status_code,401)
        r=self.client.post("/login",base_url="https://localhost",data={"csrf":token,"username":"testfamily","password":"test-family-password"})
        self.assertEqual(r.status_code,429)

    def test_security_headers_and_no_public_plaintext_password(self):
        self.login()
        for path in ["/login","/","/app.js","/atlas.png","/api/state"]:
            r=self.client.get(path,base_url="https://localhost")
            self.assertIn("no-store",r.headers["Cache-Control"])
            self.assertEqual(r.headers["X-Content-Type-Options"],"nosniff")
            self.assertEqual(r.headers["X-Frame-Options"],"DENY")
            r.close()
        dist=Path(__file__).resolve().parents[1]/"dist"
        for f in dist.glob("*.js"):
            self.assertNotIn(self.app.config["FAMILY_PASSWORD_HASH"],f.read_text())


if __name__=="__main__":
    unittest.main(verbosity=2)
