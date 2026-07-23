import os
import unittest
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../server')))

from app import create_app

class TestEntriesEndpoints(unittest.TestCase):
    def setUp(self):
        self.test_db = 'test_entries.db'
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
        self.app = create_app(self.test_db)
        self.client = self.app.test_client()

        # Setup Admin
        self.client.post('/api/auth/setup', json={'username': 'AdminUser', 'password': 'password123'})
        res_login = self.client.post('/api/auth/login', json={'username': 'AdminUser', 'password': 'password123'})
        self.admin_id = res_login.json['user']['userid']

    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def test_submit_and_query_entries(self):
        res_sub = self.client.post('/api/entries/submit', json={
            'userid': self.admin_id,
            'work_order': 250000001,
            'pack_no': 45001,
            'pl_type': 'New',
            'sub_pl_type': 'With ASN',
            'location': 'B1 GF',
            'customer': 'AEO',
            'mode': 'Mail',
            'timestamp': '2026-07-23 10:00:00'
        })
        self.assertEqual(res_sub.status_code, 200)
        self.assertEqual(res_sub.json['entry']['unique_id_by_user'], 'A001')

        res_q = self.client.get('/api/entries/query?work_order=250000001')
        self.assertEqual(res_q.status_code, 200)
        self.assertEqual(len(res_q.json), 1)

if __name__ == '__main__':
    unittest.main()
