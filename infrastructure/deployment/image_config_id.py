"""Read a portable config digest from docker save without extracting files."""

import hashlib
import json
import sys
import tarfile


def config_digest(stream, image):
    manifest = None
    configs = {}
    with tarfile.open(fileobj=stream, mode="r|*") as archive:
        for member in archive:
            if not member.isfile():
                continue
            name = member.name.removeprefix("./")
            if member.size > 4 * 1024 * 1024:
                if name == "manifest.json":
                    raise ValueError("Oversized image manifest")
                continue
            if name != "manifest.json" and not (
                name.endswith(".json") or name.startswith("blobs/sha256/")
            ):
                continue
            data = archive.extractfile(member).read()
            try:
                document = json.loads(data)
            except (ValueError, UnicodeDecodeError):
                continue
            if name == "manifest.json":
                if manifest is not None or not isinstance(document, list):
                    raise ValueError("Invalid or duplicate image manifest")
                manifest = document
            elif isinstance(document, dict) and "rootfs" in document:
                if name in configs or len(configs) >= 32:
                    raise ValueError("Duplicate or excessive image configs")
                configs[name] = (document, hashlib.sha256(data).hexdigest())
    matches = [entry for entry in (manifest or []) if image in (entry.get("RepoTags") or [])]
    if len(matches) != 1:
        raise ValueError("Archive must contain exactly one entry for the release tag")
    config_name = matches[0].get("Config", "").removeprefix("./")
    if config_name not in configs:
        raise ValueError("Release config is missing from archive")
    document, digest = configs[config_name]
    if document.get("os") != "linux" or document.get("architecture") != "amd64":
        raise ValueError("Release image must be linux/amd64")
    rootfs = document.get("rootfs")
    if not isinstance(rootfs, dict) or rootfs.get("type") != "layers":
        raise ValueError("Invalid image rootfs")
    return "sha256:" + digest


def main():
    if len(sys.argv) != 3:
        raise ValueError("Usage: image_config_id.py ARCHIVE_OR_DASH IMAGE_TAG")
    path, image = sys.argv[1:]
    if path == "-":
        print(config_digest(sys.stdin.buffer, image))
    else:
        with open(path, "rb") as stream:
            print(config_digest(stream, image))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, tarfile.TarError) as error:
        print("Image config verification failed: " + str(error), file=sys.stderr)
        sys.exit(1)
