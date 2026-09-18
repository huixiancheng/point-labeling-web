#!/usr/bin/env python3
"""Fetch selected SemanticKITTI frames without downloading the full archives.

The official KITTI Velodyne archive is very large and the SemanticKITTI label
archive contains all sequences.  Both are ZIP files served with HTTP Range
support, so this utility reads the central directory and only downloads the
requested .bin/.label members.

Examples:
  python tools/fetch_semantickitti_sequence.py --sequence 03 \
      --output windows/package_open/clips/semantic_kitti --list-only
  python tools/fetch_semantickitti_sequence.py --sequence 03 \
      --max-frames 100 --output windows/package_open/clips/semantic_kitti

The downloaded dataset remains subject to the SemanticKITTI/KITTI terms.  The
default URLs are the official public archive locations documented by
https://semantic-kitti.org/dataset.html.
"""

from __future__ import annotations

import argparse
import bisect
import concurrent.futures
import io
import json
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.request
import zipfile
from pathlib import Path


DEFAULT_POINT_URL = "https://s3.eu-central-1.amazonaws.com/avg-kitti/data_odometry_velodyne.zip"
DEFAULT_LABEL_URL = "https://semantic-kitti.org/assets/data_odometry_labels.zip"


def fetch_curl_range(curl: str, url: str, start: int, end: int, depth: int = 0) -> bytes:
    """Fetch one exact HTTP range, retrying transient short responses."""
    expected = end - start
    last_detail = ""
    for attempt in range(4):
        command = [
            curl,
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--retry",
            "3",
            "--retry-delay",
            "1",
            "--max-time",
            "90",
            "--max-filesize",
            str(expected),
            "--range",
            f"{start}-{end - 1}",
            url,
        ]
        try:
            completed = subprocess.run(command, check=False, capture_output=True, timeout=120)
        except subprocess.TimeoutExpired:
            completed = None
            last_detail = "HTTP Range request timed out"
        if completed is None:
            if attempt < 3:
                time.sleep(attempt + 1)
                continue
            break
        data = completed.stdout
        if completed.returncode == 0 and len(data) == expected:
            return data
        if completed.returncode != 0:
            last_detail = completed.stderr.decode(errors="replace").strip()
        elif len(data) > expected:
            raise RuntimeError(f"server did not honor HTTP Range for {url}")
        else:
            last_detail = f"short HTTP Range response: {len(data)} bytes (expected {expected})"
        if attempt < 3:
            time.sleep(attempt + 1)
    if expected > 1 * 1024 * 1024 and depth < 8:
        midpoint = start + expected // 2
        return fetch_curl_range(curl, url, start, midpoint, depth + 1) + fetch_curl_range(
            curl, url, midpoint, end, depth + 1
        )
    raise RuntimeError(f"HTTP Range request failed for {url}: {last_detail}")


class HttpRangeReader(io.RawIOBase):
    """Seekable read-only file backed by cached HTTP byte ranges."""

    def __init__(
        self,
        url: str,
        block_size: int = 1 * 1024 * 1024,
        *,
        cache: dict[int, bytes] | None = None,
        cache_lock: threading.Lock | None = None,
        size: int | None = None,
    ) -> None:
        self.url = url
        self.block_size = block_size
        self.position = 0
        self.cache = cache if cache is not None else {}
        self.cache_lock = cache_lock if cache_lock is not None else threading.Lock()
        self.curl = shutil.which("curl") or shutil.which("curl.exe")
        self.size = size if size is not None else self._head_size()

    def _head_size(self) -> int:
        if self.curl:
            command = [
                self.curl,
                "--fail",
                "--location",
                "--silent",
                "--show-error",
                "--head",
                "--retry",
                "3",
                "--max-time",
                "120",
                self.url,
            ]
            completed = subprocess.run(command, check=False, capture_output=True, timeout=180)
            if completed.returncode != 0:
                detail = completed.stderr.decode(errors="replace").strip()
                raise RuntimeError(f"curl HEAD request failed for {self.url}: {detail}")
            lengths = re.findall(r"(?im)^content-length:\s*(\d+)\s*$", completed.stdout.decode(errors="replace"))
            if lengths:
                return int(lengths[-1])
            raise RuntimeError(f"no Content-Length returned by {self.url}")
        request = urllib.request.Request(self.url, method="HEAD")
        with urllib.request.urlopen(request, timeout=60) as response:
            length = response.headers.get("Content-Length")
            if not length:
                raise RuntimeError(f"no Content-Length returned by {self.url}")
            return int(length)

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            target = offset
        elif whence == io.SEEK_CUR:
            target = self.position + offset
        elif whence == io.SEEK_END:
            target = self.size + offset
        else:
            raise ValueError(f"invalid whence: {whence}")
        if target < 0:
            raise ValueError("negative seek")
        self.position = target
        return target

    def read(self, size: int = -1) -> bytes:
        if self.position >= self.size:
            return b""
        if size is None or size < 0:
            end = self.size
        else:
            end = min(self.size, self.position + size)
        start = self.position
        chunks: list[bytes] = []
        while start < end:
            block_start = (start // self.block_size) * self.block_size
            block_end = min(self.size, block_start + self.block_size)
            with self.cache_lock:
                block = self.cache.get(block_start)
            if block is None:
                fetched = self._get_block(block_start, block_end)
                with self.cache_lock:
                    block = self.cache.setdefault(block_start, fetched)
            local_end = min(end, block_end)
            chunks.append(block[start - block_start : local_end - block_start])
            start = local_end
        self.position = end
        return b"".join(chunks)

    def _get_block(self, start: int, end: int) -> bytes:
        expected = end - start
        if self.curl:
            # curl is substantially faster than urllib on some Windows
            # installations when reading multi-megabyte S3 ranges.  The
            # max-filesize guard also prevents a Range-ignorant server from
            # returning the complete archive.
            return fetch_curl_range(self.curl, self.url, start, end)

        request = urllib.request.Request(self.url, headers={"Range": f"bytes={start}-{end - 1}"})
        with urllib.request.urlopen(request, timeout=180) as response:
            if response.status != 206:
                # Check the advertised size before reading.  A server that
                # ignores Range must not make us pull the entire 80 GB file.
                declared = int(response.headers.get("Content-Length", "0"))
                if start != 0 or declared > end - start:
                    raise RuntimeError(f"server did not honor HTTP Range for {self.url}")
            data = response.read(expected)
            if len(data) < expected:
                raise RuntimeError(f"short HTTP Range response for {self.url}: {len(data)} bytes")
            return data[:expected]

    def clone(self) -> "HttpRangeReader":
        """Create an independent seek cursor sharing this reader's cache."""
        return HttpRangeReader(
            self.url,
            block_size=self.block_size,
            cache=self.cache,
            cache_lock=self.cache_lock,
            size=self.size,
        )


class SplitHttpRangeReader(io.RawIOBase):
    """Seekable reader for a ZIP split into concatenated remote parts."""

    def __init__(
        self,
        parts: list[tuple[str, int]],
        block_size: int = 1 * 1024 * 1024,
        *,
        cache: dict[int, bytes] | None = None,
        cache_lock: threading.Lock | None = None,
    ) -> None:
        if not parts or any(size <= 0 for _, size in parts):
            raise ValueError("split archive parts must have positive sizes")
        self.parts = parts
        self.block_size = block_size
        self.position = 0
        self.cache = cache if cache is not None else {}
        self.cache_lock = cache_lock if cache_lock is not None else threading.Lock()
        self.curl = shutil.which("curl") or shutil.which("curl.exe")
        self.offsets = [0]
        for _, size in parts:
            self.offsets.append(self.offsets[-1] + size)
        self.size = self.offsets[-1]

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            target = offset
        elif whence == io.SEEK_CUR:
            target = self.position + offset
        elif whence == io.SEEK_END:
            target = self.size + offset
        else:
            raise ValueError(f"invalid whence: {whence}")
        if target < 0:
            raise ValueError("negative seek")
        self.position = target
        return target

    def read(self, size: int = -1) -> bytes:
        if self.position >= self.size:
            return b""
        if size is None or size < 0:
            end = self.size
        else:
            end = min(self.size, self.position + size)
        start = self.position
        chunks: list[bytes] = []
        while start < end:
            block_start = (start // self.block_size) * self.block_size
            block_end = min(self.size, block_start + self.block_size)
            with self.cache_lock:
                block = self.cache.get(block_start)
            if block is None:
                fetched = self._get_block(block_start, block_end)
                with self.cache_lock:
                    block = self.cache.setdefault(block_start, fetched)
            local_end = min(end, block_end)
            chunks.append(block[start - block_start : local_end - block_start])
            start = local_end
        self.position = end
        return b"".join(chunks)

    def _get_block(self, start: int, end: int) -> bytes:
        chunks: list[bytes] = []
        position = start
        while position < end:
            part_index = bisect.bisect_right(self.offsets, position) - 1
            part_start = self.offsets[part_index]
            part_end = self.offsets[part_index + 1]
            request_end = min(end, part_end)
            chunks.append(self._get_range(
                self.parts[part_index][0],
                position - part_start,
                request_end - part_start,
            ))
            position = request_end
        return b"".join(chunks)

    def _get_range(self, url: str, start: int, end: int) -> bytes:
        expected = end - start
        if self.curl:
            return fetch_curl_range(self.curl, url, start, end)

        request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end - 1}"})
        with urllib.request.urlopen(request, timeout=180) as response:
            if response.status != 206:
                declared = int(response.headers.get("Content-Length", "0"))
                if start != 0 or declared > expected:
                    raise RuntimeError(f"server did not honor HTTP Range for {url}")
            data = response.read(expected)
            if len(data) < expected:
                raise RuntimeError(f"short HTTP Range response for {url}: {len(data)} bytes")
            return data[:expected]

    def clone(self) -> "SplitHttpRangeReader":
        """Create an independent seek cursor sharing this reader's cache."""
        return SplitHttpRangeReader(
            self.parts,
            block_size=self.block_size,
            cache=self.cache,
            cache_lock=self.cache_lock,
        )


def member_frame(name: str, sequence: str, suffix: str) -> int | None:
    normalized = name.replace("\\", "/")
    pattern = rf"(?:^|/)sequences/{re.escape(sequence)}/{suffix}/(\d+)\.{'bin' if suffix == 'velodyne' else 'label'}$"
    match = re.search(pattern, normalized, re.IGNORECASE)
    return int(match.group(1)) if match else None


def selected_members(
    infos: list[zipfile.ZipInfo], sequence: str, suffix: str, max_frames: int | None,
    start_frame: int = 0,
) -> list[tuple[int, zipfile.ZipInfo]]:
    matches: list[tuple[int, zipfile.ZipInfo]] = []
    for info in infos:
        frame = member_frame(info.filename, sequence, suffix)
        if frame is not None and frame >= start_frame and not info.is_dir():
            matches.append((frame, info))
    matches.sort(key=lambda pair: pair[0])
    if max_frames is not None:
        matches = matches[:max_frames]
    return matches


def copy_members(
    archive: zipfile.ZipFile,
    members: list[tuple[int, zipfile.ZipInfo]],
    output_dir: Path,
    sequence: str,
    suffix: str,
    skip_existing: bool = False,
    workers: int = 1,
) -> int:
    if not members:
        return 0

    def destination_for(frame: int) -> Path:
        return output_dir / "sequences" / sequence / suffix / f"{frame:06d}.{'bin' if suffix == 'velodyne' else 'label'}"

    def copy_one(item: tuple[int, tuple[int, zipfile.ZipInfo]]) -> tuple[int, Path, bool]:
        index, (frame, info) = item
        destination = destination_for(frame)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if skip_existing and destination.is_file() and destination.stat().st_size == info.file_size:
            return index, destination, True

        if workers <= 1:
            member_archive = archive
        else:
            # ZipFile serializes reads through its own file pointer.  Give
            # each worker its own ZipFile while sharing the already-loaded
            # HTTP range cache so the large central directory is fetched only
            # once per archive.
            local = getattr(threading.current_thread(), "_plw_zip_archives", None)
            if local is None:
                local = {}
                setattr(threading.current_thread(), "_plw_zip_archives", local)
            member_archive = local.get(suffix)
            if member_archive is None:
                reader = archive.fp.clone()
                member_archive = zipfile.ZipFile(reader)
                local[suffix] = member_archive

        with member_archive.open(info, "r") as source, destination.open("wb") as target:
            shutil.copyfileobj(source, target, length=1024 * 1024)
        return index, destination, False

    indexed_members = list(enumerate(members, start=1))
    if workers <= 1:
        completed = [copy_one(item) for item in indexed_members]
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(copy_one, item) for item in indexed_members]
            completed = [future.result() for future in concurrent.futures.as_completed(futures)]
    for index, destination, skipped in sorted(completed):
        if skipped:
            print(f"{suffix}: skip {index}/{len(members)} {destination.name}")
        else:
            info = members[index - 1][1]
            print(f"{suffix}: {index}/{len(members)} {destination.name} ({info.file_size:,} bytes)")
    return len(members)

def make_reader(args: argparse.Namespace) -> io.RawIOBase:
    if args.point_part_url:
        if len(args.point_part_url) != len(args.point_part_size) or len(args.point_part_url) < 2:
            raise ValueError("--point-part-url and --point-part-size must contain at least two matching entries")
        return SplitHttpRangeReader(list(zip(args.point_part_url, args.point_part_size)), block_size=args.block_size)
    return HttpRangeReader(args.point_url, block_size=args.block_size)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sequence", required=True, help="two-digit sequence id, for example 03")
    parser.add_argument("--start-frame", type=int, default=0, help="first frame to select (inclusive)")
    parser.add_argument("--max-frames", type=int, default=None, help="download only the first N frames")
    parser.add_argument("--output", type=Path, required=True, help="dataset root to create")
    parser.add_argument("--point-url", default=DEFAULT_POINT_URL)
    parser.add_argument("--point-part-url", action="append", default=[],
                        help="remote URL for one concatenated ZIP part; repeat for each part")
    parser.add_argument("--point-part-size", action="append", type=int, default=[],
                        help="byte size for each --point-part-url; repeat in the same order")
    parser.add_argument("--label-url", default=DEFAULT_LABEL_URL)
    parser.add_argument("--list-only", action="store_true", help="list selected members and exit")
    parser.add_argument("--skip-existing", action="store_true", help="skip files already present with the expected size")
    parser.add_argument("--no-manifest", action="store_true", help="do not update download-manifest.json")
    parser.add_argument("--workers", type=int, default=4, help="parallel member extraction workers")
    parser.add_argument("--block-size", type=int, default=8 * 1024 * 1024,
                        help="HTTP range block size in bytes")
    args = parser.parse_args()

    sequence = str(args.sequence).zfill(2)
    if not re.fullmatch(r"\d{2}", sequence):
        parser.error("--sequence must be a numeric two-digit id")
    if args.max_frames is not None and args.max_frames <= 0:
        parser.error("--max-frames must be positive")
    if args.start_frame < 0:
        parser.error("--start-frame must be non-negative")
    if args.workers <= 0:
        parser.error("--workers must be positive")
    if args.block_size <= 0:
        parser.error("--block-size must be positive")
    if bool(args.point_part_url) != bool(args.point_part_size) or (
        args.point_part_url and (len(args.point_part_url) != len(args.point_part_size) or len(args.point_part_url) < 2)
    ):
        parser.error("--point-part-url and --point-part-size must contain at least two matching entries")

    point_reader = make_reader(args)
    point_description = ";".join(args.point_part_url) if args.point_part_url else args.point_url
    print(f"reading point archive index: {point_description}")
    with zipfile.ZipFile(point_reader) as points_archive, zipfile.ZipFile(
        HttpRangeReader(args.label_url, block_size=args.block_size)
    ) as labels_archive:
        point_members = selected_members(points_archive.infolist(), sequence, "velodyne", args.max_frames, args.start_frame)
        label_members = selected_members(labels_archive.infolist(), sequence, "labels", args.max_frames, args.start_frame)
        point_by_frame = {frame: info for frame, info in point_members}
        label_by_frame = {frame: info for frame, info in label_members}
        common = sorted(set(point_by_frame) & set(label_by_frame))
        point_members = [(frame, point_by_frame[frame]) for frame in common]
        label_members = [(frame, label_by_frame[frame]) for frame in common]
        if not common:
            raise RuntimeError(f"no matching velodyne/labels members found for sequence {sequence}")

        point_bytes = sum(info.file_size for _, info in point_members)
        label_bytes = sum(info.file_size for _, info in label_members)
        summary = {
            "sequence": sequence,
            "startFrame": common[0],
            "frames": len(common),
            "firstFrame": common[0],
            "lastFrame": common[-1],
            "pointBytes": point_bytes,
            "labelBytes": label_bytes,
            "pointUrl": point_description,
            "labelUrl": args.label_url,
        }
        print(json.dumps(summary, indent=2))
        if args.list_only:
            return 0

        args.output.mkdir(parents=True, exist_ok=True)
        copy_members(points_archive, point_members, args.output, sequence, "velodyne", args.skip_existing, args.workers)
        copy_members(labels_archive, label_members, args.output, sequence, "labels", args.skip_existing, args.workers)
        if not args.no_manifest:
            metadata_path = args.output / "download-manifest.json"
            metadata_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(f"dataset written to {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
