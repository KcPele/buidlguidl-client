import fs from "fs";
import path from "path";
import { installDir, executionClient, consensusClient } from "./commandLineOptions.js";
import { debugToFile } from "./helpers.js";

export function generatePrometheusConfig() {
  const prometheusDir = path.join(installDir, "ethereum_clients", "prometheus");
  const configPath = path.join(prometheusDir, "prometheus.yml");

  // Ensure prometheus directory exists
  if (!fs.existsSync(prometheusDir)) {
    fs.mkdirSync(prometheusDir, { recursive: true });
  }

  // Define scrape configs based on active clients
  const scrapeConfigs = [
    {
      job_name: "buidlguidl_exporter",
      static_configs: [{ targets: ["localhost:9100"] }],
      scrape_interval: "5s",
    },
  ];

  // Add execution client metrics
  if (executionClient === "geth") {
    scrapeConfigs.push({
      job_name: "geth",
      static_configs: [{ targets: ["localhost:6060"] }],
      scrape_interval: "15s",
    });
  } else if (executionClient === "reth") {
    scrapeConfigs.push({
      job_name: "reth",
      static_configs: [{ targets: ["localhost:9001"] }],
      scrape_interval: "15s",
    });
  }

  // Add consensus client metrics
  if (consensusClient === "lighthouse" || consensusClient === "prysm") {
    scrapeConfigs.push({
      job_name: consensusClient,
      static_configs: [{ targets: ["localhost:5054"] }],
      scrape_interval: "15s",
    });
  }

  // Generate the complete prometheus config
  const config = {
    global: {
      scrape_interval: "15s",
      evaluation_interval: "15s",
    },
    scrape_configs: scrapeConfigs,
  };

  // Convert to YAML format
  const yamlConfig = `# Prometheus configuration for BuidlGuidl Ethereum Node
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
${scrapeConfigs
  .map(
    (job) => `  - job_name: '${job.job_name}'
    scrape_interval: ${job.scrape_interval || "15s"}
    static_configs:
      - targets: ${JSON.stringify(job.static_configs[0].targets)}`
  )
  .join("\n\n")}
`;

  // Write the config file
  fs.writeFileSync(configPath, yamlConfig);
  debugToFile(`Generated Prometheus config at ${configPath}`);

  return configPath;
}