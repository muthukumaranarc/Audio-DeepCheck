# Audio DeepCheck - FastAPI Main Application
import logging
import sys
import uuid
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import APP_TITLE, APP_DESCRIPTION, APP_VERSION
from app.api.routes import router as api_router
from app.api.schemas import ErrorResponse

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("audio_deepcheck")

# Initialize FastAPI application
app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    """
    Middleware managing request correlation IDs (X-Request-ID)
    and request lifecycle timing. Never logs audio data.
    """
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    request.state.request_id = request_id

    logger.debug("Handling request: %s %s [ID: %s]", request.method, request.url.path, request_id)

    response = await call_next(request)

    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle explicit HTTP exceptions with standardized ErrorResponse."""
    req_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            detail=str(exc.detail),
            error_code=f"HTTP_{exc.status_code}",
            request_id=req_id,
        ).model_dump(),
        headers={"X-Request-ID": req_id} if req_id else {},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic request validation errors."""
    req_id = getattr(request.state, "request_id", None)
    error_messages = "; ".join(f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in exc.errors())
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            detail=f"Request validation failed: {error_messages}",
            error_code="VALIDATION_ERROR",
            request_id=req_id,
        ).model_dump(),
        headers={"X-Request-ID": req_id} if req_id else {},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler preventing stack trace leakage
    while logging full error details internally.
    """
    req_id = getattr(request.state, "request_id", None)
    logger.error("Unhandled server exception for request %s: %s", req_id, str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            detail="An unexpected internal server error occurred while processing the request.",
            error_code="INTERNAL_SERVER_ERROR",
            request_id=req_id,
        ).model_dump(),
        headers={"X-Request-ID": req_id} if req_id else {},
    )


# Mount API Routes
app.include_router(api_router)


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root to OpenAPI interactive documentation."""
    return RedirectResponse(url="/docs")
