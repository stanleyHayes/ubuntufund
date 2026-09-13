#include <atomic>
#include <dlfcn.h>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <unistd.h>
#include <vector>

int main() {
  if (sysconf(_SC_PAGESIZE) != 16384) return 10;
  std::ifstream maps("/proc/self/maps");
  std::string line;
  bool candidate_loaded = false;
  while (std::getline(maps, line)) {
    if (line.find("/data/local/tmp/ujimora-runtime-probe/libc++_shared.so") != std::string::npos) {
      candidate_loaded = true;
      std::cout << "runtime-map: " << line << '\n';
    }
  }
  if (!candidate_loaded) return 11;
  for (int iteration = 0; iteration < 32; ++iteration) {
    void* library = dlopen("libujimora_probe.so", RTLD_NOW | RTLD_LOCAL);
    if (!library) { std::cerr << dlerror() << '\n'; return 12; }
    auto create = reinterpret_cast<std::string* (*)()>(dlsym(library, "create_value"));
    auto raise = reinterpret_cast<void (*)()>(dlsym(library, "throw_value"));
    auto initialize = reinterpret_cast<void (*)(std::atomic<int>*)>(dlsym(library, "initialize_thread_cleanup"));
    if (!create || !raise || !initialize) return 13;
    std::atomic<int> cleaned{0}, failures{0}, caught{0};
    std::vector<std::thread> threads;
    for (int worker = 0; worker < 8; ++worker) threads.emplace_back([&] {
      initialize(&cleaned);
      auto value = create();
      if (*value != std::string(4096, 'u')) failures.fetch_add(1);
      delete value;
      try { raise(); failures.fetch_add(1); }
      catch (const std::runtime_error& error) {
        if (std::string(error.what()) == "ujimora-runtime-exception") caught.fetch_add(1);
        else failures.fetch_add(1);
      }
      catch (...) { failures.fetch_add(1); }
    });
    for (auto& thread : threads) thread.join();
    if (failures.load() || caught.load() != 8 || cleaned.load() != 8) return 14;
    if (dlclose(library) != 0) return 15;
  }
  std::cout << "PASS: 16KB, candidate runtime mapped, 32 load/unload cycles, 256 cross-DSO allocations/exceptions/TLS cleanups\n";
}
