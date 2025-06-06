import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";
import { installDir } from "../commandLineOptions.js";
import { debugToFile } from "./../helpers.js";

export const latestGethVer = "1.15.11";
export const latestRethVer = "1.4.3";
export const latestLighthouseVer = "7.0.1";
export const latestPrometheusVer = "3.4.1";
export const latestGrafanaVer = "12.0.1";

export function installMacLinuxClient(clientName, platform) {
  const arch = os.arch();

  const gethHash = {
    "1.14.3": "ab48ba42",
    "1.14.12": "293a300d",
    "1.15.10": "2bf8a789",
    "1.15.11": "36b2371c",
  };

  const configs = {
    darwin: {
      x64: {
        geth: `geth-darwin-amd64-${latestGethVer}-${gethHash[latestGethVer]}`,
        reth: `reth-v${latestRethVer}-x86_64-apple-darwin`,
        lighthouse: `lighthouse-v${latestLighthouseVer}-x86_64-apple-darwin`,
        prysm: "prysm.sh",
      },
      arm64: {
        geth: `geth-darwin-arm64-${latestGethVer}-${gethHash[latestGethVer]}`,
        reth: `reth-v${latestRethVer}-aarch64-apple-darwin`,
        lighthouse: `lighthouse-v${latestLighthouseVer}-x86_64-apple-darwin`,
        prysm: "prysm.sh",
      },
    },
    linux: {
      x64: {
        geth: `geth-linux-amd64-${latestGethVer}-${gethHash[latestGethVer]}`,
        reth: `reth-v${latestRethVer}-x86_64-unknown-linux-gnu`,
        lighthouse: `lighthouse-v${latestLighthouseVer}-x86_64-unknown-linux-gnu`,
        prysm: "prysm.sh",
      },
      arm64: {
        geth: `geth-linux-arm64-${latestGethVer}-${gethHash[latestGethVer]}`,
        reth: `reth-v${latestRethVer}-aarch64-unknown-linux-gnu`,
        lighthouse: `lighthouse-v${latestLighthouseVer}-aarch64-unknown-linux-gnu`,
        prysm: "prysm.sh",
      },
    },
  };

  const fileName = configs[platform][arch][clientName];
  const clientDir = path.join(installDir, "ethereum_clients", clientName);
  const clientScript = path.join(
    clientDir,
    clientName === "prysm" ? "prysm.sh" : clientName
  );

  if (!fs.existsSync(clientScript)) {
    console.log(`\nInstalling ${clientName}.`);
    if (!fs.existsSync(clientDir)) {
      console.log(`Creating '${clientDir}'`);
      fs.mkdirSync(`${clientDir}/database`, { recursive: true });
      fs.mkdirSync(`${clientDir}/logs`, { recursive: true });
    }

    const downloadUrls = {
      geth: `https://gethstore.blob.core.windows.net/builds/${fileName}.tar.gz`,
      reth: `https://github.com/paradigmxyz/reth/releases/download/v${latestRethVer}/${fileName}.tar.gz`,
      lighthouse: `https://github.com/sigp/lighthouse/releases/download/v${latestLighthouseVer}/${fileName}.tar.gz`,
      prysm:
        "https://raw.githubusercontent.com/prysmaticlabs/prysm/master/prysm.sh",
    };

    if (clientName === "prysm") {
      console.log("Downloading Prysm.");
      execSync(
        `cd "${clientDir}" && curl -L -O -# ${downloadUrls.prysm} && chmod +x prysm.sh`,
        { stdio: "inherit" }
      );
    } else {
      console.log(`Downloading ${clientName}.`);
      execSync(
        `cd "${clientDir}" && curl -L -O -# ${downloadUrls[clientName]}`,
        { stdio: "inherit" }
      );
      console.log(`Uncompressing ${clientName}.`);
      execSync(`cd "${clientDir}" && tar -xzvf "${fileName}.tar.gz"`, {
        stdio: "inherit",
      });

      if (clientName === "geth") {
        execSync(`cd "${clientDir}/${fileName}" && mv geth ..`, {
          stdio: "inherit",
        });
        execSync(`cd "${clientDir}" && rm -r "${fileName}"`, {
          stdio: "inherit",
        });
      }

      console.log(`Cleaning up ${clientName} directory.`);
      execSync(`cd "${clientDir}" && rm "${fileName}.tar.gz"`, {
        stdio: "inherit",
      });
    }
  } else {
    console.log(`${clientName} is already installed.`);
  }
}

export function getVersionNumber(client) {
  const platform = os.platform();
  let clientCommand;
  let argument;
  let versionOutput;
  let versionMatch;

  if (client === "reth" || client === "lighthouse" || client === "geth") {
    argument = "--version";
  } else if (client === "prysm") {
    argument = "beacon-chain --version";
  }

  if (["darwin", "linux"].includes(platform)) {
    clientCommand = path.join(
      installDir,
      "ethereum_clients",
      `${client}`,
      client === "prysm" ? `${client}.sh` : `${client}`
    );
  } else if (platform === "win32") {
    console.log("getVersionNumber() for windows is yet not implemented");
    process.exit(1);
  }

  try {
    const versionCommand = execSync(
      `${clientCommand} ${argument} 2>/dev/null`,
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }
    );
    versionOutput = versionCommand.trim();

    if (client === "reth") {
      versionMatch = versionOutput.match(
        /reth(?:-ethereum-cli)? Version: (\d+\.\d+\.\d+)/
      );
    } else if (client === "lighthouse") {
      versionMatch = versionOutput.match(/Lighthouse v(\d+\.\d+\.\d+)/);
    } else if (client === "geth") {
      versionMatch = versionOutput.match(/geth version (\d+\.\d+\.\d+)/);
    } else if (client === "prysm") {
      versionMatch = versionOutput.match(/beacon-chain-v(\d+\.\d+\.\d+)-/);
    }

    const parsedVersion = versionMatch ? versionMatch[1] : null;

    if (parsedVersion) {
      return parsedVersion;
    } else {
      debugToFile(`Unable to parse version number for ${client}`);
      return null;
    }
  } catch (error) {
    debugToFile(`Error getting version for ${client}:`, error.message);
    return null;
  }
}

export function compareClientVersions(client, installedVersion) {
  let isLatest = true;
  let latestVersion;

  if (client === "reth") {
    latestVersion = latestRethVer;
  } else if (client === "geth") {
    latestVersion = latestGethVer;
  } else if (client === "lighthouse") {
    latestVersion = latestLighthouseVer;
  }
  if (compareVersions(installedVersion, latestVersion) < 0) {
    isLatest = false;
  }
  return [isLatest, latestVersion];
}

export function removeClient(client) {
  const clientDir = path.join(installDir, "ethereum_clients", client, client);
  if (fs.existsSync(clientDir)) {
    fs.rmSync(clientDir, { recursive: true });
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}

export function installPrometheus(platform) {
  const arch = os.arch();
  
  const prometheusConfigs = {
    darwin: {
      x64: `prometheus-${latestPrometheusVer}.darwin-amd64`,
      arm64: `prometheus-${latestPrometheusVer}.darwin-arm64`,
    },
    linux: {
      x64: `prometheus-${latestPrometheusVer}.linux-amd64`,
      arm64: `prometheus-${latestPrometheusVer}.linux-arm64`,
    },
  };
  
  const fileName = prometheusConfigs[platform][arch];
  const prometheusDir = path.join(installDir, "ethereum_clients", "prometheus");
  const prometheusBinary = path.join(prometheusDir, "prometheus");
  
  if (!fs.existsSync(prometheusBinary)) {
    console.log("\nInstalling Prometheus.");
    
    // Clean up any existing prometheus files first
    if (fs.existsSync(prometheusDir)) {
      execSync(`rm -rf "${prometheusDir}"`, { stdio: "inherit" });
    }
    
    // Create fresh prometheus directory
    console.log(`Creating '${prometheusDir}'`);
    fs.mkdirSync(`${prometheusDir}/data`, { recursive: true });
    fs.mkdirSync(`${prometheusDir}/logs`, { recursive: true });
    
    const downloadUrl = `https://github.com/prometheus/prometheus/releases/download/v${latestPrometheusVer}/${fileName}.tar.gz`;
    
    console.log("Downloading Prometheus.");
    execSync(
      `cd "${prometheusDir}" && curl -L -O -# ${downloadUrl}`,
      { stdio: "inherit" }
    );
    console.log("Uncompressing Prometheus.");
    execSync(`cd "${prometheusDir}" && tar -xzvf "${fileName}.tar.gz"`, {
      stdio: "inherit",
    });
    
    // Check what was extracted and move files appropriately
    const extractedDir = path.join(prometheusDir, fileName);
    
    if (fs.existsSync(extractedDir)) {
      console.log(`Moving files from ${fileName} to prometheus directory`);
      
      // Move all files from extracted directory to prometheus root
      execSync(`cd "${extractedDir}" && find . -maxdepth 1 -type f -exec mv {} .. \\;`, {
        stdio: "inherit",
      });
      
      // Move directories if they exist
      const dirsToMove = ["console_libraries", "consoles"];
      for (const dir of dirsToMove) {
        if (fs.existsSync(path.join(extractedDir, dir))) {
          execSync(`cd "${extractedDir}" && mv ${dir} ..`, {
            stdio: "inherit",
          });
        }
      }
      
      // Clean up extracted directory and archive
      execSync(`cd "${prometheusDir}" && rm -rf "${fileName}" "${fileName}.tar.gz"`, {
        stdio: "inherit",
      });
    } else {
      console.log("Warning: Extracted directory not found, checking for binaries in root");
    }
    
    // Verify installation
    if (fs.existsSync(prometheusBinary)) {
      console.log("Prometheus installation completed successfully.");
    } else {
      throw new Error("Prometheus binary not found after installation");
    }
  } else {
    console.log("Prometheus is already installed.");
  }
}

export function installGrafana(platform) {
  const arch = os.arch();
  
  const grafanaConfigs = {
    darwin: {
      x64: `grafana-${latestGrafanaVer}.darwin-amd64`,
      arm64: `grafana-${latestGrafanaVer}.darwin-arm64`,
    },
    linux: {
      x64: `grafana-${latestGrafanaVer}.linux-amd64`,
      arm64: `grafana-${latestGrafanaVer}.linux-arm64`,
    },
  };
  
  const fileName = grafanaConfigs[platform][arch];
  const grafanaDir = path.join(installDir, "ethereum_clients", "grafana");
  const grafanaBinary = path.join(grafanaDir, "bin", "grafana-server");
  
  if (!fs.existsSync(grafanaBinary)) {
    console.log("\nInstalling Grafana.");
    
    // Remove any existing grafana files/directories first
    const ethClientsDir = path.join(installDir, "ethereum_clients");
    execSync(`cd "${ethClientsDir}" && rm -rf grafana grafana-*`, {
      stdio: "inherit",
    });
    
    const downloadUrl = `https://dl.grafana.com/oss/release/${fileName}.tar.gz`;
    
    console.log("Downloading Grafana.");
    execSync(
      `cd "${ethClientsDir}" && curl -L -O -# ${downloadUrl}`,
      { stdio: "inherit" }
    );
    console.log("Uncompressing Grafana.");
    execSync(`cd "${ethClientsDir}" && tar -xzvf "${fileName}.tar.gz"`, {
      stdio: "inherit",
    });
    
    // Find the extracted directory (Grafana extracts with different naming)
    const extractedDirs = fs.readdirSync(ethClientsDir)
      .filter(name => name.startsWith('grafana-') && fs.statSync(path.join(ethClientsDir, name)).isDirectory());
    
    if (extractedDirs.length > 0) {
      const extractedDir = extractedDirs[0];
      console.log(`Moving ${extractedDir} to grafana`);
      
      // Move extracted directory to grafana  
      execSync(`cd "${ethClientsDir}" && mv "${extractedDir}" grafana`, {
        stdio: "inherit",
      });
      
      // Create required directories after moving
      fs.mkdirSync(path.join(grafanaDir, "data"), { recursive: true });
      fs.mkdirSync(path.join(grafanaDir, "logs"), { recursive: true });
      
      console.log("Grafana installation completed.");
    } else {
      throw new Error("Could not find extracted Grafana directory");
    }
    
    console.log("Cleaning up Grafana archive.");
    execSync(`cd "${ethClientsDir}" && rm -f "${fileName}.tar.gz"`, {
      stdio: "inherit",
    });
  } else {
    console.log("Grafana is already installed.");
  }
}
