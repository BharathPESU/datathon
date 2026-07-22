import os
import socket
import subprocess
import uvicorn
from main import app

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_frontend_if_needed():
    is_local = os.getenv('X_ZOHO_CATALYST_IS_LOCAL', 'true').lower() == 'true'
    if is_local:
        frontend_port = 3000
        if not is_port_in_use(frontend_port):
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
            frontend_dir = os.path.join(project_root, 'frontend')
            if os.path.exists(frontend_dir):
                print(f"💻 [Catalyst Serve] Launching Next.js frontend dev server on http://localhost:{frontend_port}...")
                subprocess.Popen(
                    ["npm", "run", "dev"],
                    cwd=frontend_dir,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

if __name__ == "__main__":
    start_frontend_if_needed()
    port = int(os.getenv('X_ZOHO_CATALYST_LISTEN_PORT', 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, ws="none")
