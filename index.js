import { execSync, spawn } from "child_process";
import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { initializeMonitoring } from "./monitor.js";
import { installMacLinuxClient, installPrometheus, installGrafana } from "./ethereum_client_scripts/install.js";
import { initializeWebSocketConnection } from "./web_socket_connection/webSocketConnection.js";
import { generatePrometheusConfig } from "./generatePrometheusConfig.js";
import { generateGrafanaProvisioning } from "./generateGrafanaProvisioning.js";
import MetricsExporter from "./metricsExporter.js";
import {
  executionClient,
  executionType,
  consensusClient,
  executionPeerPort,
  consensusPeerPorts,
  consensusCheckpoint,
  installDir,
  owner,
  enableMetrics,
  prometheusPort,
  grafanaPort,
  saveOptionsToFile,
  deleteOptionsFile,
} from "./commandLineOptions.js";
import {
  fetchBGExecutionPeers,
  configureBGExecutionPeers,
  fetchBGConsensusPeers,
  configureBGConsensusPeers,
} from "./ethereum_client_scripts/configureBGPeers.js";
import { getVersionNumber } from "./ethereum_client_scripts/install.js";
import { debugToFile } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lockFilePath = path.join(installDir, "ethereum_clients", "script.lock");

// const CONFIG = {
//   debugLogPath: path.join(installDir, "ethereum_clients", "debugIndex.log"),
// };

function createJwtSecret(jwtDir) {
  if (!fs.existsSync(jwtDir)) {
    console.log(`\nCreating '${jwtDir}'`);
    fs.mkdirSync(jwtDir, { recursive: true });
  }

  if (!fs.existsSync(`${jwtDir}/jwt.hex`)) {
    console.log("Generating JWT.hex file.");
    execSync(`cd "${jwtDir}" && openssl rand -hex 32 > jwt.hex`, {
      stdio: "inherit",
    });
  }
}

let executionChild;
let consensusChild;
let prometheusChild;
let grafanaChild;
let metricsExporter;

let executionExited = false;
let consensusExited = false;
let prometheusExited = false;
let grafanaExited = false;

let isExiting = false;

function handleExit(exitType) {
  if (isExiting) return; // Prevent multiple calls

  // Check if the current process PID matches the one in the lockfile
  try {
    if (fs.existsSync(lockFilePath)) {
      const lockFilePid = fs.readFileSync(lockFilePath, "utf8");
      if (parseInt(lockFilePid) !== process.pid) {
        console.log(
          `This client process (${process.pid}) is not the first instance launched. Closing dashboard view without killing clients.`
        );
        process.exit(0);
      }
    } else {
      // No lock file exists, this is likely a crash scenario
      debugToFile("Lock file does not exist during exit, proceeding with cleanup");
    }
  } catch (error) {
    debugToFile(`Error reading lockfile during exit: ${error.message}`);
    // Continue with cleanup even if we can't read the lock file
  }

  isExiting = true;

  console.log(`\n\n🛰️  Received exit signal: ${exitType}\n`);

  deleteOptionsFile();
  debugToFile(`handleExit(): deleteOptionsFile() has been called`);

  try {
    // Check if all child processes have exited
    const checkExit = () => {
      const metricsProcessesExited = !enableMetrics || (prometheusExited && grafanaExited);
      if (executionExited && consensusExited && metricsProcessesExited) {
        console.log("\n👍 All processes exited!");
        removeLockFile();
        process.exit(0);
      }
    };

    // Handle execution client exit
    const handleExecutionExit = (code) => {
      if (!executionExited) {
        executionExited = true;
        console.log(`🫡 Execution client exited with code ${code}`);
        checkExit();
      }
    };

    // Handle consensus client exit
    const handleConsensusExit = (code) => {
      if (!consensusExited) {
        consensusExited = true;
        console.log(`🫡 Consensus client exited with code ${code}`);
        checkExit();
      }
    };

    // Handle execution client close
    const handleExecutionClose = (code) => {
      if (!executionExited) {
        executionExited = true;
        console.log(`🫡 Execution client closed with code ${code}`);
        checkExit();
      }
    };

    // Handle consensus client close
    const handleConsensusClose = (code) => {
      if (!consensusExited) {
        consensusExited = true;
        console.log(`🫡 Consensus client closed with code ${code}`);
        checkExit();
      }
    };

    // Handle prometheus exit
    const handlePrometheusExit = (code) => {
      if (!prometheusExited) {
        prometheusExited = true;
        console.log(`🫡 Prometheus exited with code ${code}`);
        checkExit();
      }
    };

    // Handle prometheus close
    const handlePrometheusClose = (code) => {
      if (!prometheusExited) {
        prometheusExited = true;
        console.log(`🫡 Prometheus closed with code ${code}`);
        checkExit();
      }
    };

    // Handle grafana exit
    const handleGrafanaExit = (code) => {
      if (!grafanaExited) {
        grafanaExited = true;
        console.log(`🫡 Grafana exited with code ${code}`);
        checkExit();
      }
    };

    // Handle grafana close
    const handleGrafanaClose = (code) => {
      if (!grafanaExited) {
        grafanaExited = true;
        console.log(`🫡 Grafana closed with code ${code}`);
        checkExit();
      }
    };

    // Ensure event listeners are set before killing the processes
    if (executionChild && !executionExited) {
      executionChild.on("exit", handleExecutionExit);
      executionChild.on("close", handleExecutionClose);
    } else {
      executionExited = true;
    }

    if (consensusChild && !consensusExited) {
      consensusChild.on("exit", handleConsensusExit);
      consensusChild.on("close", handleConsensusClose);
    } else {
      consensusExited = true;
    }

    if (enableMetrics) {
      if (prometheusChild && !prometheusExited) {
        prometheusChild.on("exit", handlePrometheusExit);
        prometheusChild.on("close", handlePrometheusClose);
      } else {
        prometheusExited = true;
      }

      if (grafanaChild && !grafanaExited) {
        grafanaChild.on("exit", handleGrafanaExit);
        grafanaChild.on("close", handleGrafanaClose);
      } else {
        grafanaExited = true;
      }
    } else {
      prometheusExited = true;
      grafanaExited = true;
    }

    // Send the kill signals after setting the event listeners
    if (executionChild && !executionExited) {
      console.log("⌛️ Exiting execution client...");
      setTimeout(() => {
        executionChild.kill("SIGINT");
      }, 750);
    }

    if (consensusChild && !consensusExited) {
      console.log("⌛️ Exiting consensus client...");
      setTimeout(() => {
        consensusChild.kill("SIGINT");
      }, 750);
    }

    if (enableMetrics) {
      if (prometheusChild && !prometheusExited) {
        console.log("⌛️ Exiting Prometheus...");
        setTimeout(() => {
          prometheusChild.kill("SIGTERM");
        }, 750);
      }

      if (grafanaChild && !grafanaExited) {
        console.log("⌛️ Exiting Grafana...");
        setTimeout(() => {
          grafanaChild.kill("SIGTERM");
        }, 750);
      }

      if (metricsExporter) {
        console.log("⌛️ Stopping metrics exporter...");
        metricsExporter.stop();
      }
    }

    // Initial check in case all children are already not running
    checkExit();

    // Periodically check if all child processes have exited
    const intervalId = setInterval(() => {
      checkExit();
      // Clear interval if all processes have exited
      const metricsProcessesExited = !enableMetrics || (prometheusExited && grafanaExited);
      if (executionExited && consensusExited && metricsProcessesExited) {
        clearInterval(intervalId);
      }
    }, 1000);
  } catch (error) {
    console.log("Error from handleExit()", error);
  }
}

// Modify existing listeners
process.on("SIGINT", () => handleExit("SIGINT"));
process.on("SIGTERM", () => handleExit("SIGTERM"));
process.on("SIGHUP", () => handleExit("SIGHUP"));
process.on("SIGUSR2", () => handleExit("SIGUSR2"));

// Modify the exit listener
process.on("exit", (code) => {
  if (!isExiting) {
    handleExit("exit");
  }
});

// This helps catch uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  handleExit("uncaughtException");
});

// This helps catch unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  handleExit("unhandledRejection");
});

let bgConsensusPeers = [];
let bgConsensusAddrs;

async function startClient(clientName, executionType, installDir) {
  let clientCommand,
    clientArgs = [];

  if (clientName === "geth") {
    clientArgs.push("--executionpeerport", executionPeerPort);
    clientArgs.push("--executiontype", executionType);
    clientCommand = path.join(__dirname, "ethereum_client_scripts/geth.js");
  } else if (clientName === "reth") {
    clientArgs.push("--executionpeerport", executionPeerPort);
    clientArgs.push("--executiontype", executionType);
    clientCommand = path.join(__dirname, "ethereum_client_scripts/reth.js");
  } else if (clientName === "prysm") {
    bgConsensusPeers = await fetchBGConsensusPeers();
    bgConsensusAddrs = await configureBGConsensusPeers(consensusClient);

    if (bgConsensusPeers.length > 0) {
      clientArgs.push("--bgconsensuspeers", bgConsensusPeers);
    }

    if (bgConsensusAddrs != null) {
      clientArgs.push("--bgconsensusaddrs", bgConsensusAddrs);
    }

    if (consensusCheckpoint != null) {
      clientArgs.push("--consensuscheckpoint", consensusCheckpoint);
    }

    clientArgs.push("--consensuspeerports", consensusPeerPorts);

    clientCommand = path.join(__dirname, "ethereum_client_scripts/prysm.js");
  } else if (clientName === "lighthouse") {
    bgConsensusPeers = await fetchBGConsensusPeers();
    bgConsensusAddrs = await configureBGConsensusPeers(consensusClient);

    if (bgConsensusPeers.length > 0) {
      clientArgs.push("--bgconsensuspeers", bgConsensusPeers);
    }

    if (bgConsensusAddrs != null) {
      clientArgs.push("--bgconsensusaddrs", bgConsensusAddrs);
    }

    if (consensusCheckpoint != null) {
      clientArgs.push("--consensuscheckpoint", consensusCheckpoint);
    }
    clientArgs.push("--consensuspeerports", consensusPeerPorts);

    clientCommand = path.join(
      __dirname,
      "ethereum_client_scripts/lighthouse.js"
    );
  } else if (clientName === "prometheus") {
    clientArgs.push("--prometheusport", prometheusPort);
    clientCommand = path.join(__dirname, "ethereum_client_scripts/prometheus.js");
  } else if (clientName === "grafana") {
    clientArgs.push("--grafanaport", grafanaPort);
    clientCommand = path.join(__dirname, "ethereum_client_scripts/grafana.js");
  } else {
    clientCommand = path.join(
      installDir,
      "ethereum_clients",
      clientName,
      clientName
    );
  }

  clientArgs.push("--directory", installDir);

  const child = spawn("node", [clientCommand, ...clientArgs], {
    stdio: ["inherit", "pipe", "inherit"],
    cwd: process.env.HOME,
    env: { ...process.env, INSTALL_DIR: installDir },
  });

  if (clientName === "geth" || clientName === "reth") {
    executionChild = child;
  } else if (clientName === "prysm" || clientName === "lighthouse") {
    consensusChild = child;
  } else if (clientName === "prometheus") {
    prometheusChild = child;
  } else if (clientName === "grafana") {
    grafanaChild = child;
  }

  child.on("exit", (code) => {
    console.log(`🫡 ${clientName} process exited with code ${code}`);
    if (clientName === "geth" || clientName === "reth") {
      executionExited = true;
    } else if (clientName === "prysm" || clientName === "lighthouse") {
      consensusExited = true;
    } else if (clientName === "prometheus") {
      prometheusExited = true;
    } else if (clientName === "grafana") {
      grafanaExited = true;
    }
  });

  child.on("error", (err) => {
    console.log(`Error from start client: ${err.message}`);
  });

  console.log(clientName, "started");

  child.stdout.on("error", (err) => {
    console.error(`Error on stdout of ${clientName}: ${err.message}`);
  });
}

function isAlreadyRunning() {
  try {
    if (fs.existsSync(lockFilePath)) {
      const pid = fs.readFileSync(lockFilePath, "utf8");
      try {
        process.kill(pid, 0);
        return true;
      } catch (e) {
        if (e.code === "ESRCH") {
          fs.unlinkSync(lockFilePath);
          return false;
        }
        throw e;
      }
    }
    return false;
  } catch (err) {
    console.error("Error checking for existing process:", err);
    return false;
  }
}

function createLockFile() {
  fs.writeFileSync(lockFilePath, process.pid.toString(), "utf8");
  // console.log(process.pid.toString())
}

function removeLockFile() {
  if (fs.existsSync(lockFilePath)) {
    fs.unlinkSync(lockFilePath);
  }
}

const jwtDir = path.join(installDir, "ethereum_clients", "jwt");
const platform = os.platform();

if (["darwin", "linux"].includes(platform)) {
  installMacLinuxClient(executionClient, platform);
  installMacLinuxClient(consensusClient, platform);
  
  if (enableMetrics) {
    installPrometheus(platform);
    installGrafana(platform);
  }
}
// } else if (platform === "win32") {
//   installWindowsExecutionClient(executionClient);
//   installWindowsConsensusClient(consensusClient);
// }

let messageForHeader = "";
let runsClient = false;

createJwtSecret(jwtDir);

const executionClientVer = getVersionNumber(executionClient);
const consensusClientVer = getVersionNumber(consensusClient);

const wsConfig = {
  executionClient: executionClient,
  consensusClient: consensusClient,
  executionClientVer: executionClientVer,
  consensusClientVer: consensusClientVer,
};

if (!isAlreadyRunning()) {
  deleteOptionsFile();
  createLockFile();

  await startClient(executionClient, executionType, installDir);
  await startClient(consensusClient, executionType, installDir);

  if (enableMetrics) {
    // Start metrics exporter
    metricsExporter = new MetricsExporter(9100);
    metricsExporter.start();
    
    // Generate Prometheus config
    generatePrometheusConfig();
    
    // Generate Grafana provisioning
    generateGrafanaProvisioning();
    
    // Start Prometheus and Grafana
    await startClient("prometheus", executionType, installDir);
    await startClient("grafana", executionType, installDir);
    
    console.log("\n📊 Metrics enabled:");
    console.log(`   Prometheus: http://localhost:${prometheusPort}`);
    console.log(`   Grafana: http://localhost:${grafanaPort} (admin/admin)`);
    console.log(`   Custom metrics: http://localhost:9100/metrics\n`);
  }

  if (owner !== null) {
    initializeWebSocketConnection(wsConfig);
  }

  runsClient = true;
  saveOptionsToFile();
} else {
  messageForHeader = "Dashboard View (client already running)";
  runsClient = false;
  // Initialize WebSocket connection for secondary instances too
  if (owner !== null) {
    initializeWebSocketConnection(wsConfig);
  }
}

initializeMonitoring(
  messageForHeader,
  executionClient,
  consensusClient,
  executionClientVer,
  consensusClientVer,
  runsClient
);

let bgExecutionPeers = [];

setTimeout(async () => {
  bgExecutionPeers = await fetchBGExecutionPeers();
  await configureBGExecutionPeers(bgExecutionPeers);
}, 10000);

export { bgExecutionPeers, bgConsensusPeers };
