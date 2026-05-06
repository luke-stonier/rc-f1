#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { SerialPort } = require("serialport");

const ROOT_DIR = __dirname;
const BUILD_DIR = path.join(ROOT_DIR, "build");
const UF2_PATH = path.join(BUILD_DIR, "rc_f1.uf2");
const TOOLS_PATH = path.join(ROOT_DIR, ".rc-f1-tools.json");

const TOOLS = fs.existsSync(TOOLS_PATH)
    ? JSON.parse(fs.readFileSync(TOOLS_PATH, "utf8"))
    : {};

const CMAKE = TOOLS.cmake || "cmake";
const NINJA = TOOLS.ninja || "ninja";
const PICOTOOL = TOOLS.picotool || "picotool";

function run(cmd, args = [], cwd = ROOT_DIR) {
    console.log(`⚙️  ${cmd} ${args.join(" ")}`);

    execFileSync(cmd, args, {
        cwd,
        stdio: "inherit",
        shell: false,
        env: {
            ...process.env,
            PICO_SDK_FETCH_FROM_GIT: "1",
        },
    });
}

function has(cmd, args = ["--version"]) {
    if (path.isAbsolute(cmd) && fs.existsSync(cmd)) {
        return true;
    }

    try {
        execFileSync(cmd, args, {
            stdio: "ignore",
            shell: false,
            env: process.env,
        });
        return true;
    } catch {
        return false;
    }
}

function requireTool(name, cmd) {
    if (has(cmd)) return;

    console.error(`❌ ${name} not found: ${cmd}`);
    console.error("👉 Run:");
    console.error("   npm run setup");
    process.exit(1);
}

function ensureTools() {
    requireTool("CMake", CMAKE);
    requireTool("Ninja", NINJA);
    requireTool("picotool", PICOTOOL);
}

function ensureBuildConfigured() {
    const cachePath = path.join(BUILD_DIR, "CMakeCache.txt");

    if (fs.existsSync(cachePath)) {
        const cache = fs.readFileSync(cachePath, "utf8");

        if (
            process.platform === "win32" &&
            (cache.includes("/opt/homebrew") || cache.includes("/Volumes/"))
        ) {
            console.log("🧹 Removing stale macOS build directory...");
            fs.rmSync(BUILD_DIR, { recursive: true, force: true });
        }
    }

    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR);
    }

    if (!fs.existsSync(path.join(BUILD_DIR, "build.ninja"))) {
        run(CMAKE, [
            "-G",
            "Ninja",
            `-DCMAKE_MAKE_PROGRAM=${NINJA}`,
            "-DPICO_BOARD=pico_w",
            "..",
        ], BUILD_DIR);
    }
}

function build() {
    ensureBuildConfigured();
    run(NINJA, [], BUILD_DIR);

    if (!fs.existsSync(UF2_PATH)) {
        console.error(`❌ UF2 not found: ${UF2_PATH}`);
        process.exit(1);
    }
}

function flash() {
    run(PICOTOOL, ["load", UF2_PATH, "-f"]);
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
    ensureTools();
    build();
    flash();

    console.log("⏳ Waiting for Pico serial...");
    const port = await findSerial();

    openSerial(port);
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});