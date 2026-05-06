#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const BUILD_DIR = path.join(ROOT_DIR, "build");
const UF2_PATH = path.join(BUILD_DIR, "rc_f1.uf2");

function run(cmd, cwd = ROOT_DIR) {
    console.log(`⚙️  ${cmd}`);
    execSync(cmd, {
        cwd,
        stdio: "inherit",
        env: {
            ...process.env,
            PICO_SDK_FETCH_FROM_GIT: "1",
        },
    });
}

function ensureBuildConfigured() {
    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR);
    }

    if (!fs.existsSync(path.join(BUILD_DIR, "build.ninja"))) {
        run("cmake -G Ninja -DPICO_BOARD=pico_w ..", BUILD_DIR);
    }
}

function build() {
    ensureBuildConfigured();
    run("ninja", BUILD_DIR);

    if (!fs.existsSync(UF2_PATH)) {
        console.error(`❌ UF2 not found: ${UF2_PATH}`);
        process.exit(1);
    }
}

function flash() {
    run(`picotool load "${UF2_PATH}" -f`);
}

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function findSerial() {
    for (let i = 0; i < 20; i++) {
        const devices = fs
            .readdirSync("/dev")
            .filter(f => f.startsWith("cu.usbmodem"));

        if (devices.length > 0) {
            return `/dev/${devices[0]}`;
        }

        sleep(250);
    }

    console.error("❌ No Pico serial device found");
    process.exit(1);
}

function openSerial(port) {
    console.log(`📡 Connecting to ${port}\n`);

    const proc = spawn("screen", [port, "115200"], {
        stdio: "inherit",
    });

    proc.on("exit", () => process.exit(0));
}

function main() {
    build();
    flash();

    console.log("⏳ Waiting for Pico serial...");
    const port = findSerial();

    openSerial(port);
}

main();