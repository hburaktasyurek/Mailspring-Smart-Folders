#!/usr/bin/env python3

import argparse
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "dist" / "mailspring-smart-folders.zip"
PACKAGE_ROOT = "smart-folders"
FIXED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
ROOT_FILES = (
    "LICENSE.md",
    "README.md",
    "CONTRIBUTING.md",
    "SPEC.md",
    "VERIFICATION.md",
    "package.json",
)
PACKAGE_DIRECTORIES = ("assets", "lib", "styles", "test")


def package_version():
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    return package["version"]


def package_files():
    files = [ROOT / name for name in ROOT_FILES]

    for directory_name in PACKAGE_DIRECTORIES:
        directory = ROOT / directory_name
        for path in directory.rglob("*"):
            if path.is_symlink():
                raise SystemExit(f"Refusing to package symbolic link: {path.relative_to(ROOT)}")
            if path.is_file() and not any(part.startswith(".") for part in path.relative_to(directory).parts):
                files.append(path)

    missing = [path.relative_to(ROOT) for path in files if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing release files: {', '.join(map(str, missing))}")

    return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix())


def build_archive(tag):
    version = package_version()
    if tag and tag != f"v{version}":
        raise SystemExit(f"Tag {tag!r} does not match package version v{version}")

    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in package_files():
            relative_path = path.relative_to(ROOT).as_posix()
            info = zipfile.ZipInfo(f"{PACKAGE_ROOT}/{relative_path}", FIXED_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)

    print(f"Built {ARCHIVE.relative_to(ROOT)} for v{version}")


def main():
    parser = argparse.ArgumentParser(description="Build the deterministic Mailspring plugin release archive.")
    parser.add_argument("--tag", help="Require this v-prefixed tag to match package.json version.")
    arguments = parser.parse_args()
    build_archive(arguments.tag)


if __name__ == "__main__":
    main()
