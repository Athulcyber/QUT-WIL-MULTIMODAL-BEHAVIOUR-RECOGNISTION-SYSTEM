# ==========================================================
# Neural Nomads – Authenticated Demo Automation Script
# ==========================================================
# Purpose:
# - Automate login and JWT retrieval
# - Send protected requests on a timer
# - Support:
#     1. activity mode -> real dataset upload path
#     2. predict mode  -> controlled demo alert path
# - Optional max request count for cleaner demos
# - Optional WebSocket listener for debugging
# ==========================================================

import argparse
import asyncio
import json
import random
from pathlib import Path
from typing import Optional

import httpx
import websockets

# ==========================================================
# CONFIG
# ==========================================================

# Use the URL that matches your working setup.
# If your app is working through Traefik/proxy, keep localhost.
# If you are directly hitting backend on 8888, change to http://localhost:8888
BASE_URL = "http://localhost"
API_PREFIX = "/api/v1"

LOGIN_URL = f"{BASE_URL}{API_PREFIX}/login/oauth"
WS_URL = f"ws://localhost{API_PREFIX}/activity/ws"

# Dataset path
DATASET_DIR = Path("./")

# Seeded residents
RESIDENTS = [
    "2e921ac3-4a2a-47bf-a92d-9d4689717e57",  # Resident 001
    "3e921ac3-4a2a-47bf-a92d-9d4689717e57",  # Resident 002
]

ENABLE_WEBSOCKET = False
INTERVAL_SECONDS = 5
MODE = "activity"
MAX_REQUESTS: Optional[int] = None


# ==========================================================
# ARGUMENTS
# ==========================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="Neural Nomads authenticated demo automation client"
    )

    parser.add_argument(
        "--mode",
        choices=["activity", "predict"],
        default="activity",
        help="activity = real dataset upload, predict = controlled demo alerts",
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Seconds between requests",
    )

    parser.add_argument(
        "--username",
        default="admin@example.com",
        help="Login username",
    )

    parser.add_argument(
        "--password",
        default="ChangeMe123!123",
        help="Login password",
    )

    parser.add_argument(
        "--max-requests",
        type=int,
        default=None,
        help="Stop automatically after N requests",
    )

    parser.add_argument(
        "--websocket",
        action="store_true",
        help="Enable optional WebSocket listener",
    )

    return parser.parse_args()


# ==========================================================
# LOGIN
# ==========================================================

async def login(username: str, password: str) -> str:
    print("[AUTH] Logging in...")

    data = {
        "username": username,
        "password": password,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(LOGIN_URL, data=data)

        if response.status_code != 200:
            raise Exception(f"Login failed: {response.text}")

        token = response.json().get("access_token")
        if not token:
            raise Exception("Login succeeded but no access_token was returned")

        print("[AUTH] Login successful.")
        return token


# ==========================================================
# DATASET HELPERS
# ==========================================================

def pick_random_sample():
    files = list(DATASET_DIR.glob("*_skeleton.mat"))

    if not files:
        raise FileNotFoundError(
            f"No dataset files found in: {DATASET_DIR.resolve()}"
        )

    skeleton = random.choice(files)
    inertial = Path(str(skeleton).replace("skeleton", "inertial"))
    depth = Path(str(skeleton).replace("skeleton", "depth"))

    if not inertial.exists():
        raise FileNotFoundError(f"Missing inertial pair for {skeleton.name}")

    if not depth.exists():
        raise FileNotFoundError(f"Missing depth pair for {skeleton.name}")

    return skeleton, inertial, depth


# ==========================================================
# ACTIVITY MODE (REAL DATA)
# ==========================================================

async def send_activity_request(token: str):
    resident_id = random.choice(RESIDENTS)
    skeleton, inertial, depth = pick_random_sample()

    print(f"[FILES] Using sample: {skeleton.name}")
    print(f"[ACTIVITY] Sending real dataset upload for resident_id={resident_id}")

    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}{API_PREFIX}/activity/{resident_id}"

    with open(skeleton, "rb") as skeleton_file, \
         open(inertial, "rb") as inertial_file, \
         open(depth, "rb") as depth_file:

        files = {
            "skeleton_file": skeleton_file,
            "inertial_file": inertial_file,
            "depth_file": depth_file,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, files=files, headers=headers)

    print("[ACTIVITY] Status:", response.status_code)

    try:
        print(json.dumps(response.json(), indent=2))
    except Exception:
        print(response.text)


# ==========================================================
# PREDICT MODE (CONTROLLED DEMO ALERT PATH)
# ==========================================================

async def send_predict_request(token: str):
    resident_id = random.choice(RESIDENTS)

    print(f"[PREDICT] Sending controlled alert check for resident_id={resident_id}")

    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}{API_PREFIX}/predict/{resident_id}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers)

    print("[PREDICT] Status:", response.status_code)

    try:
        print(json.dumps(response.json(), indent=2))
    except Exception:
        print(response.text)


# ==========================================================
# LOOP
# ==========================================================

async def send_requests_periodically(token: str):
    count = 0
    await asyncio.sleep(2)

    while True:
        try:
            if MODE == "predict":
                await send_predict_request(token)
            else:
                await send_activity_request(token)

            count += 1

            if MAX_REQUESTS is not None and count >= MAX_REQUESTS:
                print(f"[STOP] Reached max_requests={MAX_REQUESTS}")
                break

            print(f"[LOOP] Sleeping {INTERVAL_SECONDS} seconds...\n")
            await asyncio.sleep(INTERVAL_SECONDS)

        except Exception as e:
            print("[ERROR]", e)
            await asyncio.sleep(3)


# ==========================================================
# WEBSOCKET (OPTIONAL)
# ==========================================================

async def listen_websocket(token: str):
    uri = f"{WS_URL}?token={token}"

    try:
        async with websockets.connect(uri) as websocket:
            print("[WS] Connected")

            while True:
                message = await websocket.recv()
                print("[WS MESSAGE]")
                print(json.dumps(json.loads(message), indent=2))

    except Exception as e:
        print("[WS ERROR]", e)


# ==========================================================
# MAIN
# ==========================================================

async def main():
    global INTERVAL_SECONDS, MODE, MAX_REQUESTS, ENABLE_WEBSOCKET

    print("=" * 60)
    print("Neural Nomads – Authenticated Demo Automation Script")
    print("=" * 60)

    args = parse_args()
    MODE = args.mode
    INTERVAL_SECONDS = args.interval
    MAX_REQUESTS = args.max_requests
    ENABLE_WEBSOCKET = args.websocket

    print(f"[CONFIG] Mode: {MODE}")
    print(f"[CONFIG] Interval: {INTERVAL_SECONDS} seconds")
    print(f"[CONFIG] Max requests: {MAX_REQUESTS}")
    print(f"[CONFIG] WebSocket enabled: {ENABLE_WEBSOCKET}")
    print(f"[CONFIG] Dataset dir: {DATASET_DIR.resolve()}")

    token = await login(args.username, args.password)

    tasks = [asyncio.create_task(send_requests_periodically(token))]

    if ENABLE_WEBSOCKET:
        tasks.append(asyncio.create_task(listen_websocket(token)))

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        print("[STOP] Async tasks cancelled.")
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        print("[STOP] Script exited cleanly.")


# ==========================================================
# RUN
# ==========================================================

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[STOP] Stopped by user.")