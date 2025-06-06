import fs from "fs";
import path from "path";
import { installDir, prometheusPort } from "./commandLineOptions.js";
import { debugToFile } from "./helpers.js";

export function generateGrafanaProvisioning() {
  const grafanaDir = path.join(installDir, "ethereum_clients", "grafana");
  const provisioningDir = path.join(grafanaDir, "conf", "provisioning");
  const datasourcesDir = path.join(provisioningDir, "datasources");
  const dashboardsDir = path.join(provisioningDir, "dashboards");

  // Ensure directories exist
  [datasourcesDir, dashboardsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create datasource provisioning file
  const datasourceConfig = `apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:${prometheusPort}
    isDefault: true
    editable: true
    jsonData:
      timeInterval: 15s
`;

  fs.writeFileSync(
    path.join(datasourcesDir, "prometheus.yaml"),
    datasourceConfig
  );

  // Create dashboard provisioning file
  const dashboardConfig = `apiVersion: 1

providers:
  - name: 'BuidlGuidl Ethereum Node'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: ${path.join(dashboardsDir, "json")}
`;

  fs.writeFileSync(
    path.join(dashboardsDir, "default.yaml"),
    dashboardConfig
  );

  // Create JSON dashboard directory
  const jsonDir = path.join(dashboardsDir, "json");
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  // Create default Ethereum node dashboard
  createDefaultDashboard(jsonDir);

  debugToFile(`Generated Grafana provisioning configuration`);
  return { datasourcesDir, dashboardsDir, jsonDir };
}

function createDefaultDashboard(jsonDir) {
  const dashboard = {
    "annotations": {
      "list": [
        {
          "builtIn": 1,
          "datasource": "-- Grafana --",
          "enable": true,
          "hide": true,
          "iconColor": "rgba(0, 211, 255, 1)",
          "name": "Annotations & Alerts",
          "type": "dashboard"
        }
      ]
    },
    "editable": true,
    "gnetId": null,
    "graphTooltip": 0,
    "id": null,
    "links": [],
    "panels": [
      {
        "datasource": "Prometheus",
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "drawStyle": "line",
              "fillOpacity": 10,
              "gradientMode": "none",
              "hideFrom": {
                "tooltip": false,
                "viz": false,
                "legend": false
              },
              "lineInterpolation": "linear",
              "lineWidth": 1,
              "pointSize": 5,
              "scaleDistribution": {
                "type": "linear"
              },
              "showPoints": "never",
              "spanNulls": true
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                },
                {
                  "color": "red",
                  "value": 80
                }
              ]
            },
            "unit": "percent"
          },
          "overrides": []
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 0
        },
        "id": 2,
        "options": {
          "tooltip": {
            "mode": "single"
          },
          "legend": {
            "calcs": [],
            "displayMode": "list",
            "placement": "bottom"
          }
        },
        "pluginVersion": "8.0.0",
        "targets": [
          {
            "expr": "buidlguidl_cpu_usage",
            "refId": "A",
            "legendFormat": "CPU Usage"
          },
          {
            "expr": "buidlguidl_memory_usage",
            "refId": "B",
            "legendFormat": "Memory Usage"
          },
          {
            "expr": "buidlguidl_disk_usage",
            "refId": "C",
            "legendFormat": "Disk Usage"
          }
        ],
        "title": "System Resources",
        "type": "timeseries"
      },
      {
        "datasource": "Prometheus",
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            },
            "unit": "none"
          },
          "overrides": []
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 0
        },
        "id": 3,
        "options": {
          "orientation": "auto",
          "reduceOptions": {
            "values": false,
            "calcs": [
              "lastNotNull"
            ],
            "fields": ""
          },
          "showThresholdLabels": false,
          "showThresholdMarkers": true,
          "text": {}
        },
        "pluginVersion": "8.0.0",
        "targets": [
          {
            "expr": "reth_network_connected_peers",
            "refId": "A",
            "legendFormat": "Execution Peers (Reth)"
          },
          {
            "expr": "buidlguidl_peer_count{client=\"execution\"}",
            "refId": "B",
            "legendFormat": "BuidlGuidl Execution Peers"
          },
          {
            "expr": "buidlguidl_peer_count{client=\"consensus\"}",
            "refId": "C",
            "legendFormat": "BuidlGuidl Consensus Peers"
          }
        ],
        "title": "Peer Count",
        "type": "gauge"
      },
      {
        "datasource": "Prometheus",
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "drawStyle": "line",
              "fillOpacity": 10,
              "gradientMode": "none",
              "hideFrom": {
                "tooltip": false,
                "viz": false,
                "legend": false
              },
              "lineInterpolation": "linear",
              "lineWidth": 1,
              "pointSize": 5,
              "scaleDistribution": {
                "type": "linear"
              },
              "showPoints": "never",
              "spanNulls": true
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            },
            "unit": "binBps"
          },
          "overrides": []
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        },
        "id": 4,
        "options": {
          "tooltip": {
            "mode": "single"
          },
          "legend": {
            "calcs": [],
            "displayMode": "list",
            "placement": "bottom"
          }
        },
        "pluginVersion": "8.0.0",
        "targets": [
          {
            "expr": "buidlguidl_bandwidth_download",
            "refId": "A",
            "legendFormat": "Download"
          },
          {
            "expr": "buidlguidl_bandwidth_upload",
            "refId": "B",
            "legendFormat": "Upload"
          }
        ],
        "title": "Network Bandwidth",
        "type": "timeseries"
      },
      {
        "datasource": "Prometheus",
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "mappings": [],
            "max": 100,
            "min": 0,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "red",
                  "value": null
                },
                {
                  "color": "yellow",
                  "value": 50
                },
                {
                  "color": "green",
                  "value": 90
                }
              ]
            },
            "unit": "percent"
          },
          "overrides": []
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        },
        "id": 5,
        "options": {
          "orientation": "auto",
          "reduceOptions": {
            "values": false,
            "calcs": [
              "lastNotNull"
            ],
            "fields": ""
          },
          "showThresholdLabels": false,
          "showThresholdMarkers": true,
          "text": {}
        },
        "pluginVersion": "8.0.0",
        "targets": [
          {
            "expr": "buidlguidl_sync_progress{client=\"execution\"}",
            "refId": "A",
            "legendFormat": "Execution Sync"
          },
          {
            "expr": "buidlguidl_sync_progress{client=\"consensus\"}",
            "refId": "B",
            "legendFormat": "Consensus Sync"
          }
        ],
        "title": "Sync Progress",
        "type": "gauge"
      },
      {
        "datasource": "Prometheus",
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "drawStyle": "line",
              "fillOpacity": 10,
              "gradientMode": "none",
              "hideFrom": {
                "tooltip": false,
                "viz": false,
                "legend": false
              },
              "lineInterpolation": "linear",
              "lineWidth": 1,
              "pointSize": 5,
              "scaleDistribution": {
                "type": "linear"
              },
              "showPoints": "never",
              "spanNulls": true
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green",
                  "value": null
                }
              ]
            },
            "unit": "none"
          },
          "overrides": []
        },
        "gridPos": {
          "h": 8,
          "w": 24,
          "x": 0,
          "y": 16
        },
        "id": 6,
        "options": {
          "tooltip": {
            "mode": "single"
          },
          "legend": {
            "calcs": [],
            "displayMode": "list",
            "placement": "bottom"
          }
        },
        "pluginVersion": "8.0.0",
        "targets": [
          {
            "expr": "reth_network_connected_peers",
            "refId": "A",
            "legendFormat": "Reth Connected Peers"
          },
          {
            "expr": "rate(reth_network_active_session_messages_sent_total[5m])",
            "refId": "B",
            "legendFormat": "Reth Messages Sent/sec"
          }
        ],
        "title": "Execution Client Activity",
        "type": "timeseries"
      }
    ],
    "refresh": "5s",
    "schemaVersion": 27,
    "style": "dark",
    "tags": ["ethereum", "node", "buidlguidl"],
    "templating": {
      "list": []
    },
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "timepicker": {},
    "timezone": "",
    "title": "BuidlGuidl Ethereum Node",
    "uid": "buidlguidl-ethereum-node",
    "version": 0
  };

  fs.writeFileSync(
    path.join(jsonDir, "buidlguidl-ethereum-node.json"),
    JSON.stringify(dashboard, null, 2)
  );
}