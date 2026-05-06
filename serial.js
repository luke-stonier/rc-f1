const {SerialPort} = require("serialport");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function findSerial() {
    for (let i = 0; i < 20; i++) {
        const ports = await SerialPort.list();

        const pico = ports.find(port => {
            const text = [
                port.path,
                port.manufacturer,
                port.friendlyName,
                port.pnpId,
                port.serialNumber,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return (
                text.includes("pico") ||
                text.includes("raspberry") ||
                text.includes("usbmodem") ||
                text.includes("rp2040") ||
                text.includes("rp2350") ||
                text.includes("usb serial device") ||
                text.includes("usb\\vid_2e8a")
            );
        });

        if (pico) {
            return pico.path;
        }

        await sleep(250);
    }

    console.error("❌ No Pico serial device found");
    console.error("👉 Make sure the Pico is connected and running USB serial.");
    process.exit(1);
}

function openSerial(portPath) {
    console.log(`📡 Connecting to ${portPath}\n`);

    const port = new SerialPort({
        path: portPath,
        baudRate: 115200,
    });

    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.pipe(port);
    port.pipe(process.stdout);

    process.stdin.on("data", data => {
        if (data.length === 1 && data[0] === 0x03) {
            process.exit(0);
        }
    });

    port.on("error", err => {
        console.error(`❌ Serial error: ${err.message}`);
        process.exit(1);
    });
}

async function main() {
    console.log("⏳ Waiting for Pico serial...");
    const port = await findSerial();

    openSerial(port);
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});