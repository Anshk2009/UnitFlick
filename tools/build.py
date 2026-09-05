#!/usr/bin/env python3
"""Package the extension for release.

    python tools/build.py

Produces dist/unitflick-<version>.zip containing only the files the browser
actually loads. Tests, tooling, docs and package.json are deliberately left
out: they are not needed at runtime, and every file you ship is a file a
reviewer has to read.

Run `npm run check` first — this script refuses to build if the security audit
has not passed.
"""

import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# What ships. Anything not listed here does not go in the zip.
INCLUDE_DIRS = ["src", "icons"]
INCLUDE_FILES = ["manifest.json", "LICENSE", "PRIVACY.md"]

# Belt and braces: even inside src/, refuse to package these.
EXCLUDE_SUFFIXES = (".test.js", ".map", ".bak", ".orig")


def run_audit():
    print("running security audit...")
    result = subprocess.run(
        [shutil.which("node") or "node", str(ROOT / "tools" / "audit.js")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    print(result.stdout.strip())
    if result.returncode != 0:
        sys.exit("\nBuild stopped: the security audit failed.")


def collect():
    files = []
    for name in INCLUDE_DIRS:
        for path in sorted((ROOT / name).rglob("*")):
            if path.is_file() and not path.name.endswith(EXCLUDE_SUFFIXES):
                files.append(path)
    for name in INCLUDE_FILES:
        path = ROOT / name
        if not path.exists():
            sys.exit(f"missing required file: {name}")
        files.append(path)
    return files


def main():
    run_audit()

    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    if version != package_version:
        sys.exit(f"version mismatch: manifest says {version}, package.json says {package_version}")

    DIST.mkdir(exist_ok=True)
    target = DIST / f"unitflick-{version}.zip"

    files = collect()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT).as_posix())

    size_kb = target.stat().st_size / 1024
    print(f"\npackaged {len(files)} files -> {target.relative_to(ROOT)} ({size_kb:.1f} KB)")
    for path in files:
        print(f"  {path.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
