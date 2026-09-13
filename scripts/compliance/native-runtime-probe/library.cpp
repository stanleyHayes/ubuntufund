#include <atomic>
#include <stdexcept>
#include <string>

namespace {
struct Cleanup {
  std::atomic<int>* count;
  ~Cleanup() { count->fetch_add(1); }
};
}

extern "C" std::string* create_value() {
  return new std::string(4096, 'u');
}
extern "C" void throw_value() {
  throw std::runtime_error("ujimora-runtime-exception");
}
extern "C" void initialize_thread_cleanup(std::atomic<int>* count) {
  thread_local Cleanup cleanup{count};
}
