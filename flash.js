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

const GCC = TOOLS.gcc || "arm-none-eabi-gcc";
const GXX = TOOLS.gxx || "arm-none-eabi-g++";
const TOOLCHAIN_PATH = path.dirname(GCC);

const CLANG = TOOLS.clang || "clang";
const CLANGXX = TOOLS.clangxx || "clang++";
const LLVM_RC = TOOLS.llvmrc || "llvm-rc";

function run(cmd, args = [], cwd = ROOT_DIR) {
    console.log(`⚙️  ${cmd} ${args.join(" ")}`);

    execFileSync(cmd, args, {
        cwd,
        stdio: "inherit",
        shell: false,
        env: {
            ...process.env,
            CC: CLANG,
            CXX: CLANGXX,
            RC: LLVM_RC,
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
            `-DCMAKE_RC_COMPILER=${LLVM_RC}`,
            `-DPICO_TOOLCHAIN_PATH=${TOOLCHAIN_PATH}`,
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
    try {
        run(PICOTOOL, ["reboot", "-f", "-u"]);
        // Give USB time to re-enumerate into BOOTSEL
        execFileSync(process.platform === "win32" ? "timeout" : "sleep",
            process.platform === "win32" ? ["/t", "2", "/nobreak"] : ["2"],
            { stdio: "ignore", shell: true }
        );

        run(PICOTOOL, ["load", "-x", UF2_PATH]);
        return;
    } catch {
        if (process.platform !== "win32") throw new Error("picotool flash failed");

        console.log("⚠️  picotool failed; trying UF2 drive copy...");

        for (const drive of "DEFGHIJKLMNOPQRSTUVWXYZ") {
            const infoPath = `${drive}:\\INFO_UF2.TXT`;

            if (fs.existsSync(infoPath)) {
                console.log(`💾 Copying UF2 to ${drive}:\\`);
                fs.copyFileSync(UF2_PATH, `${drive}:\\${path.basename(UF2_PATH)}`);
                return;
            }
        }

        throw new Error("No RPI-RP2 UF2 drive found");
    }
}

async function main() {
    ensureTools();
    build();
    await flash();
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});