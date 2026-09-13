#!/usr/bin/env python3
"""Inspect 64-bit ELF alignment in an APK/AAR; not a device or store approval check."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path)
parser.add_argument('--readelf', required=True, type=Path, help='Android NDK llvm-readelf')
args = parser.parse_args()
if args.archive.suffix not in ('.apk', '.aar') or not args.archive.is_file():
    parser.error('An existing APK or AAR is required')
rows = []
with zipfile.ZipFile(args.archive) as archive, tempfile.TemporaryDirectory() as temporary:
    for item in archive.infolist():
        parts = item.filename.split('/')
        if len(parts) != 3 or parts[0] not in ('lib', 'jni') or parts[1] not in ('arm64-v8a', 'x86_64') or not parts[2].endswith('.so'):
            continue
        # Never extract archive-controlled paths to the filesystem.
        data = archive.read(item)
        library = Path(temporary) / f'{len(rows)}.so'
        library.write_bytes(data)
        output = subprocess.check_output([str(args.readelf), '-Wl', str(library)], text=True)
        loads = [line.split() for line in output.splitlines() if line.strip().startswith('LOAD ')]
        relro = [line.split() for line in output.splitlines() if line.strip().startswith('GNU_RELRO ')]
        if not loads:
            raise ValueError(f'No LOAD segments found in {item.filename}')
        alignments = [int(line[-1], 16) for line in loads]
        ends = [(int(line[2], 16) + int(line[5], 16)) % 16384 for line in relro]
        rows.append({'path': item.filename, 'sha256': hashlib.sha256(data).hexdigest(),
                     'loadAlignments': alignments, 'relroPresent': bool(relro),
                     'relroEndRemainders': ends,
                     'alignmentChecksPass': all(value >= 16384 for value in alignments) and all(value == 0 for value in ends)})
if not rows:
    parser.error('No 64-bit native libraries found; this is not a verified alignment pass')
report = {'scope': '64-bit ELF LOAD and RELRO checks only; ZIP alignment, signing and device behavior are separate',
          'archiveSha256': hashlib.sha256(args.archive.read_bytes()).hexdigest(), 'libraries': rows}
print(json.dumps(report, indent=2))
raise SystemExit(0 if all(row['alignmentChecksPass'] for row in rows) else 1)
