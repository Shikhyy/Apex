#!/usr/bin/env python3
"""Autonomous Daemon to continuously trigger the trading graph loop."""

import os
import time
import requests
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] auto_trader_bot: %(message)s")

API_URL = os.getenv(
    "APEX_API_URL",
    os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:8000"),
)
CYCLE_INTERVAL = float(os.getenv("APEX_AUTOTRADE_INTERVAL_SECONDS", "30"))

def _trigger_cycle():
    url = f"{API_URL}/cycle"
    try:
        logging.info("Triggering new trading cycle...")
        response = requests.post(url, timeout=5)
        
        if response.status_code == 200:
            logging.info("Cycle started successfully. Real-time events logged to Dashboard.")
        elif response.status_code == 429:
            logging.warning(f"Rate limited by API: {response.text}")
        elif response.status_code == 409:
            logging.warning("Cycle is already running. Delaying...")
        else:
            logging.error(f"Unexpected response ({response.status_code}): {response.text}")

    except requests.exceptions.RequestException as e:
        logging.error(f"Backend unreachable: {e}")

def main():
    logging.info(f"Starting APEX Autonomous AI Trader...")
    logging.info(f"Targeting: {API_URL}")
    logging.info(f"Interval: {CYCLE_INTERVAL} seconds")
    
    # Simple Healthcheck
    try:
        health = requests.get(f"{API_URL}/health", timeout=5).json()
        logging.info(f"Backend Status: {health.get('status')} | Private Key Loaded: {health.get('apex_private_key_set')}")
    except Exception:
        logging.warning("Backend is warming up or not started...")

    while True:
        try:
            _trigger_cycle()
        except KeyboardInterrupt:
            logging.info("Shutting down autonomous trader.")
            sys.exit(0)
        except Exception as e:
            logging.error(f"Error in trader bot: {str(e)}")
            
        time.sleep(CYCLE_INTERVAL)

if __name__ == "__main__":
    main()
