from __future__ import annotations

import platform
import subprocess
from datetime import datetime, timezone
from typing import Dict

from .config import Settings
from .models import RiskAlert


class NotificationService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._last_sent: Dict[str, datetime] = {}

    def notify(self, alert: RiskAlert, cooldown_seconds: int) -> bool:
        now = datetime.now(timezone.utc)
        previous = self._last_sent.get(alert.dedupKey)
        if previous and (now - previous).total_seconds() < cooldown_seconds:
            return False
        self._last_sent[alert.dedupKey] = now
        if not self.settings.futu_macos_notifications_enabled or platform.system() != "Darwin":
            return True
        title = f"WorldMonitor {alert.severity}: {alert.code or alert.type}"
        body = (
            f"Rule {alert.triggeringRule}; price {alert.currentPrice or 'unavailable'}; "
            f"cost {alert.dilutedCost or alert.averageCost or 'unavailable'}; "
            f"weight {alert.currentWeight or 'unavailable'}%; "
            f"side {alert.suggestedSide or 'review'}; qty {alert.suggestedQuantity or 'review'}; "
            f"limit {alert.suggestedLimitPrice or 'review'}; expires {alert.expiresAt or 'n/a'}"
        )
        def apple_string(value: str) -> str:
            return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'

        script = f"display notification {apple_string(body)} with title {apple_string(title)}"
        try:
            subprocess.run(["osascript", "-e", script], check=False, timeout=3, capture_output=True, text=True)
        except (OSError, subprocess.SubprocessError):
            return False
        return True
