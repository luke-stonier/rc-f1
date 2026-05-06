#include "servo.h"

// SYSTEM
#include <stdio.h>
#include "hardware/pwm.h"

// PICO
#include "pico/stdlib.h"

#define SERVO_WRAP 39062
#define SERVO_PERIOD_MS 20.0f

void setMillis(int servoPin, float millis)
{
    pwm_set_gpio_level(
        servoPin,
        (millis / SERVO_PERIOD_MS) * SERVO_WRAP
    );
}

void setServo(int servoPin, float startMillis)
{
    gpio_set_function(servoPin, GPIO_FUNC_PWM);

    uint slice_num = pwm_gpio_to_slice_num(servoPin);

    pwm_config config = pwm_get_default_config();

    pwm_config_set_clkdiv(&config, 64.0f);
    pwm_config_set_wrap(&config, SERVO_WRAP);

    pwm_init(slice_num, &config, true);

    setMillis(servoPin, startMillis);
}