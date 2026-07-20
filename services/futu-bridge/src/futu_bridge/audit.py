from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Iterable, Set, Tuple


class AuditStore:
    def __init__(self, path: Path):
        self.path = path

    def append(self, event: str, payload: Dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        record = {"timestamp": datetime.now(timezone.utc).isoformat(), "event": event, **payload}
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, default=str, separators=(",", ":")) + "\n")

    def records(self) -> Iterable[Dict[str, Any]]:
        if not self.path.exists():
            return []
        records = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return records

    def submitted_idempotency_keys(self) -> Set[str]:
        return {
            str(record.get("idempotencyKey"))
            for record in self.records()
            if record.get("event") == "order_submitted" and record.get("idempotencyKey")
        }

    def daily_submission_totals(self) -> Tuple[int, Decimal]:
        today = datetime.now(timezone.utc).date().isoformat()
        records = [
            record for record in self.records()
            if record.get("event") == "order_submitted" and str(record.get("timestamp", "")).startswith(today)
        ]
        notional = sum((Decimal(str(record.get("notional", "0"))) for record in records), Decimal("0"))
        return len(records), notional
