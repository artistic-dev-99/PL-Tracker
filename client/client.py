import webview
import os
import sys
import json
import socket

class ClientAPI:
    def __init__(self):
        self.config_path = "client_config.json"

    def get_config(self):
        if not os.path.exists(self.config_path):
            return {"server_ip": "127.0.0.1", "server_port": 5000}
        try:
            with open(self.config_path, "r") as f:
                return json.load(f)
        except Exception:
            return {"server_ip": "127.0.0.1", "server_port": 5000}

    def save_config(self, config):
        try:
            with open(self.config_path, "w") as f:
                json.dump(config, f, indent=4)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_local_ip(self):
        try:
            # Connect to a dummy external IP to determine local socket interface IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

from pathlib import Path

def resolve_index_path():
    base = Path(sys._MEIPASS) if hasattr(sys, '_MEIPASS') else Path.cwd()
    for rel in ["client/static/index.html", "static/index.html"]:
        candidate = base / rel
        if candidate.exists():
            return str(candidate.resolve())
    return str((Path.cwd() / "static" / "index.html").resolve())

def main():
    api = ClientAPI()
    assets_dir = resolve_index_path()

    # Start PyWebView
    webview.create_window(
        title="PL Tracker - Packing List Management System",
        url=assets_dir,
        js_api=api,
        width=1280,
        height=850,
        resizable=True,
        min_size=(1024, 768),
        background_color='#0f172a' # Dark slate background to match theme on launch
    )
    
    webview.start()

if __name__ == "__main__":
    main()
