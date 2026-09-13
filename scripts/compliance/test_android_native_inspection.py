"""Exercise the CLI gate with controlled readelf segment output, not runtime claims."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile


CHECKER = Path(__file__).with_name('inspect-android-native.py')
LOAD = '  LOAD 0x000000 0x000000 0x000000 0x1000 0x1000 R E 0x4000\n'
RELRO = '  GNU_RELRO 0x003000 0x003000 0x003000 0x0100 0x1000 R 0x1\n'


class AndroidNativeInspection(unittest.TestCase):
    def inspect(self, output, abi='arm64-v8a'):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'fixture.aar'
            with zipfile.ZipFile(archive, 'w') as bundle:
                bundle.writestr(f'jni/{abi}/libfixture.so', b'controlled fixture')
            readelf = root / 'readelf'
            readelf.write_text(f'#!{sys.executable}\nprint({output!r})\n')
            readelf.chmod(0o755)
            result = subprocess.run(
                [sys.executable, str(CHECKER), str(archive), '--readelf', str(readelf)],
                capture_output=True, text=True, check=False,
            )
            return result

    def test_aligned_relro_passes_both_abis(self):
        for abi in ('arm64-v8a', 'x86_64'):
            with self.subTest(abi=abi):
                result = self.inspect(LOAD + RELRO, abi)
                self.assertEqual(result.returncode, 0, result.stderr)
                row = json.loads(result.stdout)['libraries'][0]
                self.assertTrue(row['relroPresent'])
                self.assertTrue(row['alignmentChecksPass'])

    def test_missing_relro_fails_even_with_aligned_load(self):
        result = self.inspect(LOAD)
        self.assertEqual(result.returncode, 1)
        row = json.loads(result.stdout)['libraries'][0]
        self.assertFalse(row['relroPresent'])
        self.assertFalse(row['alignmentChecksPass'])

    def test_unaligned_relro_fails(self):
        result = self.inspect(LOAD + RELRO.replace('0x1000 R', '0x0100 R'))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)['libraries'][0]['relroEndRemainders'], [0x3100])

    def test_unaligned_load_fails(self):
        self.assertEqual(self.inspect(LOAD.replace('0x4000', '0x1000') + RELRO).returncode, 1)

    def test_no_supported_libraries_is_not_a_pass(self):
        self.assertEqual(self.inspect(LOAD + RELRO, 'armeabi-v7a').returncode, 2)


if __name__ == '__main__':
    unittest.main()
