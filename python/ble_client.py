import asyncio
import datetime
import os
import struct
import logging
from bleak import BleakClient, BleakScanner
from websockets.sync.client import connect

# ===== CONFIGURATION =====
NU7_MACS = [
    "00:18:80:72:47:91",
    "00:18:80:AF:58:63",
]
QUAT_CHAR_UUID = "12345678-1234-1234-1234-1234567890AC"
MTU_REQUEST_SIZE = 70
LOG_FILE = f"nu7_log_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

# Logging setup
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

connected_devices = {}  # mac -> BleakClient
quaternion_data = {}    # mac -> {imu_id -> 8-byte data}

# Write screen-safe output
clear = lambda: os.system('cls' if os.name == 'nt' else 'clear')

def format_quaternion_data(device_mac):
    imu_map = quaternion_data.get(device_mac, {})
    name = device_names.get(device_mac, "Unknown")
    lines = [f"Data from {device_mac} ({name}):"]
    for imu_id in sorted(imu_map.keys()):
        data = imu_map[imu_id]
        qx, qy, qz, qw = struct.unpack("<hhhh", data)
        lines.append(f"IMU{imu_id} qx = {qx/16384.0:.4f} qy = {qy/16384.0:.4f} qz = {qz/16384.0:.4f} qw = {qw/16384.0:.4f}")
    return "\n".join(lines)

def send_all_device_data_to_websocket():
    """Collect data from all connected devices and send as a single message."""
    if not quaternion_data:
        return
    
    all_lines = []
    for device_mac in sorted(quaternion_data.keys()):
        imu_map = quaternion_data[device_mac]
        name = device_names.get(device_mac, "Unknown")
        all_lines.append(f"Data from {device_mac} ({name}):")
        for imu_id in sorted(imu_map.keys()):
            data = imu_map[imu_id]
            qx, qy, qz, qw = struct.unpack("<hhhh", data)
            all_lines.append(f"IMU{imu_id} qx = {qx/16384.0:.4f} qy = {qy/16384.0:.4f} qz = {qz/16384.0:.4f} qw = {qw/16384.0:.4f}")
    
    if all_lines:
        try:
            uri = "ws://localhost:8001/ble"
            with connect(uri) as websocket:
                message = "\n".join(all_lines)
                websocket.send(message)
        except Exception as e:
            logging.error(f"Failed to send data to WebSocket server: {e}")

def notification_handler(mac):
    def handler(sender, data):
        try:
            offset = 0
            local_data = {}
            while offset + 9 <= len(data):
                imu_id = data[offset]
                imu_data = data[offset + 1:offset + 9]
                local_data[imu_id] = imu_data
                offset += 9
            quaternion_data[mac] = local_data
            logging.info(f"{mac}: Received {len(local_data)} IMU packets")
        except Exception as e:
            logging.error(f"{mac}: Notification parse error: {e}")
    return handler

async def connect_to_nu7(mac):
    try:
        logging.info(f"Attempting to connect to {mac}...")
        client = BleakClient(mac)
        await client.connect()
        # logging.info(f"Connected to {mac}, requesting MTU...")
        logging.info(f"Connected to {mac}. (MTU negotiation not supported on Windows)")
        connected_devices[mac] = client
        return True
    except Exception as e:
        logging.error(f"Connection failed for {mac}: {e}")
        return False

async def disconnect_all():
    for mac, client in connected_devices.items():
        try:
            await client.stop_notify(QUAT_CHAR_UUID)
            await client.disconnect()
            logging.info(f"Disconnected from {mac}")
        except Exception as e:
            logging.warning(f"Error disconnecting {mac}: {e}")
    connected_devices.clear()

async def stop_notifications():
    for mac, client in connected_devices.items():
        try:
            await client.stop_notify(QUAT_CHAR_UUID)
            logging.info(f"Stopped notify from {mac}")
        except Exception as e:
            logging.warning(f"Notify stop failed for {mac}: {e}")

async def reconnect_lost():
    for mac in list(connected_devices):
        client = connected_devices[mac]
        if not client.is_connected:
            logging.warning(f"{mac} disconnected. Attempting to reconnect...")
            try:
                await client.connect()
                await client.start_notify(QUAT_CHAR_UUID, notification_handler(mac))
                logging.info(f"{mac} reconnected successfully")
            except Exception as e:
                logging.error(f"Reconnection failed for {mac}: {e}")
                del connected_devices[mac]

async def get_advertised_names():
    devices = await BleakScanner.discover(timeout=5.0)
    adv_names = {
        dev.address.upper(): dev.name
        for dev in devices
        if dev.name and dev.name.startswith("NU7")
    }
    return adv_names

device_names = {}

async def scan_and_connect():
    global device_names
    # print("Attempting direct connection to NU7 devices...")
    logging.info("Attempting direct connection to known NU7 MACs.")
    found = False
    
    # Scan only NU7-named devices
    adv_map = await get_advertised_names()
    
    for mac in NU7_MACS:
        if mac in connected_devices:
            print(f"Already connected to NU7 MAC {mac} ({device_names[mac]}).")
            logging.info(f"Already connected to NU7 MAC {mac} ({device_names[mac]}).")
            continue  # Already connected
        
        # Only attempt connection if it's seen during scan
        if mac not in adv_map:
            print(f"NU7 MAC {mac} not found in scan results.")
            logging.info(f"NU7 MAC {mac} not found in scan results.")
            continue

        try:
            print(f"Attempting direct connection to known NU7 MAC {mac} ({adv_map.get(mac, "NU7")}).")
            logging.info(f"Attempting direct connection to known NU7 MAC {mac} ({adv_map.get(mac, "NU7")}).")
            result = await connect_to_nu7(mac)
            if result:
                found = True
                device_names[mac] = adv_map.get(mac, "NU7")
                print(f"Connected to {mac} ({device_names[mac]})")
                logging.info(f"Connected to {mac} ({device_names[mac]})")
            else:
                print(f"NU7 MAC {mac} device not found.")
                logging.info(f"NU7 MAC {mac} device not found.")
            if len(connected_devices) >= 2:
                break
        except Exception as e:
            print(f"Direct connect error for {mac}: {e}")
            logging.error(f"Direct connect error for {mac}: {e}")
    return found


async def stage2():
    import threading
    for mac, client in connected_devices.items():
        await client.start_notify(QUAT_CHAR_UUID, notification_handler(mac))
        logging.info(f"Started notify on {mac} in stage 2.")

    user_choice = None

    def read_input():
        nonlocal user_choice
        while user_choice not in ("1", "2"):
            choice = input().strip()
            if choice in ("1", "2"):
                user_choice = choice

    input_thread = threading.Thread(target=read_input)
    input_thread.daemon = True
    input_thread.start()

    try:
        while user_choice not in ("1", "2"):
            clear()
            print("option 1: stop\noption 2: exit\n")
            for mac in connected_devices:
                fmt_data = format_quaternion_data(mac)
                print(f"{fmt_data}")
                logging.info(f"{fmt_data}")
            # Send all device data to WebSocket server
            send_all_device_data_to_websocket()
            print("\n(Type your choice and press Enter)")
            await reconnect_lost()
            await asyncio.sleep(1)
    finally:
        if user_choice == "1":
            await stop_notifications()
        elif user_choice == "2":
            await disconnect_all()


async def main_loop():
    while True:
        if not connected_devices:
            print("option 1: scan and connect NU7 devices\noption 2: exit")
            choice = input().strip()
            if choice == "1":
                found = await scan_and_connect()
                #if not found:
                #    print("No NU7 device found.")
            elif choice == "2":
                await disconnect_all()
                break
        elif len(connected_devices) < 2:
            print("option 1: scan and connect to 2nd NU7 device\noption 2: Start readings\noption 3: exit")
            choice = input().strip()
            if choice == "1":
                found = await scan_and_connect()
                #if not found:
                #    print("NU7 device not found.")
            elif choice == "2":
                await stage2()
            elif choice == "3":
                await disconnect_all()
                break
        else:
            print("Both device are connected")
            print("option 1: Start readings\noption 2: exit")
            choice = input().strip()
            if choice == "1":
                await stage2()
            elif choice == "2":
                await disconnect_all()
                break

if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        asyncio.run(disconnect_all())
        print("\nExited cleanly.")
 