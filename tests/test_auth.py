import os
import unittest
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../server')))

from app import create_app

class TestAuthEndpoints(unittest.TestCase):
    def setUp(self):
        self.test_db = 'test_auth.db'
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
        self.app = create_app(self.test_db)
        self.client = self.app.test_client()

    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def test_auth_setup_and_login(self):
        # 1. Setup Admin
        res_setup = self.client.post('/api/auth/setup', json={'username': 'TestAdmin', 'password': 'password123'})
        self.assertEqual(res_setup.status_code, 200)

        # 2. Login Admin
        res_login = self.client.post('/api/auth/login', json={'username': 'TestAdmin', 'password': 'password123'})
        self.assertEqual(res_login.status_code, 200)
        self.assertIn('user', res_login.json)
        self.assertEqual(res_login.json['user']['role'], 'Admin')

if __name__ == '__main__':
    unittest.main()
