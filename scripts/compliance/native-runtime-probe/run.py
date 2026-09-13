#!/usr/bin/env python3
"""Compile and run the ARM64 runtime probe on an explicitly selected 16 KB device."""
import argparse
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--ndk', required=True, type=Path)
parser.add_argument('--runtime-build', required=True, type=Path)
parser.add_argument('--adb', required=True, type=Path)
parser.add_argument('--serial', required=True)
args = parser.parse_args()
source = Path(__file__).resolve().parent
runtime = args.runtime_build.resolve()
compilers = list(args.ndk.resolve().glob('toolchains/llvm/prebuilt/*/bin/aarch64-linux-android24-clang++'))
if len(compilers) != 1:
    parser.error('Expected exactly one NDK ARM64 API24 compiler')
library = runtime / 'lib/libc++_shared.so'
headers = runtime / 'include/c++/v1'
if not library.is_file() or not headers.is_dir():
    parser.error('Runtime build must contain its shared library and generated headers')
adb = [str(args.adb.resolve()), '-s', args.serial]
page_size = subprocess.check_output(adb + ['shell', 'getconf', 'PAGE_SIZE'], text=True).strip()
if page_size != '16384':
    parser.error(f'Expected a 16 KB device; reported page size {page_size!r}')
device_path = '/data/local/tmp/ujimora-runtime-probe'
with tempfile.TemporaryDirectory(prefix='ujimora-runtime-probe-') as temporary:
    output = Path(temporary)
    compiler = [str(compilers[0]), '-std=c++17', '-O2', '-fPIC', '-nostdinc++',
                '-I' + str(headers), '-nostdlib++', '-L' + str(runtime / 'lib'),
                '-lc++_shared', '-unwindlib=libunwind', '-Wl,-z,max-page-size=16384',
                '-Wl,-z,common-page-size=16384', '-Wl,-rpath,$ORIGIN']
    subprocess.run(compiler + ['-shared', str(source / 'library.cpp'), '-o', str(output / 'libujimora_probe.so')], check=True)
    subprocess.run(compiler + [str(source / 'main.cpp'), '-ldl', '-o', str(output / 'probe')], check=True)
    subprocess.run(adb + ['shell', 'mkdir', '-p', device_path], check=True)
    subprocess.run(adb + ['push', str(output / 'probe'), str(output / 'libujimora_probe.so'), str(library), device_path + '/'], check=True)
    subprocess.run(adb + ['shell', 'env', 'LD_LIBRARY_PATH=' + device_path, device_path + '/probe'], check=True)
