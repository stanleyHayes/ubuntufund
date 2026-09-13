#!/usr/bin/env python3
"""Inventory an actual .app bundle; this does not validate App Store disclosures."""
import argparse
import hashlib
import json
import plistlib
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('bundle', type=Path, help='Extracted .app, including one inside an xcarchive')
args = parser.parse_args()
bundle = args.bundle.resolve()
if not bundle.is_dir() or bundle.suffix != '.app':
    parser.error('An existing .app directory is required')
info = plistlib.loads((bundle / 'Info.plist').read_bytes())
entries = []
for manifest in sorted(bundle.rglob('PrivacyInfo.xcprivacy')):
    payload = manifest.read_bytes()
    entries.append({'path': str(manifest.relative_to(bundle)), 'sha256': hashlib.sha256(payload).hexdigest(), 'declarations': plistlib.loads(payload)})
executable = bundle / info['CFBundleExecutable']
if executable.parent != bundle or not executable.is_file():
    parser.error('Bundle executable is missing or has an invalid path')
with executable.open('rb') as stream:
    binary_hash = hashlib.file_digest(stream, 'sha256').hexdigest()
print(json.dumps({
    'scope': 'Artifact inventory only; not policy, signature, SDK completeness or network verification',
    'bundleIdentifier': info.get('CFBundleIdentifier'),
    'version': info.get('CFBundleShortVersionString'),
    'build': info.get('CFBundleVersion'),
    'supportedPlatforms': info.get('CFBundleSupportedPlatforms'),
    'executableSha256': binary_hash,
    'manifestCount': len(entries),
    'manifests': entries,
}, indent=2))
