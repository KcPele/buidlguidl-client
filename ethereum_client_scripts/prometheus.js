import pty from "node-pty";
import fs from "fs";
import os from "os";
import path from "path";
import { debugToFile } from "../helpers.js";
import { stripAnsiCodes, getFormattedDateTime } from "../helpers.js";
import minimist from "minimist";

let installDir = os.homedir();
let prometheusPort = 9090;

const argv = minimist(process.argv.slice(2));

// Check if a different install directory was provided via the `--directory` option
if (argv.directory) {
  installDir = argv.directory;
}

if (argv.prometheusport) {
  prometheusPort = parseInt(argv.prometheusport, 10);
}

const configPath = path.join(installDir, "ethereum_clients", "prometheus", "prometheus.yml");

// Read the dynamically generated prometheus config
if (!fs.existsSync(configPath)) {
  console.error("Prometheus config file not found:", configPath);
  process.exit(1);
}

let prometheusCommand;
const platform = os.platform();
if (["darwin", "linux"].includes(platform)) {
  prometheusCommand = path.join(
    installDir,
    "ethereum_clients",
    "prometheus",
    "prometheus"
  );
} else if (platform === "win32") {
  prometheusCommand = path.join(
    installDir,
    "ethereum_clients",
    "prometheus",
    "prometheus.exe"
  );
}

const logFilePath = path.join(
  installDir,
  "ethereum_clients",
  "prometheus",
  "logs",
  `prometheus_${getFormattedDateTime()}.log`
);

// Ensure logs directory exists
const logsDir = path.dirname(logFilePath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

const prometheusArgs = [
  "--config.file",
  configPath,
  "--storage.tsdb.path",
  path.join(installDir, "ethereum_clients", "prometheus", "data"),
  "--web.listen-address",
  `0.0.0.0:${prometheusPort}`,
  "--web.enable-lifecycle", // Allows reloading config via HTTP POST
];

debugToFile(`Starting Prometheus on port ${prometheusPort}`);

const prometheus = pty.spawn(`${prometheusCommand}`, prometheusArgs, {
  name: "xterm-color",
  cols: 80,
  rows: 30,
  cwd: process.env.HOME,
  env: { ...process.env, INSTALL_DIR: installDir },
});

// Pipe stdout and stderr to the log file and to the parent process
prometheus.on("data", (data) => {
  logStream.write(stripAnsiCodes(data));
  if (process.send) {
    process.send({ log: data }); // Send to parent process
  }
});

prometheus.on("exit", (code) => {
  const exitMessage = `Prometheus process exited with code ${code}\n`;
  logStream.write(exitMessage);
  logStream.end();
  if (process.send) {
    process.send({ log: exitMessage });
  }
});

prometheus.on("error", (err) => {
  const errorMessage = `Error: ${err.message}\n`;
  logStream.write(errorMessage);
  if (process.send) {
    process.send({ log: errorMessage }); // Send error message to parent process
  }
  debugToFile(`From prometheus.js: ${errorMessage}`);
});

process.on("SIGINT", () => {
  prometheus.kill("SIGINT");
});

process.on("SIGTERM", () => {
  prometheus.kill("SIGTERM");
});