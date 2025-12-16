import asyncio
import json
import logging
import re
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from websockets.asyncio.server import serve

logging.basicConfig(level=logging.INFO)

# =========================
# HTTP SERVER (PORT 8000)
# =========================

def start_http_server():
    httpd = HTTPServer(("0.0.0.0", 8000), SimpleHTTPRequestHandler)
    print("HTTP server running at http://localhost:8000")
    httpd.serve_forever()

threading.Thread(target=start_http_server, daemon=True).start()

# =========================
# IMU PARSER
# =========================

RE_IMU = re.compile(
    r"IMU\s*(\d+)\s+qx\s*=\s*([-0-9.eE]+)\s+qy\s*=\s*([-0-9.eE]+)\s+qz\s*=\s*([-0-9.eE]+)\s+qw\s*=\s*([-0-9.eE]+)"
)

def parse_imu_text(text):
    records = []
    for line in text.splitlines():
        m = RE_IMU.search(line)
        if m:
            records.append({
                "imu": int(m.group(1)),
                "x": float(m.group(2)),
                "y": float(m.group(3)),
                "z": float(m.group(4)),
                "w": float(m.group(5)),
            })
    return records

# =========================
# WEBSOCKET STATE (PORT 8001)
# =========================

browser_clients = set()

async def ws_handler(websocket):
    path = websocket.request.path
    print(f"WebSocket connected: {path}")

    if path == "/ws":
        browser_clients.add(websocket)
        print("Browser connected")

        try:
            async for _ in websocket:
                pass
        finally:
            browser_clients.discard(websocket)
            print("Browser disconnected")

    elif path == "/ble":
        print("BLE client connected")

        try:
            async for msg in websocket:
                if isinstance(msg, bytes):
                    msg = msg.decode()

                print("\nBLE MESSAGE:\n", msg)
                records = parse_imu_text(msg)

                payload = {"sensors": {}}
                for r in records:
                    payload["sensors"][f"IMU{r['imu']}"] = {
                        "x": r["x"],
                        "y": r["y"],
                        "z": r["z"],
                        "w": r["w"],
                    }

                text = json.dumps(payload)
                print("Broadcasting:", text)

                for ws in list(browser_clients):
                    try:
                        await ws.send(text)
                    except:
                        browser_clients.discard(ws)

        finally:
            print("BLE client disconnected")

    else:
        await websocket.close()

async def main():
    print("WebSocket server running on ws://localhost:8001")
    print("  Browser → ws://localhost:8001/ws")
    print("  BLE     → ws://localhost:8001/ble")

    async with serve(ws_handler, "0.0.0.0", 8001):
        await asyncio.Future()

asyncio.run(main())
