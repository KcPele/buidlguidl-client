import pty from "node-pty";
import fs from "fs";
import os from "os";
import path from "path";
import { debugToFile } from "../helpers.js";
import { stripAnsiCodes, getFormattedDateTime } from "../helpers.js";
import minimist from "minimist";

let installDir = os.homedir();
let grafanaPort = 3000;

const argv = minimist(process.argv.slice(2));

// Check if a different install directory was provided via the `--directory` option
if (argv.directory) {
  installDir = argv.directory;
}

if (argv.grafanaport) {
  grafanaPort = parseInt(argv.grafanaport, 10);
}

let grafanaCommand;
const platform = os.platform();
if (["darwin", "linux"].includes(platform)) {
  grafanaCommand = path.join(
    installDir,
    "ethereum_clients",
    "grafana",
    "bin",
    "grafana-server"
  );
} else if (platform === "win32") {
  grafanaCommand = path.join(
    installDir,
    "ethereum_clients",
    "grafana",
    "bin",
    "grafana-server.exe"
  );
}

const grafanaHome = path.join(installDir, "ethereum_clients", "grafana");
const configPath = path.join(grafanaHome, "conf", "custom.ini");
const provisioningPath = path.join(grafanaHome, "conf", "provisioning");

// Create custom config if it doesn't exist
if (!fs.existsSync(configPath)) {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const customConfig = `[server]
http_port = ${grafanaPort}
domain = localhost
root_url = http://localhost:${grafanaPort}

[paths]
data = ${path.join(grafanaHome, "data")}
logs = ${path.join(grafanaHome, "logs")}
plugins = ${path.join(grafanaHome, "plugins")}
provisioning = ${provisioningPath}

[security]
admin_user = admin
admin_password = admin

[auth.anonymous]
enabled = true
org_role = Viewer

[log]
mode = console file
level = info

[log.console]
level = info

[log.file]
level = info
`;

  fs.writeFileSync(configPath, customConfig);
  debugToFile("Created Grafana custom config");
}

const logFilePath = path.join(
  grafanaHome,
  "logs",
  `grafana_${getFormattedDateTime()}.log`
);

// Ensure logs directory exists
const logsDir = path.dirname(logFilePath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

const grafanaArgs = [
  "--config",
  configPath,
  "--homepath",
  grafanaHome,
];

debugToFile(`Starting Grafana on port ${grafanaPort}`);

const grafana = pty.spawn(`${grafanaCommand}`, grafanaArgs, {
  name: "xterm-color",
  cols: 80,
  rows: 30,
  cwd: grafanaHome,
  env: { 
    ...process.env, 
    INSTALL_DIR: installDir,
    GF_PATHS_CONFIG: configPath,
    GF_PATHS_DATA: path.join(grafanaHome, "data"),
    GF_PATHS_HOME: grafanaHome,
    GF_PATHS_LOGS: path.join(grafanaHome, "logs"),
    GF_PATHS_PLUGINS: path.join(grafanaHome, "plugins"),
    GF_PATHS_PROVISIONING: provisioningPath,
  },
});

// Pipe stdout and stderr to the log file and to the parent process
grafana.on("data", (data) => {
  logStream.write(stripAnsiCodes(data));
  if (process.send) {
    process.send({ log: data }); // Send to parent process
  }
});

grafana.on("exit", (code) => {
  const exitMessage = `Grafana process exited with code ${code}\n`;
  logStream.write(exitMessage);
  logStream.end();
  if (process.send) {
    process.send({ log: exitMessage });
  }
});

grafana.on("error", (err) => {
  const errorMessage = `Error: ${err.message}\n`;
  logStream.write(errorMessage);
  if (process.send) {
    process.send({ log: errorMessage }); // Send error message to parent process
  }
  debugToFile(`From grafana.js: ${errorMessage}`);
});

process.on("SIGINT", () => {
  grafana.kill("SIGINT");
});

process.on("SIGTERM", () => {
  grafana.kill("SIGTERM");
});