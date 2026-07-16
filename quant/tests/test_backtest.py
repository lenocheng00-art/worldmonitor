import unittest

from quant_trader.backtest import BacktestEngine
from quant_trader.config import load_config
from quant_trader.data import generate_demo_bars


class BacktestTests(unittest.TestCase):
    def test_demo_backtest_respects_capital_and_closes_positions(self) -> None:
        config = load_config()
        result = BacktestEngine(config).run(generate_demo_bars())
        self.assertEqual(result.initial_capital_hkd, 300_000)
        self.assertGreater(result.final_equity_hkd, 0)
        self.assertGreater(len(result.equity_curve), 500)
        self.assertTrue(all(fill.quantity > 0 for fill in result.fills))
        self.assertFalse(config.risk.allow_margin)


if __name__ == "__main__":
    unittest.main()
