import json
import tempfile
import unittest
from pathlib import Path

from quant_trader.config import load_config


class ConfigTests(unittest.TestCase):
    def test_default_config_is_simulation_only_and_hkd_300k(self) -> None:
        config = load_config()
        self.assertEqual(config.mode, "SIMULATE")
        self.assertEqual(config.initial_capital_hkd, 300_000)
        self.assertFalse(config.execution.live_trading_enabled)
        self.assertFalse(config.risk.allow_margin)

    def test_live_mode_is_rejected(self) -> None:
        source = Path(__file__).resolve().parents[1] / "config.json"
        payload = json.loads(source.read_text(encoding="utf-8"))
        payload["mode"] = "REAL"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "SIMULATE"):
                load_config(path)


if __name__ == "__main__":
    unittest.main()
