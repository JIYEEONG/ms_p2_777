import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parent))
import admin_api  # noqa: E402


class AdminApiTests(unittest.TestCase):
    def test_demo_and_allowlisted_google_users_are_admins(self):
        self.assertEqual(admin_api.require_admin_user({"id": "demo:moov"})["id"], "demo:moov")
        with patch.dict(os.environ, {"MOOV_ADMIN_EMAILS": "ops@example.com", "MOOV_ADMIN_USER_IDS": ""}):
            user = {"id": "google:subject", "email": "OPS@example.com"}
            self.assertIs(admin_api.require_admin_user(user), user)

    def test_unconfigured_or_unlisted_accounts_are_closed(self):
        user = {"id": "google:subject", "email": "user@example.com"}
        with patch.dict(os.environ, {"MOOV_ADMIN_EMAILS": "", "MOOV_ADMIN_USER_IDS": ""}):
            with self.assertRaises(HTTPException) as missing:
                admin_api.require_admin_user(user)
            self.assertEqual(missing.exception.status_code, 503)
        with patch.dict(os.environ, {"MOOV_ADMIN_EMAILS": "ops@example.com", "MOOV_ADMIN_USER_IDS": ""}):
            with self.assertRaises(HTTPException) as forbidden:
                admin_api.require_admin_user(user)
            self.assertEqual(forbidden.exception.status_code, 403)

    def test_python_prompt_import_uses_literals_only(self):
        source = '''
COMMON_SYSTEM_PROMPT = "common"
PERSONA_PROMPTS = {
    "moove": "move", "todaki": "comfort",
    "expert": "explain", "lingo": "guide",
}
'''
        prompts = admin_api._parse_python_prompts(source)
        self.assertEqual(prompts["common"], "common")
        self.assertEqual(prompts["lingo"], "guide")
        with self.assertRaises(HTTPException):
            admin_api._parse_python_prompts('COMMON_SYSTEM_PROMPT = open("secret")\nPERSONA_PROMPTS = {}')

    def test_state_payload_limit_and_keys_are_enforced(self):
        admin_api._validate_state("products", [{"id": 1}])
        with self.assertRaises(HTTPException) as unknown:
            admin_api._validate_state("unknown", {})
        self.assertEqual(unknown.exception.status_code, 404)
        with self.assertRaises(HTTPException) as oversized:
            admin_api._validate_state("products", "x" * (admin_api.MAX_STATE_BYTES + 1))
        self.assertEqual(oversized.exception.status_code, 413)


if __name__ == "__main__":
    unittest.main()
