from __future__ import annotations

import asyncio

from rip.download_manager import DownloadManager, EventBus
from tests.support import build_settings


def test_add_enforces_incomplete_cap_atomically() -> None:
    async def scenario() -> None:
        manager = DownloadManager(build_settings(max_incomplete_downloads=1), EventBus())
        results = await asyncio.gather(
            manager.add(
                "https://example.com/watch?v=one",
                "22",
                "one",
                None,
                "mp4",
                source_ext="mp4",
                has_video=True,
                has_audio=True,
            ),
            manager.add(
                "https://example.com/watch?v=two",
                "22",
                "two",
                None,
                "mp4",
                source_ext="mp4",
                has_video=True,
                has_audio=True,
            ),
        )

        assert sum(result is not None for result in results) == 1
        assert await manager.incomplete_count() == 1

    asyncio.run(scenario())


def test_cancel_does_not_mutate_terminal_history() -> None:
    async def scenario() -> None:
        manager = DownloadManager(build_settings(), EventBus())
        download_id = await manager.add(
            "https://example.com/watch?v=done",
            "22",
            "done",
            None,
            "mp4",
            source_ext="mp4",
            has_video=True,
            has_audio=True,
        )
        assert download_id is not None

        async with manager._lock:
            item = manager._downloads[download_id]
            item.status = "completed"
            item.completed_at = 123

        result = await manager.cancel(download_id)
        downloads = await manager.get_all()

        assert result == "not_cancellable"
        assert downloads[0].status == "completed"
        assert downloads[0].completed_at == 123

    asyncio.run(scenario())
