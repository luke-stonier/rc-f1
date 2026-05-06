#include "relay.h"

#include "pico/stdlib.h"

void initRelay(int relayPin)
{
    gpio_init(relayPin);
    gpio_set_dir(relayPin, GPIO_OUT);

    // Default OFF
    gpio_put(relayPin, false);
}

void setRelay(int relayPin, bool enabled)
{
    gpio_put(relayPin, enabled);
}