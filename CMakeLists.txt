cmake_minimum_required(VERSION 3.13)

set(PICO_BTSTACK_PATH ${CMAKE_CURRENT_LIST_DIR}/picow_ds4/btstack)

include(picow_ds4/pico_sdk_import.cmake)

project(rc_f1 C CXX ASM)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(rc_f1
    main.c
    drive.c
    picow_ds4/src/bt_hid.c
    picow_ds4/src/ds4_controller.c
)

pico_enable_stdio_usb(rc_f1 1)
pico_enable_stdio_uart(rc_f1 0)
pico_enable_stdio_semihosting(rc_f1 0)

target_include_directories(rc_f1 PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}
    ${CMAKE_CURRENT_LIST_DIR}/picow_ds4/src
)

target_link_libraries(rc_f1
    hardware_pwm
    hardware_gpio
    pico_stdlib
    pico_cyw43_arch_none
    pico_btstack_classic
    pico_btstack_ble
    pico_btstack_cyw43
    pico_multicore
)

pico_add_extra_outputs(rc_f1)