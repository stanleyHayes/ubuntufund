# ARM64 C++ runtime probe

Run only against an explicitly selected test device/emulator. This writes three
files to `/data/local/tmp/ujimora-runtime-probe`; it does not install or modify the
Ujimora app, request root, change device properties, or access account data.

```sh
python3 scripts/compliance/native-runtime-probe/run.py \
  --ndk /path/to/android-sdk/ndk/28.2.13676358 \
  --runtime-build /path/to/arm64-runtime-build \
  --adb /path/to/android-sdk/platform-tools/adb \
  --serial emulator-5580
```

The runtime build must contain `lib/libc++_shared.so` and its matching generated
`include/c++/v1` headers. The probe checks an actual 16384-byte device page size,
confirms the candidate runtime's mapped path, and exercises 32 library load/unload
cycles with eight worker threads each. Every worker allocates a string in the
shared library and deletes it in the executable, catches a cross-library
exception, and runs a thread-local destructor before the library is closed.

A pass covers these operations only. It does not verify x86_64, full C++ ABI
compatibility, unloading while worker threads remain active, JNI/media paths,
the packaged APK/AAB, upstream runtime suites, or store acceptance. Run ELF and
packaging inspections separately; retain the tested runtime hash with evidence.
