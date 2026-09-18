# Audio DeepCheck - Score Calibration Abstraction Layer
from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple, Optional
import numpy as np

from app.services.evidence_contract import CalibrationStatus


class BaseCalibrator(ABC):
    """Abstract base class for probability and evidence score calibrators."""

    @abstractmethod
    def calibrate(self, raw_score: float, module: str = "") -> Tuple[float, str]:
        """
        Transform a raw model score into a calibrated score.
        Returns:
            Tuple of (calibrated_score: float, calibration_status: str)
        """
        pass


class IdentityCalibrator(BaseCalibrator):
    """
    Default pass-through calibrator.
    Does not alter raw scores, explicitly marking them as NOT_CALIBRATED.
    """

    def calibrate(self, raw_score: float, module: str = "") -> Tuple[float, str]:
        # Clip score safely to [0.0, 1.0]
        clipped = float(np.clip(raw_score, 0.0, 1.0))
        return clipped, CalibrationStatus.NOT_CALIBRATED


class TemperatureScaler(BaseCalibrator):
    """
    Temperature scaling calibrator for softmax outputs:
    p_cal = p^(1/T) / (p^(1/T) + (1-p)^(1/T)).
    T > 1 softens overconfident predictions.
    T < 1 sharpens underconfident predictions.
    """

    def __init__(self, temperature: float = 1.0, is_fitted: bool = False):
        self.temperature = max(0.01, float(temperature))
        self.is_fitted = is_fitted

    def calibrate(self, raw_score: float, module: str = "") -> Tuple[float, str]:
        raw_score = float(np.clip(raw_score, 1e-6, 1.0 - 1e-6))
        logit = np.log(raw_score / (1.0 - raw_score))
        scaled_logit = logit / self.temperature
        cal_score = float(1.0 / (1.0 + np.exp(-scaled_logit)))
        status = CalibrationStatus.CALIBRATED_PLATT if self.is_fitted else CalibrationStatus.NOT_CALIBRATED
        return cal_score, status


class PlattCalibrator(BaseCalibrator):
    """
    Platt logistic scaling:
    p_cal = 1 / (1 + exp(A * x + B)).
    Architecture ready for future fitting on large telephony datasets.
    """

    def __init__(self, a: float = -1.0, b: float = 0.0, is_fitted: bool = False):
        self.a = float(a)
        self.b = float(b)
        self.is_fitted = is_fitted

    def calibrate(self, raw_score: float, module: str = "") -> Tuple[float, str]:
        # raw_score as input feature
        val = self.a * raw_score + self.b
        cal_score = float(1.0 / (1.0 + np.exp(np.clip(val, -50.0, 50.0))))
        status = CalibrationStatus.CALIBRATED_PLATT if self.is_fitted else CalibrationStatus.NOT_CALIBRATED
        return cal_score, status


class CalibrationRegistry:
    """
    Central registry mapping module names to their assigned calibrators.
    Defaults to IdentityCalibrator for all modules until formal multi-dataset
    calibration is performed in future milestones.
    """

    def __init__(self):
        self._calibrators: Dict[str, BaseCalibrator] = {}
        self._default_calibrator = IdentityCalibrator()

    def register(self, module: str, calibrator: BaseCalibrator):
        self._calibrators[module.lower()] = calibrator

    def get(self, module: str) -> BaseCalibrator:
        return self._calibrators.get(module.lower(), self._default_calibrator)

    def calibrate(self, raw_score: float, module: str) -> Tuple[float, str]:
        calibrator = self.get(module)
        return calibrator.calibrate(raw_score, module=module)
