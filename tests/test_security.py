from __future__ import annotations

import unittest

from backend.docchat.core.security import create_token, decode_token, hash_password, verify_password


class SecurityTests(unittest.TestCase):
    def test_password_hash_round_trip(self):
        encoded = hash_password("correct horse battery staple", 1000)
        self.assertTrue(verify_password("correct horse battery staple", encoded))
        self.assertFalse(verify_password("wrong password", encoded))

    def test_signed_token_round_trip_and_tamper_detection(self):
        token = create_token("user-123", "secret", 5)
        self.assertEqual(decode_token(token, "secret")["sub"], "user-123")
        self.assertIsNone(decode_token(token + "x", "secret"))
        self.assertIsNone(decode_token(token, "different-secret"))


if __name__ == "__main__":
    unittest.main()
