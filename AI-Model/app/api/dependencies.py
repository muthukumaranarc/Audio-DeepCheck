# Audio DeepCheck - API Dependencies & Concurrency Guard
import asyncio
from typing import AsyncGenerator, Optional, List
from fastapi import HTTPException, status

from app.config import ANALYSIS_CONCURRENCY, SEMAPHORE_TIMEOUT_SEC
from app.services.fusion_service import FusionService, FusionConfig

# Global semaphore guarding CPU & RAM from concurrent inference overload
_concurrency_semaphore: Optional[asyncio.Semaphore] = None


def get_concurrency_semaphore() -> asyncio.Semaphore:
    """Retrieve or initialize the global asyncio semaphore."""
    global _concurrency_semaphore
    if _concurrency_semaphore is None:
        _concurrency_semaphore = asyncio.Semaphore(ANALYSIS_CONCURRENCY)
    return _concurrency_semaphore


async def acquire_concurrency_permit() -> AsyncGenerator[None, None]:
    """
    Dependency that enforces ANALYSIS_CONCURRENCY.
    Prevents parallel heavyweight model execution from exceeding 8 GB RAM.
    """
    semaphore = get_concurrency_semaphore()
    try:
        acquired = await asyncio.wait_for(semaphore.acquire(), timeout=SEMAPHORE_TIMEOUT_SEC)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Analysis capacity reached ({ANALYSIS_CONCURRENCY} concurrent job limit). "
                f"Timed out after {SEMAPHORE_TIMEOUT_SEC:.0f}s waiting for an available inference worker."
            ),
        )

    try:
        yield
    finally:
        semaphore.release()


def get_fusion_service():
    """
    Factory dependency providing a callable to create FusionService instances.
    Can be overridden in tests via app.dependency_overrides to mock expensive models.
    """
    def _create_service(
        chunk_sec: Optional[float] = None,
        hop_sec: Optional[float] = None,
        ablate: Optional[List[str]] = None,
    ) -> FusionService:
        config = FusionConfig(
            chunk_sec=chunk_sec if chunk_sec is not None else 5.0,
            hop_sec=hop_sec if hop_sec is not None else 2.5,
            ablate_modules=ablate or [],
        )
        return FusionService(config=config)

    return _create_service
