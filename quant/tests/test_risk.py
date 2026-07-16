import unittest
from datetime import date

from quant_trader.config import load_config
from quant_trader.risk import RiskManager


class RiskTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = load_config()
        self.manager = RiskManager(self.config.risk, self.config.initial_capital_hkd)

    def test_position_size_is_capped_at_ten_percent(self) -> None:
        decision = self.manager.size_entry(
            equity_hkd=300_000,
            cash_hkd=300_000,
            price_hkd=100,
            stop_distance_hkd=5,
            current_gross_hkd=0,
            existing_quantity=0,
            open_positions=0,
        )
        self.assertTrue(decision.allowed)
        self.assertEqual(decision.quantity, 300)

    def test_averaging_down_is_rejected(self) -> None:
        decision = self.manager.size_entry(
            equity_hkd=300_000,
            cash_hkd=250_000,
            price_hkd=100,
            stop_distance_hkd=5,
            current_gross_hkd=50_000,
            existing_quantity=100,
            open_positions=1,
        )
        self.assertFalse(decision.allowed)
        self.assertIn("averaging", decision.reason)

    def test_daily_loss_locks_new_entries(self) -> None:
        self.manager.update_equity(date(2026, 1, 5), 300_000)
        self.manager.update_equity(date(2026, 1, 5), 294_000)
        decision = self.manager.size_entry(
            equity_hkd=294_000,
            cash_hkd=294_000,
            price_hkd=100,
            stop_distance_hkd=5,
            current_gross_hkd=0,
            existing_quantity=0,
            open_positions=0,
        )
        self.assertFalse(decision.allowed)
        self.assertIn("daily loss", decision.reason)


if __name__ == "__main__":
    unittest.main()
