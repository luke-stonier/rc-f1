#pragma once

#include <stdbool.h>
#include <stdint.h>

struct ds4_state {
    uint16_t buttons;
    uint8_t lx;
    uint8_t ly;
    uint8_t rx;
    uint8_t ry;
    uint8_t l2;
    uint8_t r2;
    uint8_t hat;
};

void ds4_controller_start(void);
void ds4_controller_read(struct ds4_state *out);
int8_t ds4_axis_i8(uint8_t value);