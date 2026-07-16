from __future__ import annotations

import csv
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

from .models import Bar


def load_csv(path: str | Path) -> list[Bar]:
    bars: list[Bar] = []
    with Path(path).open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            bars.append(Bar(
                timestamp=datetime.fromisoformat(row["timestamp"]),
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=float(row.get("volume", 0.0)),
            ))
    return bars


def generate_demo_bars(count: int = 600, seed: int = 7) -> list[Bar]:
    """Generate deterministic 5-minute bars for smoke tests; never presented as market data."""
    rng = random.Random(seed)
    bars: list[Bar] = []
    timestamp = datetime(2026, 1, 5, 9, 30)
    previous = 20.0

    for index in range(count):
        if timestamp.hour >= 16:
            timestamp = (timestamp + timedelta(days=1)).replace(hour=9, minute=30)
            while timestamp.weekday() >= 5:
                timestamp += timedelta(days=1)

        cycle = math.sin(index / 14) * 0.035
        if 80 <= index < 210 or 360 <= index < 500:
            drift = 0.045
        elif 240 <= index < 330:
            drift = -0.055
        else:
            drift = 0.005
        noise = rng.uniform(-0.035, 0.035)
        opening = previous
        closing = max(5.0, opening + drift + cycle + noise)
        high = max(opening, closing) + rng.uniform(0.04, 0.12)
        low = min(opening, closing) - rng.uniform(0.04, 0.12)
        bars.append(Bar(timestamp, opening, high, low, closing, rng.randint(10_000, 150_000)))
        previous = closing
        timestamp += timedelta(minutes=5)
    return bars
