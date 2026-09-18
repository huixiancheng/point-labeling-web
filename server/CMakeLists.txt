cmake_minimum_required(VERSION 3.16)
project(point_labeler_server LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC OFF)

# The sources and the JSON error messages are UTF-8.  MSVC otherwise uses the
# active Windows code page for source decoding, which can turn a non-ASCII
# string literal into a spurious unterminated string on Chinese Windows.
if(MSVC)
  add_compile_options(/utf-8)
endif()

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

find_package(Qt5 REQUIRED COMPONENTS Core)
find_package(Threads REQUIRED)

# --- open-format backend -------------------------------------------------------
# The open target speaks a compact HTTP/frame protocol and reads standard
# SemanticKITTI/KITTI .bin + .label files directly.
add_library(point_labeler_lib STATIC
  src/io/OpenDataset.cpp
)
target_include_directories(point_labeler_lib PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(point_labeler_lib PUBLIC Qt5::Core)

# --- open-format regression test ------------------------------------------------
enable_testing()
add_executable(test_open_dataset tests/test_open_dataset.cpp)
target_link_libraries(test_open_dataset PRIVATE point_labeler_lib)
add_test(NAME open_dataset_regression COMMAND test_open_dataset)

# --- server --------------------------------------------------------------------
add_executable(point_labeler_server src/server/main.cpp)
target_include_directories(point_labeler_server PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/third_party)
target_link_libraries(point_labeler_server PRIVATE point_labeler_lib Threads::Threads)
if(WIN32)
  target_link_libraries(point_labeler_server PRIVATE advapi32 ole32 shell32)
endif()
