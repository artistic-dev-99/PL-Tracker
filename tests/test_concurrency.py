import subprocess
import time
import urllib.request
import urllib.error
import json
import threading
import os
import sys

PORT = 5005
API_URL = f"http://127.0.0.1:{PORT}"
TEST_DB = "test_pl_tracker.db"

# Ensure clean state
if os.path.exists(TEST_DB):
    try:
        os.remove(TEST_DB)
    except Exception:
        pass

print("Starting test server...")
# Start server process with environment configurations
env = os.environ.copy()
env["PL_TRACKER_DB"] = TEST_DB
env["PL_TRACKER_PORT"] = str(PORT)
env["PL_TRACKER_HOST"] = "127.0.0.1"

# We start server from workspace root
server_proc = subprocess.Popen(
    [sys.executable, "server/server.py"],
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Wait for server to boot
time.sleep(2)

def make_request(url, method="GET", data=None):
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        data_bytes = json.dumps(data).encode("utf-8")
        req.data = data_bytes
    
    try:
        with urllib.request.urlopen(req, timeout=10.0) as response:
            res_data = response.read().decode("utf-8")
            return response.status, json.loads(res_data)
    except urllib.error.HTTPError as e:
        res_data = e.read().decode("utf-8")
        try:
            return e.code, json.loads(res_data)
        except Exception:
            return e.code, {"message": res_data}
    except Exception as e:
        return 500, {"message": str(e)}

try:
    # 1. DB Status check (should be empty)
    status_code, body = make_request(f"{API_URL}/api/db-status")
    print("Initial DB Status:", body)
    assert body["db_empty"] is True, "Database should be initially empty"

    # 2. Setup First Admin Account
    status_code, body = make_request(f"{API_URL}/api/auth/setup", "POST", {
        "username": "boss",
        "password": "bosspassword"
    })
    print("Admin Setup Status:", body)
    assert status_code == 200, "Admin setup failed"

    # Check status again
    status_code, body = make_request(f"{API_URL}/api/db-status")
    assert body["db_empty"] is False, "Database should not be empty now"

    # 3. Login as Admin
    status_code, body = make_request(f"{API_URL}/api/auth/login", "POST", {
        "username": "boss",
        "password": "bosspassword"
    })
    assert status_code == 200, "Admin login failed"
    admin_id = body["user"]["userid"]

    # 4. Register Local User "abdul"
    status_code, body = make_request(f"{API_URL}/api/auth/register", "POST", {
        "admin_username": "boss",
        "admin_password": "bosspassword",
        "new_username": "abdul",
        "new_password": "abdulpassword",
        "new_role": "Local"
    })
    print("User Registration:", body)
    assert status_code == 200, "Local user registration failed"

    # Login as abdul
    status_code, body = make_request(f"{API_URL}/api/auth/login", "POST", {
        "username": "abdul",
        "password": "abdulpassword"
    })
    assert status_code == 200, "Local login failed"
    abdul_id = body["user"]["userid"]

    # 5. Concurrent submission test
    # We will launch multiple threads submitting concurrently to simulate multiple client PCs.
    results = []
    errors = []
    lock = threading.Lock()

    def submit_task(user_id, work_order, pack_no, index):
        payload = {
            "userid": user_id,
            "work_order": work_order,
            "pack_no": pack_no,
            "pl_type": "New",
            "sub_pl_type": "With ASN",
            "location": "B1 GF",
            "customer": "AEO",
            "timestamp": "2026-07-11 12:00:00" # Use fixed timestamp for day counter resets
        }
        try:
            status, res_body = make_request(f"{API_URL}/api/entries/submit", "POST", payload)
            with lock:
                if status == 200:
                    results.append(res_body["entry"])
                else:
                    errors.append(res_body.get("message", "Unknown error"))
        except Exception as e:
            with lock:
                errors.append(str(e))

    threads = []
    # 20 concurrent requests (10 by boss, 10 by abdul)
    print("Launching 20 concurrent submit threads...")
    for i in range(10):
        t1 = threading.Thread(target=submit_task, args=(admin_id, 200000010 + i, 40010 + i, i))
        t2 = threading.Thread(target=submit_task, args=(abdul_id, 300000010 + i, 50010 + i, i))
        threads.append(t1)
        threads.append(t2)

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    print(f"Submissions complete. Successes: {len(results)}, Errors: {len(errors)}")
    if errors:
        print("First few errors:", errors[:3])
    
    assert len(results) == 20, f"Expected 20 successful submissions, got {len(results)}"

    # 6. Verify ID sequences are uniquely and sequentially incremented
    # Collect generated values
    master_ids = [r["master_unique_id"] for r in results]

    # Check master unique IDs are 1 to 20
    master_ids.sort()
    print("Master Unique IDs generated:", master_ids)
    assert master_ids == list(range(1, 21)), "Master IDs are not perfectly sequential!"

    # Query all entries to double check order
    status, entries = make_request(f"{API_URL}/api/entries/query")
    print(f"Total entries queried from server: {len(entries)}")
    
    print("\n--- Concurrency and Sequence ID Verification Success! ---")

finally:
    # Kill the subprocess server
    print("Shutting down test server...")
    server_proc.terminate()
    try:
        server_proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server_proc.kill()
    
    # Cleanup DB
    if os.path.exists(TEST_DB):
        try:
            os.remove(TEST_DB)
        except Exception:
            pass
