#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const TOOLS_FILE = path.join(ROOT_DIR, ".rc-f1-tools.json");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

const NPM = process.env.npm_execpath ? process.execPath : isWin ? "npm.cmd" : "npm";
const NPM_ARGS = process.env.npm_execpath
    ? [process.env.npm_execpath, "install"]
    : ["install"];

function run(command, args = []) {
    console.log(`⚙️  ${command} ${args.join(" ")}`);

    execFileSync(command, args, {
        stdio: "inherit",
        shell: false,
        env: process.env,
    });
}

function tryRun(command, args = []) {
    try {
        run(command, args);
        return true;
    } catch {
        return false;
    }
}

function canRun(command, args = ["--version"]) {
    try {
        execFileSync(command, args, {
            stdio: "ignore",
            shell: false,
            env: process.env,
        });
        return true;
    } catch {
        return false;
    }
}

function ensureGitSubmodules() {
    if (!fs.existsSync(path.join(ROOT_DIR, ".git"))) {
        return;
    }

    if (!canRun("git")) {
        console.log("⚠️  git not found; skipping submodule setup.");
        return;
    }

    console.log("🧩 Initialising git submodules...");
    run("git", ["submodule", "update", "--init", "--recursive"]);
}

function removeStaleBuild() {
    const cachePath = path.join(ROOT_DIR, "build", "CMakeCache.txt");

    if (!fs.existsSync(cachePath)) {
        return;
    }

    const cache = fs.readFileSync(cachePath, "utf8");

    const stale =
        (process.platform === "win32" &&
            (cache.includes("/opt/homebrew") || cache.includes("/Volumes/"))) ||
        (process.platform !== "win32" &&
            cache.match(/[A-Z]:\\/));

    if (stale) {
        console.log("🧹 Removing stale cross-platform build directory...");
        fs.rmSync(path.join(ROOT_DIR, "build"), {
            recursive: true,
            force: true,
        });
    }
}

function addPath(dir) {
    if (!dir || !fs.existsSync(dir)) return;

    const parts = process.env.PATH.split(path.delimiter);
    const exists = parts.some(p => p.toLowerCase() === dir.toLowerCase());

    if (!exists) {
        process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
    }
}

function findExe(name) {
    const exe = isWin ? `${name}.exe` : name;

    const directDirs = [
        "C:\\Program Files\\CMake\\bin",
        "C:\\Program Files\\Ninja",
        path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links"),

        "C:\\Program Files\\Raspberry Pi\\Pico SDK v1.5.1\\picotool",
        "C:\\Program Files\\Raspberry Pi\\Pico SDK v2.0.0\\picotool",
        "C:\\Program Files\\Raspberry Pi\\Pico SDK v2.1.0\\picotool",
        "C:\\Program Files\\Raspberry Pi\\Pico SDK v2.2.0\\picotool",
    ];

    for (const dir of directDirs) {
        const full = path.join(dir, exe);
        if (fs.existsSync(full)) return full;
    }

    if (isWin) {
        const scanRoots = [
            path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages"),
            "C:\\Program Files",
            "C:\\Program Files (x86)",
        ];

        for (const root of scanRoots) {
            const found = scanForFile(root, exe, 4);
            if (found) return found;
        }
    }

    return canRun(name) ? name : null;
}

function installPicoWindowsTools() {
    const installer = path.join(ROOT_DIR, ".tools", "pico-setup.exe");

    fs.mkdirSync(path.dirname(installer), { recursive: true });

    const url =
        "https://github.com/raspberrypi/pico-setup-windows/releases/latest/download/pico-setup-windows-x64-standalone.exe";

    console.log("⬇️  Downloading Raspberry Pi Pico setup...");

    run("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri "${url}" -OutFile "${installer}"`,
    ]);

    console.log("🛠️  Installing Pico SDK tools...");

    run("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Start-Process -FilePath "${installer}" -ArgumentList "/S" -Wait -Verb RunAs`,
    ]);

    console.log("✅  Pico SDK tools Installed!");
}

function scanForFile(dir, filename, depth) {
    if (!dir || depth < 0 || !fs.existsSync(dir)) return null;

    let entries;

    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return null;
    }

    for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
            return full;
        }

        if (entry.isDirectory()) {
            const found = scanForFile(full, filename, depth - 1);
            if (found) return found;
        }
    }

    return null;
}

function refreshPathFromTools(tools) {
    for (const value of Object.values(tools)) {
        if (value && path.isAbsolute(value)) {
            addPath(path.dirname(value));
        }
    }
}

function saveTools(tools) {
    fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 4));
}

console.log("📦 Installing npm dependencies...");
if (!tryRun(NPM, NPM_ARGS)) {
    console.log("❌ npm install failed.");
    process.exit(1);
}

ensureGitSubmodules();
removeStaleBuild();

if (isMac) {
    if (!canRun("brew")) {
        console.log("❌ Homebrew missing. Install it first: https://brew.sh");
        process.exit(1);
    }

    console.log("🍺 Installing macOS dependencies...");
    tryRun("brew", ["install", "cmake", "ninja", "picotool"]);
}

if (isWin) {
    if (!canRun("winget")) {
        console.log("❌ winget missing. Install App Installer from the Microsoft Store.");
        process.exit(1);
    }

    console.log("🪟 Installing Windows dependencies...");

    tryRun("winget", [
        "install",
        "--id",
        "Kitware.CMake",
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements",
    ]);

    tryRun("winget", [
        "install",
        "--id",
        "Ninja-build.Ninja",
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements",
    ]);
}

const tools = {
    npm: NPM,
    git: findExe("git"),
    cmake: findExe("cmake"),
    ninja: findExe("ninja"),
    picotool: findExe("picotool"),
};

refreshPathFromTools(tools);
saveTools(tools);

console.log("\n🔎 Verifying setup...");

let ok = true;

for (const [name, value] of Object.entries(tools)) {
    const required = name !== "picotool";

    if (value) {
        console.log(`✅ ${name}: ${value}`);
    } else if (required) {
        console.log(`❌ ${name} not found`);
        ok = false;
    } else {
        console.log(`⚠️  ${name} not found`);
    }
}

if (!tools.picotool) {
    installPicoWindowsTools();
}

if (!ok) {
    console.log("\n❌ Setup incomplete.");
    process.exit(1);
}

console.log("\n🎉 Setup complete.");
console.log("You can build now. Flashing needs picotool.");