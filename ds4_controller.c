#include "ds4_controller.h"

#include "pico/stdlib.h"
#include "pico/multicore.h"

#include "bt_hid.h"

static inline int8_t clamp8(int16_t value) {
    if (value > 127) return 127;
    if (value < -128) return -128;
    return value;
}

void ds4_controller_start(void) {
    multicore_launch_core1(bt_main);

    // Give Bluetooth stack time to initialise.
    sleep_ms(1000);
}

void ds4_controller_read(struct ds4_state *out) {
    struct bt_hid_state state;
    bt_hid_get_latest(&state);

    out->buttons = state.buttons;
    out->lx = state.lx;
    out->ly = state.ly;
    out->rx = state.rx;
    out->ry = state.ry;
    out->l2 = state.l2;
    out->r2 = state.r2;
    out->hat = state.hat;
}

int8_t ds4_axis_i8(uint8_t value) {
    return clamp8((int16_t)value - 128);
}