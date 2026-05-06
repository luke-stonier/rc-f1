#!/usr/bin/env node

const { execFileSync } = require("child_process");

function run(cmd, args = []) {
    console.log(`⚙️  ${cmd} ${args.join(" ")}`);

    execFileSync(cmd, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
    });
}

function has(cmd) {
    try {
        execFileSync(cmd, ["--version"], {
            stdio: "ignore",
            shell: process.platform === "win32",
        });
        return true;
    } catch {
        return false;
    }
}

run("npm", ["install"]);

if (process.platform === "darwin") {
    if (!has("brew")) {
        console.log("❌ Homebrew missing. Install it first: https://brew.sh");
        process.exit(1);
    }

    run("brew", ["install", "cmake", "ninja", "picotool"]);
}

if (process.platform === "win32") {
    if (!has("winget")) {
        console.log("❌ winget missing. Install App Installer from the Microsoft Store.");
        process.exit(1);
    }

    run("winget", ["install", "--id", "Kitware.CMake", "-e"]);
    run("winget", ["install", "--id", "Ninja-build.Ninja", "-e"]);
    run("winget", ["install", "--id", "RaspberryPi.PicoTool", "-e"]);
}