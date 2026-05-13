#!/usr/bin/env python3
"""
GymTrack server — serves static files + handles Apple Health data API.
Run: python3 server.py
"""
import http.server, json, socket, socketserver
from pathlib import Path
from datetime import datetime, date
from urllib.parse import urlparse, parse_qs

PORT = 8080
BASE = Path(__file__).parent
HEALTH_FILE = BASE / 'health_data.json'
DATA_FILE   = BASE / 'gym_data.json'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE), **kwargs)

    def do_GET(self):
        if self.path == '/api/data':
            self._send_json(self._load_data())
        elif self.path == '/api/health':
            self._send_json(self._load_health())
        elif self.path == '/api/info':
            self._send_json({'ip': _local_ip(), 'port': PORT})
        elif self.path.startswith('/api/sync'):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            today = str(date.today())
            entry = {
                'date': today,
                'activeEnergy':  round(float(params.get('active',  [0])[0]), 1),
                'restingEnergy': round(float(params.get('resting', [0])[0]), 1),
                'steps':         round(float(params.get('steps',   [0])[0])),
                'updatedAt': datetime.now().isoformat()
            }
            data = self._load_health()
            data[today] = entry
            HEALTH_FILE.write_text(json.dumps(data, indent=2))
            self._send_json({'ok': True, 'date': today})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/data':
            length = int(self.headers.get('Content-Length', 0))
            try:
                payload = json.loads(self.rfile.read(length))
                DATA_FILE.write_text(json.dumps(payload, indent=2))
                self._send_json({'ok': True})
            except Exception as e:
                self._send_json({'error': str(e)}, 400)
        elif self.path == '/api/health':
            length = int(self.headers.get('Content-Length', 0))
            try:
                payload = json.loads(self.rfile.read(length))
                day = payload.get('date') or str(date.today())
                data = self._load_health()
                data[day] = {**payload, 'date': day, 'updatedAt': datetime.now().isoformat()}
                HEALTH_FILE.write_text(json.dumps(data, indent=2))
                self._send_json({'ok': True, 'date': day})
            except Exception as e:
                self._send_json({'error': str(e)}, 400)
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _load_data(self):
        if DATA_FILE.exists():
            try:
                return json.loads(DATA_FILE.read_text())
            except Exception:
                pass
        return {}

    def _load_health(self):
        if HEALTH_FILE.exists():
            try:
                return json.loads(HEALTH_FILE.read_text())
            except Exception:
                pass
        return {}

    def log_message(self, fmt, *args):
        pass  # suppress per-request logs


def _local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'


if __name__ == '__main__':
    ip = _local_ip()
    server = socketserver.TCPServer(('', PORT), Handler)
    server.allow_reuse_address = True
    print(f'\n  GymTrack running at:')
    print(f'  Mac:    http://localhost:{PORT}')
    print(f'  iPhone: http://{ip}:{PORT}')
    print(f'\n  Press Ctrl+C to stop.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
