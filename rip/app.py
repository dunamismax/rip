from __future__ import annotations

import asyncio
import contextlib
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Awaitable, Callable

from fastapi import FastAPI, Form, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import Settings, load_settings
from .download_manager import DownloadManager, EventBus
from .models import DownloadRequest, ExtractRequest, VideoMetadata
from .rate_limit import RateLimiter
from .ytdlp import YtdlpError, extract_metadata

Extractor = Callable[[str, Settings], Awaitable[VideoMetadata]]

PACKAGE_ROOT = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(PACKAGE_ROOT / "templates"))
templates.env.filters["bytes"] = lambda value: _format_bytes(value)
templates.env.filters["speed"] = lambda value: _format_speed(value)
templates.env.filters["duration"] = lambda value: _format_duration(value)


def create_app(settings: Settings | None = None, extractor: Extractor = extract_metadata) -> FastAPI:
    settings = settings or load_settings()
    bus = EventBus()
    manager = DownloadManager(settings, bus)
    extract_limiter = RateLimiter(10, 60)
    download_limiter = RateLimiter(20, 60)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        await manager.start()
        try:
            yield
        finally:
            await manager.shutdown()

    app = FastAPI(lifespan=lifespan)
    app.mount("/static", StaticFiles(directory=str(PACKAGE_ROOT / "static")), name="static")
    app.state.settings = settings
    app.state.manager = manager
    app.state.bus = bus

    @app.middleware("http")
    async def body_size_limit(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > settings.request_body_limit_bytes:
                    return JSONResponse({"error": "Request body too large."}, status_code=413)
            except ValueError:
                pass
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_request: Request, _exc: RequestValidationError):
        return JSONResponse({"error": "Invalid request."}, status_code=400)

    @app.get("/", response_class=HTMLResponse)
    async def home(request: Request, notice: str | None = None):
        downloads = await manager.get_all()
        return templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "notice": notice,
                "downloads": downloads,
                "metadata": None,
                "extract_url": "",
                "extract_error": None,
                "has_active_downloads": _has_active_downloads(downloads),
            },
        )

    @app.post("/extract", response_class=HTMLResponse)
    async def extract_route(request: Request, url: str = Form(...)):
        downloads = await manager.get_all()
        try:
            payload = ExtractRequest(url=url)
        except Exception:
            return templates.TemplateResponse(
                "index.html",
                {
                    "request": request,
                    "notice": None,
                    "downloads": downloads,
                    "metadata": None,
                    "extract_url": url,
                    "extract_error": "Enter a valid URL.",
                    "has_active_downloads": _has_active_downloads(downloads),
                },
                status_code=400,
            )

        client_ip = _client_ip(request)
        if not extract_limiter.allow(client_ip):
            return templates.TemplateResponse(
                "index.html",
                {
                    "request": request,
                    "notice": None,
                    "downloads": downloads,
                    "metadata": None,
                    "extract_url": url,
                    "extract_error": "Too many extract requests. Wait a minute and try again.",
                    "has_active_downloads": _has_active_downloads(downloads),
                },
                status_code=429,
            )

        try:
            metadata = await extractor(str(payload.url), settings)
        except YtdlpError as exc:
            return templates.TemplateResponse(
                "index.html",
                {
                    "request": request,
                    "notice": None,
                    "downloads": downloads,
                    "metadata": None,
                    "extract_url": url,
                    "extract_error": str(exc),
                    "has_active_downloads": _has_active_downloads(downloads),
                },
                status_code=500,
            )

        return templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "notice": None,
                "downloads": downloads,
                "metadata": metadata,
                "extract_url": url,
                "extract_error": None,
                "has_active_downloads": _has_active_downloads(downloads),
            },
        )

    @app.post("/download")
    async def download_form(
        request: Request,
        url: str = Form(...),
        format_id: str = Form(...),
        title: str = Form(...),
        thumbnail: str = Form(""),
        ext: str = Form("mp4"),
    ):
        try:
            payload = DownloadRequest(
                url=url,
                format_id=format_id,
                title=title,
                thumbnail=thumbnail or None,
                ext=ext,
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid download request.")

        client_ip = _client_ip(request)
        if not download_limiter.allow(client_ip):
            raise HTTPException(status_code=429, detail="Too many download requests. Please wait.")

        if await manager.incomplete_count() >= settings.max_incomplete_downloads:
            raise HTTPException(
                status_code=429,
                detail="Too many active or queued downloads. Please wait for some to finish.",
            )

        await manager.add(
            str(payload.url),
            payload.format_id,
            payload.title,
            payload.thumbnail,
            payload.ext,
        )
        return RedirectResponse(url="/?notice=Download+queued", status_code=303)

    @app.post("/downloads/{download_id}/cancel")
    async def cancel_form(download_id: str):
        success = await manager.cancel(download_id)
        if not success:
            raise HTTPException(status_code=404, detail="Download not found.")
        return RedirectResponse(url="/?notice=Download+cancelled", status_code=303)

    @app.post("/downloads/clear-completed")
    async def clear_completed_form():
        await manager.clear_completed()
        return RedirectResponse(url="/?notice=Finished+downloads+cleared", status_code=303)

    @app.get("/partials/downloads", response_class=HTMLResponse)
    async def downloads_partial(request: Request):
        downloads = await manager.get_all()
        return templates.TemplateResponse(
            "_downloads.html",
            {
                "request": request,
                "downloads": downloads,
                "has_active_downloads": _has_active_downloads(downloads),
            },
        )

    @app.post("/api/extract")
    async def extract_api(request: Request):
        client_ip = _client_ip(request)
        if not extract_limiter.allow(client_ip):
            return JSONResponse({"error": "Too many requests. Please wait before trying again."}, status_code=429)

        payload = await _safe_json(request)
        if payload is None:
            return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

        try:
            validated = ExtractRequest.model_validate(payload)
        except Exception:
            return JSONResponse({"error": "Invalid URL."}, status_code=400)

        try:
            metadata = await extractor(str(validated.url), settings)
        except YtdlpError as exc:
            return JSONResponse({"error": str(exc)}, status_code=500)
        return JSONResponse({"metadata": metadata.model_dump(mode="json", by_alias=True)})

    @app.post("/api/download")
    async def download_api(request: Request):
        client_ip = _client_ip(request)
        if not download_limiter.allow(client_ip):
            return JSONResponse({"error": "Too many requests. Please wait before trying again."}, status_code=429)

        payload = await _safe_json(request)
        if payload is None:
            return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

        try:
            validated = DownloadRequest.model_validate(payload)
        except Exception:
            return JSONResponse({"error": "Invalid download request."}, status_code=400)

        if await manager.incomplete_count() >= settings.max_incomplete_downloads:
            return JSONResponse(
                {"error": "Too many active or queued downloads. Please wait for some to finish."},
                status_code=429,
            )

        download_id = await manager.add(
            str(validated.url),
            validated.format_id,
            validated.title,
            validated.thumbnail,
            validated.ext,
        )
        return JSONResponse({"id": download_id}, status_code=201)

    @app.delete("/api/download/{download_id}")
    async def cancel_api(download_id: str):
        success = await manager.cancel(download_id)
        if not success:
            return JSONResponse({"error": "Download not found."}, status_code=404)
        return JSONResponse({"status": "cancelled"})

    @app.get("/api/downloads")
    async def downloads_api():
        downloads = [item.model_dump(mode="json", by_alias=True) for item in await manager.get_all()]
        return JSONResponse({"downloads": downloads})

    @app.delete("/api/downloads/completed")
    async def clear_completed_api():
        await manager.clear_completed()
        return JSONResponse({"status": "ok"})

    @app.get("/health")
    async def health():
        return JSONResponse({"status": "ok"})

    @app.websocket("/api/ws")
    async def websocket_updates(websocket: WebSocket):
        await websocket.accept()
        subscription = await bus.subscribe()
        try:
            downloads = [item.model_dump(mode="json", by_alias=True) for item in await manager.get_all()]
            await websocket.send_json({"type": "downloads", "downloads": downloads})

            while True:
                receiver = asyncio.create_task(websocket.receive_text())
                publisher = asyncio.create_task(subscription.queue.get())
                done, pending = await asyncio.wait({receiver, publisher}, return_when=asyncio.FIRST_COMPLETED)
                for task in pending:
                    task.cancel()

                if receiver in done:
                    message = receiver.result()
                    with contextlib.suppress(json.JSONDecodeError):
                        payload = json.loads(message)
                        if payload.get("type") == "ping":
                            await websocket.send_json({"type": "pong"})

                if publisher in done:
                    await websocket.send_json(publisher.result())
        except WebSocketDisconnect:
            pass
        finally:
            await bus.unsubscribe(subscription)

    return app


async def _safe_json(request: Request) -> dict | None:
    try:
        payload = await request.json()
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


def _has_active_downloads(downloads: list) -> bool:
    return any(item.status in {"queued", "downloading", "processing"} for item in downloads)


def _format_bytes(value: int | float | None) -> str:
    if value is None or value <= 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    index = 0
    while size >= 1024 and index < len(units) - 1:
        size /= 1024
        index += 1
    return f"{size:.1f} {units[index]}"


def _format_speed(value: int | float | None) -> str:
    if value is None:
        return "--"
    return f"{_format_bytes(value)}/s"


def _format_duration(value: int | None) -> str:
    if value is None:
        return "--"
    total = max(0, int(value))
    hours, remainder = divmod(total, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"
