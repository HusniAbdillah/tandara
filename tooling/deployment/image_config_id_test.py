import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import unittest

helper = Path(__file__).resolve().parents[2] / "infrastructure/deployment/image_config_id.py"
spec = importlib.util.spec_from_file_location("image_config_id", helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

IMAGE = "tandara-backend:test"
CONFIG = {"os": "linux", "architecture": "amd64", "rootfs": {"type": "layers", "diff_ids": []}}


def archive(config=CONFIG, name="config.json", tags=None, after=False, duplicate=False, missing=False, compressed=False):
    payload = json.dumps(config).encode()
    entries = [{"Config": name, "RepoTags": tags if tags is not None else [IMAGE], "Layers": []}]
    if duplicate:
        entries *= 2
    files = [(name, payload)] if not missing else []
    manifest = ("manifest.json", json.dumps(entries).encode())
    files = [manifest] + files if after else files + [manifest]
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w:gz" if compressed else "w") as output:
        for filename, data in files:
            member = tarfile.TarInfo(filename)
            member.size = len(data)
            output.addfile(member, io.BytesIO(data))
    stream.seek(0)
    return stream, "sha256:" + hashlib.sha256(payload).hexdigest()


class PortableImageConfigTests(unittest.TestCase):
    def test_classic_config_name(self):
        stream, expected = archive()
        self.assertEqual(module.config_digest(stream, IMAGE), expected)

    def test_containerd_blob_name_and_gzip(self):
        stream, expected = archive(name="blobs/sha256/config", compressed=True)
        self.assertEqual(module.config_digest(stream, IMAGE), expected)

    def test_manifest_before_config_in_stream(self):
        stream, expected = archive(after=True)
        self.assertEqual(module.config_digest(stream, IMAGE), expected)

    def test_changed_runtime_config_changes_identity(self):
        stream, expected = archive()
        original = module.config_digest(stream, IMAGE)
        changed, digest = archive(config={**CONFIG, "config": {"Cmd": ["unexpected"]}})
        self.assertEqual(module.config_digest(changed, IMAGE), digest)
        self.assertNotEqual(original, digest)

    def test_missing_release_tag_rejected(self):
        stream, _ = archive(tags=["different:tag"])
        with self.assertRaises(ValueError):
            module.config_digest(stream, IMAGE)

    def test_ambiguous_release_rejected(self):
        stream, _ = archive(duplicate=True)
        with self.assertRaises(ValueError):
            module.config_digest(stream, IMAGE)

    def test_missing_config_rejected(self):
        stream, _ = archive(missing=True)
        with self.assertRaises(ValueError):
            module.config_digest(stream, IMAGE)

    def test_wrong_platform_rejected(self):
        stream, _ = archive(config={**CONFIG, "architecture": "arm64"})
        with self.assertRaises(ValueError):
            module.config_digest(stream, IMAGE)


if __name__ == "__main__":
    unittest.main()
