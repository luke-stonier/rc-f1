#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { SerialPort } = require("serialport");

const ROOT_DIR = __dirname;
const BUILD_DIR = path.join(ROOT_DIR, "build");
const UF2_PATH = path.join(BUILD_DIR, "rc_f1.uf2");

function run(cmd, args = [], cwd = ROOT_DIR) {
    console.log(`⚙️  ${cmd} ${args.join(" ")}`);

    execFileSync(cmd, args, {
        cwd,
        stdio: "inherit",
        env: {
            ...process.env,
            PICO_SDK_FETCH_FROM_GIT: "1",
        },
        shell: process.platform === "win32",
    });
}

function ensureBuildConfigured() {
    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR);
    }

    if (!fs.existsSync(path.join(BUILD_DIR, "build.ninja"))) {
        run("cmake", ["-G", "Ninja", "-DPICO_BOARD=pico_w", ".."], BUILD_DIR);
    }
}

function build() {
    ensureBuildConfigured();
    run("ninja", [], BUILD_DIR);

    if (!fs.existsSync(UF2_PATH)) {
        console.error(`❌ UF2 not found: ${UF2_PATH}`);
        process.exit(1);
    }
}

function flash() {
    run("picotool", ["load", UF2_PATH, "-f"]);
}

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
                text.includes("rp2350")
            );
        });

        if (pico) {
            return pico.path;
        }

        await sleep(250);
    }

    console.error("❌ No Pico serial device found");
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
        // Ctrl+C
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
    build();
    flash();

    console.log("⏳ Waiting for Pico serial...");
    const port = await findSerial();

    openSerial(port);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});