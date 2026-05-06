#include <stdio.h>

#include "pico/stdlib.h"
#include "pico/stdio_usb.h"

#include "ds4_controller.h"

int main(void) {
    stdio_init_all();

    while (!stdio_usb_connected()) {
        sleep_ms(100);
    }

    printf("USB connected!\n");

    ds4_controller_start();

    struct ds4_state state;

    while (true) {
        sleep_ms(20);

        ds4_controller_read(&state);

        int8_t throttle = state.r2;              // 0..255
        int8_t steering = ds4_axis_i8(state.lx); // -128..127
        bool starter = (state.buttons & 0x0001) != 0; // placeholder

        printf(
            "starter:%d throttle:%3d steering:%4d | raw buttons:%04x lx:%3d ly:%3d rx:%3d ry:%3d l2:%3d r2:%3d hat:%d\n",
            starter,
            throttle,
            steering,
            state.buttons,
            state.lx,
            state.ly,
            state.rx,
            state.ry,
            state.l2,
            state.r2,
            state.hat
        );

        // later:
        // if (starter) drive_enable();
        // drive_set(throttle, steering);
    }
}