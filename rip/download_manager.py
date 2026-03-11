from __future__ import annotations

import asyncio
import contextlib
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Any, Literal

from .config import Settings
from .models import DownloadItem, DownloadProgress
from .ytdlp import OUTPUT_PREFIX, PROGRESS_PREFIX, build_download_args, parse_progress_line


@dataclass(slots=True)
class Subscription:
    queue: asyncio.Queue[dict[str, Any]]


class EventBus:
    def __init__(self) -> None:
        self._subscriptions: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = asyncio.Lock()

    async def publish(self, message: dict[str, Any]) -> None:
        async with self._lock:
            subscribers = list(self._subscriptions)
        for subscriber in subscribers:
            with contextlib.suppress(asyncio.QueueFull):
                subscriber.put_nowait(message)

    async def subscribe(self) -> Subscription:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscriptions.add(queue)
        return Subscription(queue=queue)

    async def unsubscribe(self, subscription: Subscription) -> None:
        async with self._lock:
            self._subscriptions.discard(subscription.queue)


class DownloadManager:
    def __init__(self, settings: Settings, bus: EventBus) -> None:
        self.settings = settings
        self.bus = bus
        self._downloads: dict[str, DownloadItem] = {}
        self._queue: deque[str] = deque()
        self._condition = asyncio.Condition()
        self._lock = asyncio.Lock()
        self._active_processes: dict[str, asyncio.subprocess.Process] = {}
        self._workers: list[asyncio.Task[None]] = []
        self._expiry_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self.settings.download_dir.mkdir(parents=True, exist_ok=True)
        if self._workers:
            return
        self._workers = [asyncio.create_task(self._worker(index)) for index in range(self.settings.max_concurrent_downloads)]
        self._expiry_task = asyncio.create_task(self._expiry_loop())

    async def shutdown(self) -> None:
        for process in list(self._active_processes.values()):
            with contextlib.suppress(ProcessLookupError):
                process.terminate()

        for task in self._workers:
            task.cancel()
        if self._expiry_task is not None:
            self._expiry_task.cancel()

        for task in [*self._workers, self._expiry_task]:
            if task is None:
                continue
            with contextlib.suppress(asyncio.CancelledError):
                await task

        self._workers.clear()
        self._expiry_task = None

    async def incomplete_count(self) -> int:
        async with self._lock:
            return sum(1 for item in self._downloads.values() if item.status in {"queued", "downloading", "processing"})

    async def add(
        self,
        url: str,
        format_id: str,
        title: str,
        thumbnail: str | None,
        ext: str,
        *,
        source_ext: str | None = None,
        has_video: bool | None = None,
        has_audio: bool | None = None,
    ) -> str | None:
        created_at = int(time.time())
        item = DownloadItem(
            id=str(uuid.uuid4()),
            url=url,
            title=title,
            thumbnail=thumbnail,
            format_id=format_id,
            ext=ext,
            source_ext=source_ext,
            has_video=has_video,
            has_audio=has_audio,
            output_path=None,
            status="queued",
            progress=DownloadProgress(),
            created_at=created_at,
            completed_at=None,
            error=None,
        )
        async with self._lock:
            incomplete = sum(
                1 for download in self._downloads.values() if download.status in {"queued", "downloading", "processing"}
            )
            if incomplete >= self.settings.max_incomplete_downloads:
                return None
            self._downloads[item.id] = item
            self._queue.append(item.id)

        async with self._condition:
            self._condition.notify_all()

        await self.broadcast_downloads()
        return item.id

    async def cancel(self, download_id: str) -> Literal["cancelled", "not_found", "not_cancellable"]:
        async with self._lock:
            item = self._downloads.get(download_id)
            if item is None:
                return "not_found"
            if item.status in {"completed", "failed", "cancelled"}:
                return "not_cancellable"
            item.status = "cancelled"
            item.completed_at = int(time.time())

            process = self._active_processes.get(download_id)
            if process is not None:
                with contextlib.suppress(ProcessLookupError):
                    process.terminate()

        await self.broadcast_downloads()
        return "cancelled"

    async def clear_completed(self) -> None:
        async with self._lock:
            self._downloads = {
                download_id: item
                for download_id, item in self._downloads.items()
                if item.status not in {"completed", "failed", "cancelled"}
            }
            self._queue = deque(download_id for download_id in self._queue if download_id in self._downloads)
        await self.broadcast_downloads()

    async def get_all(self) -> list[DownloadItem]:
        async with self._lock:
            return self._snapshot_locked()

    async def broadcast_downloads(self) -> None:
        downloads = [item.model_dump(mode="json", by_alias=True) for item in await self.get_all()]
        await self.bus.publish({"type": "downloads", "downloads": downloads})

    async def _worker(self, _index: int) -> None:
        while True:
            download_id = await self._next_queued_download_id()
            async with self._lock:
                item = self._downloads.get(download_id)
                if item is None or item.status != "queued":
                    continue
                item.status = "downloading"

            await self.broadcast_downloads()
            await self._run_download(download_id)

    async def _run_download(self, download_id: str) -> None:
        async with self._lock:
            item = self._downloads.get(download_id)
            if item is None:
                return
            if item.status == "cancelled":
                return
            try:
                args = build_download_args(
                    self.settings,
                    item.url,
                    item.format_id,
                    self.settings.download_dir,
                    item.ext,
                    source_ext=item.source_ext,
                    has_video=item.has_video,
                    has_audio=item.has_audio,
                )
            except ValueError as exc:
                item.status = "failed"
                item.error = str(exc)
                item.completed_at = int(time.time())
                args = []

        if not args:
            await self.broadcast_downloads()
            return

        try:
            process = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except OSError as exc:
            async with self._lock:
                item = self._downloads.get(download_id)
                if item is not None:
                    item.status = "failed"
                    item.error = str(exc)
                    item.completed_at = int(time.time())
            await self.broadcast_downloads()
            return
        async with self._lock:
            self._active_processes[download_id] = process
            item = self._downloads.get(download_id)
            if item is not None and item.status == "cancelled":
                with contextlib.suppress(ProcessLookupError):
                    process.terminate()

        stdout_task = asyncio.create_task(self._consume_stdout(download_id, process))
        stderr_task = asyncio.create_task(process.stderr.read() if process.stderr is not None else asyncio.sleep(0, result=b""))
        await process.wait()
        stderr = (await stderr_task).decode("utf-8", errors="replace").strip()
        with contextlib.suppress(asyncio.CancelledError):
            await stdout_task

        async with self._lock:
            self._active_processes.pop(download_id, None)
            item = self._downloads.get(download_id)
            if item is None:
                return

            if item.status == "cancelled":
                item.completed_at = item.completed_at or int(time.time())
            elif process.returncode == 0:
                item.status = "completed"
                item.progress.percentage = 100.0
                item.completed_at = int(time.time())
            else:
                item.status = "failed"
                item.error = stderr or f"yt-dlp exited with code {process.returncode}"
                item.completed_at = int(time.time())

        await self.broadcast_downloads()

    async def _consume_stdout(self, download_id: str, process: asyncio.subprocess.Process) -> None:
        if process.stdout is None:
            return

        output_path = ""
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace").strip()
            if not text:
                continue

            if text.startswith(PROGRESS_PREFIX):
                payload = parse_progress_line(text[len(PROGRESS_PREFIX) :])
                if payload is None:
                    continue
                progress = DownloadProgress(**payload)
                async with self._lock:
                    item = self._downloads.get(download_id)
                    if item is None or item.status == "cancelled":
                        continue
                    item.progress = progress
                    item.status = "downloading"
                await self.bus.publish(
                    {
                        "type": "progress",
                        "downloadId": download_id,
                        "progress": progress.model_dump(mode="json", by_alias=True),
                    }
                )
                continue

            if text.startswith(OUTPUT_PREFIX):
                output_path = text[len(OUTPUT_PREFIX) :].strip()
                async with self._lock:
                    item = self._downloads.get(download_id)
                    if item is not None:
                        item.output_path = output_path
                continue

            if text.startswith("[download] Destination:"):
                output_path = text.replace("[download] Destination:", "", 1).strip()
                async with self._lock:
                    item = self._downloads.get(download_id)
                    if item is not None:
                        item.output_path = output_path
                continue

            if text.startswith("[Merger]") or text.startswith("[ExtractAudio]"):
                async with self._lock:
                    item = self._downloads.get(download_id)
                    if item is None or item.status == "cancelled":
                        continue
                    item.status = "processing"
                    item.progress.percentage = 100.0
                await self.broadcast_downloads()

        if output_path:
            async with self._lock:
                item = self._downloads.get(download_id)
                if item is not None:
                    item.output_path = output_path

    async def _expiry_loop(self) -> None:
        while True:
            await asyncio.sleep(60)
            changed = False
            cutoff = int(time.time()) - self.settings.completed_expiry_seconds
            async with self._lock:
                for download_id, item in list(self._downloads.items()):
                    if item.status in {"completed", "failed", "cancelled"} and item.completed_at and item.completed_at <= cutoff:
                        self._downloads.pop(download_id, None)
                        changed = True
                self._queue = deque(download_id for download_id in self._queue if download_id in self._downloads)
            if changed:
                await self.broadcast_downloads()

    async def _next_queued_download_id(self) -> str:
        while True:
            async with self._condition:
                async with self._lock:
                    while self._queue and (
                        self._downloads.get(self._queue[0]) is None or self._downloads[self._queue[0]].status != "queued"
                    ):
                        self._queue.popleft()
                    if self._queue:
                        return self._queue.popleft()
                await self._condition.wait()

    def _snapshot_locked(self) -> list[DownloadItem]:
        return sorted(self._downloads.values(), key=lambda item: item.created_at, reverse=True)
