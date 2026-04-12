"""
Time-series modeling service for CostPilot.

Implements:
  - STL Decomposition (Trend + Seasonality + Residual)
  - Holt-Winters Exponential Smoothing forecast (7-day horizon)
  - Rolling statistics (Bollinger bands for anomaly context)

Used in:
  - /api/costs/forecast  (dashboard forecast band)
  - anomaly_detector.py  (residual-based anomaly scoring)

Paper section: Section 3.2 — Time-Series Decomposition
  y(t) = T(t) + S(t) + ε(t)
"""

import numpy as np
import pandas as pd
import logging

logger = logging.getLogger(__name__)


def _safe_import_statsmodels():
    try:
        from statsmodels.tsa.seasonal import STL
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        return STL, ExponentialSmoothing
    except ImportError:
        return None, None


class TimeSeriesAnalyzer:
    """
    Decomposes a cost time-series and generates short-horizon forecasts.

    Usage:
        analyzer = TimeSeriesAnalyzer()
        result   = analyzer.forecast(series, steps=7)
        rolling  = analyzer.rolling_stats(df)
    """

    def decompose(self, series: pd.Series, period: int = 7) -> dict:
        """
        STL decomposition of cost time-series.

        Args:
            series: pd.Series with DatetimeIndex, daily frequency
            period: seasonal period in days (default=7 for weekly)

        Returns:
            dict with keys: trend, seasonal, residual (each as list)
        """
        STL, _ = _safe_import_statsmodels()
        if STL is None or len(series) < period * 2:
            logger.warning("statsmodels unavailable or insufficient data — using fallback decomposition")
            return self._fallback_decompose(series)

        try:
            # robust=True handles outliers gracefully (important for cost data)
            stl = STL(series.astype(float), period=period, robust=True)
            result = stl.fit()
            return {
                "trend":    result.trend.tolist(),
                "seasonal": result.seasonal.tolist(),
                "residual": result.resid.tolist(),
                "dates":    [d.isoformat() for d in series.index],
            }
        except Exception as e:
            logger.error(f"STL decomposition failed: {e}")
            return self._fallback_decompose(series)

    def _fallback_decompose(self, series: pd.Series) -> dict:
        """Fallback: rolling mean as trend, deviation as residual."""
        values = series.values.astype(float)
        window = min(7, len(values))
        trend = pd.Series(values).rolling(window, center=True, min_periods=1).mean().values
        residual = values - trend
        return {
            "trend":    trend.tolist(),
            "seasonal": [0.0] * len(values),
            "residual": residual.tolist(),
            "dates":    [d.isoformat() if hasattr(d, "isoformat") else str(d) for d in series.index],
        }

    def forecast(self, series: pd.Series, steps: int = 7) -> dict:
        """
        Holt-Winters triple exponential smoothing forecast.

        Paper formula:
            ŷ(t+h) = l(t) + h·b(t) + s(t+h-m)
        where l=level, b=trend slope, s=seasonal component.

        Args:
            series: Historical daily cost series with DatetimeIndex
            steps:  Forecast horizon in days

        Returns:
            dict with forecast, lower/upper confidence bounds, and dates
        """
        _, ExponentialSmoothing = _safe_import_statsmodels()

        if ExponentialSmoothing is None or len(series) < 14:
            return self._fallback_forecast(series, steps)

        try:
            model = ExponentialSmoothing(
                series.astype(float),
                trend="add",
                seasonal="add",
                seasonal_periods=7,
                initialization_method="estimated",
            )
            fit = model.fit(optimized=True, use_brute=False)
            forecast_values = fit.forecast(steps)

            # 95% confidence interval using residual standard deviation
            std_err = float(np.std(fit.resid) * 1.96)
            lower = (forecast_values - std_err).clip(lower=0)
            upper = forecast_values + std_err

            last_date = series.index[-1]
            future_dates = pd.date_range(
                start=last_date + pd.Timedelta(days=1),
                periods=steps,
                freq="D",
            )

            return {
                "forecast": [round(v, 2) for v in forecast_values.tolist()],
                "lower":    [round(v, 2) for v in lower.tolist()],
                "upper":    [round(v, 2) for v in upper.tolist()],
                "dates":    [d.strftime("%Y-%m-%d") for d in future_dates],
                "method":   "holt_winters",
            }

        except Exception as e:
            logger.error(f"Holt-Winters forecast failed: {e}")
            return self._fallback_forecast(series, steps)

    def _fallback_forecast(self, series: pd.Series, steps: int) -> dict:
        """Simple linear extrapolation fallback."""
        values = np.array(series.values, dtype=float)
        if len(values) == 0:
            return {"forecast": [], "lower": [], "upper": [], "dates": [], "method": "fallback_empty"}
        mean = float(np.mean(values[-7:]) if len(values) >= 7 else np.mean(values))
        std  = float(np.std(values[-7:]) if len(values) >= 7 else np.std(values))
        forecast = [round(mean, 2)] * steps
        lower    = [round(max(0, mean - 1.96 * std), 2)] * steps
        upper    = [round(mean + 1.96 * std, 2)] * steps
        last_date = pd.Timestamp(series.index[-1]) if hasattr(series.index[-1], "to_pydatetime") else pd.Timestamp.today()
        dates = [(last_date + pd.Timedelta(days=i + 1)).strftime("%Y-%m-%d") for i in range(steps)]
        return {"forecast": forecast, "lower": lower, "upper": upper, "dates": dates, "method": "fallback_mean"}

    def rolling_stats(self, df: pd.DataFrame, cost_col: str = "cost", window: int = 7) -> pd.DataFrame:
        """
        Compute rolling statistics and Bollinger bands.

        Bollinger Bands:
            Upper = μ_7d + 2σ_7d
            Lower = μ_7d - 2σ_7d

        These serve as a dynamic threshold for the dashboard.
        """
        df = df.copy().sort_values("date" if "date" in df.columns else df.columns[0])
        df["rolling_mean"]       = df[cost_col].rolling(window, min_periods=1).mean()
        df["rolling_std"]        = df[cost_col].rolling(window, min_periods=1).std().fillna(0)
        df["bollinger_upper"]    = df["rolling_mean"] + 2.0 * df["rolling_std"]
        df["bollinger_lower"]    = (df["rolling_mean"] - 2.0 * df["rolling_std"]).clip(lower=0)
        return df
