// SYSTEM
#include <stdio.h>
#include "hardware/pwm.h"

// PICO
#include "pico/stdlib.h"
#include "pico/stdio_usb.h"

// INTERNAL
#include "hardware/controller/ds4_controller.h"
#include "hardware/servo/servo.h"
#include "hardware/relay/relay.h"

// GPIO
#define THROTTLE_SERVO_PIN 0
#define STARTER_RELAY_PIN 1
//

// INPUT CONFIG
#define STEERING_DEADZONE 12
#define TRIGGER_DEADZONE 8
//

// BUTTON CONFIG
#define DS4_BUTTON_X 0x2000
#define DS4_BUTTON_LEFT_SHOULDER 0x0001
//

// THROTTLE CONFIG
#define THROTTLE_MIN_US 400
#define THROTTLE_MAX_US 2400
#define THROTTLE_START_MS 1.0f
//

static int8_t apply_deadzone(int8_t value, int8_t deadzone) {
    if (value > -deadzone && value < deadzone) {
        return 0;
    }

    return value;
}

static uint8_t apply_trigger_deadzone(uint8_t value, uint8_t deadzone) {
    return (value < deadzone) ? 0 : value;
}

static int map_range(
    int value,
    int in_min,
    int in_max,
    int out_min,
    int out_max
) {
    return (value - in_min) * (out_max - out_min) /
           (in_max - in_min) +
           out_min;
}

int main(void) {
    stdio_init_all();

    absolute_time_t serial_timeout = make_timeout_time_ms(3000);

    while (!stdio_usb_connected() && !time_reached(serial_timeout)) {
        sleep_ms(100);
    }

    if (stdio_usb_connected()) {
        printf("USB connected!\n");
    }

    printf("Starting DS4 controller...\n");
    ds4_controller_start();

    struct ds4_state state = {0};

    printf("Waiting for X press...\n");

    while (true) {
        sleep_ms(20);
        ds4_controller_read(&state);

        if (state.buttons & DS4_BUTTON_X) {
            break;
        }
    }

    printf("Controller ready!\n");

    setServo(THROTTLE_SERVO_PIN, THROTTLE_START_MS);
    initRelay(STARTER_RELAY_PIN);

    while (true) {
        sleep_ms(5);
        ds4_controller_read(&state);

        int throttle = apply_trigger_deadzone(state.r2, TRIGGER_DEADZONE);
        int brake = apply_trigger_deadzone(state.l2, TRIGGER_DEADZONE);
        int8_t steering = apply_deadzone(ds4_axis_i8(state.lx), STEERING_DEADZONE);

        bool starter = (state.buttons & DS4_BUTTON_LEFT_SHOULDER) != 0;

        int throttle_us = map_range(
            throttle,
            0,
            255,
            THROTTLE_MIN_US,
            THROTTLE_MAX_US
        );

        float throttle_ms = throttle_us / 1000.0f;

        setMillis(THROTTLE_SERVO_PIN, throttle_ms);
        setRelay(STARTER_RELAY_PIN, starter);
        
        printf(
            "starter:%d throttle:%3d brake:%3d steering:%4d throttle_us:%4d | raw buttons:%04x\n",
            starter,
            throttle,
            brake,
            steering,
            throttle_us,
            state.buttons
        );
    }
}