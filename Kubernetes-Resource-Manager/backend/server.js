import express from "express";
import cors from "cors";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const app = express();
const port = Number(process.env.PORT || 5000);
const execFileAsync = promisify(execFile);

app.use(cors());
app.use(express.json());

async function kubectl(args) {
  try {
    const { stdout } = await execFileAsync("kubectl", args, {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout.trim();
  } catch (error) {
    const message = error.stderr?.trim() || error.message || "kubectl command failed";
    const result = new Error(message);
    result.status = 400;
    throw result;
  }
}

async function kubectlJson(args) {
  const output = await kubectl([...args, "-o", "json"]);
  return JSON.parse(output || "{}");
}

const route = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

app.get("/api/health", route(async (_req, res) => {
  const context = await kubectl(["config", "current-context"]);
  res.json({ success: true, message: "KubeManager backend connected", kubernetesContext: context });
}));

app.get("/api/namespaces", route(async (_req, res) => {
  const data = await kubectlJson(["get", "namespaces"]);
  res.json(data.items || []);
}));

app.get("/api/quotas", route(async (_req, res) => {
  const data = await kubectlJson(["get", "resourcequota", "-A"]);
  res.json(data.items || []);
}));

app.get("/api/limitranges", route(async (_req, res) => {
  const data = await kubectlJson(["get", "limitrange", "-A"]);
  res.json(data.items || []);
}));

app.get("/api/pods", route(async (req, res) => {
  const args = ["get", "pods"];
  if (req.query.namespace) args.push("-n", String(req.query.namespace));
  else args.push("-A");
  const data = await kubectlJson(args);
  res.json(data.items || []);
}));

app.get("/api/overview", route(async (_req, res) => {
  const [namespaces, quotas, limitRanges, pods] = await Promise.all([
    kubectlJson(["get", "namespaces"]),
    kubectlJson(["get", "resourcequota", "-A"]),
    kubectlJson(["get", "limitrange", "-A"]),
    kubectlJson(["get", "pods", "-A"])
  ]);
  res.json({
    namespaces: namespaces.items || [],
    quotas: quotas.items || [],
    limitRanges: limitRanges.items || [],
    pods: pods.items || []
  });
}));

app.post("/api/pods", route(async (req, res) => {
  const { name, namespace, image, cpuRequest, memoryRequest, cpuLimit, memoryLimit } = req.body || {};
  const safe = (value) => typeof value === "string" && value.trim() && !/[^\w.:-]/.test(value);
  if (!safe(name) || !safe(namespace) || !safe(image)) {
    return res.status(400).json({ success: false, message: "Pod name, namespace, and image are required and must be valid." });
  }
  const resources = {};
  if (cpuRequest || memoryRequest) resources.requests = {};
  if (cpuLimit || memoryLimit) resources.limits = {};
  if (cpuRequest) resources.requests.cpu = cpuRequest;
  if (memoryRequest) resources.requests.memory = memoryRequest;
  if (cpuLimit) resources.limits.cpu = cpuLimit;
  if (memoryLimit) resources.limits.memory = memoryLimit;

  const manifest = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace },
    spec: {
      containers: [{
        name: "app",
        image,
        ...(Object.keys(resources).length ? { resources } : {})
      }]
    }
  };

  // Send the manifest to kubectl through stdin.
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn("kubectl", ["create", "-f", "-", "-o", "json"], { windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk; });
      child.stderr.on("data", chunk => { stderr += chunk; });
      child.on("error", reject);
      child.on("close", code => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(stderr.trim() || `kubectl exited with code ${code}`));
      });
      child.stdin.end(JSON.stringify(manifest));
    });
    res.status(201).json({ success: true, message: "Pod created", pod: JSON.parse(result.stdout || "{}") });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Pod creation failed" });
  }
}));

app.delete("/api/pods/:namespace/:name", route(async (req, res) => {
  const { namespace, name } = req.params;
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(namespace) ||
      !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
    return res.status(400).json({ success: false, message: "Invalid namespace or pod name." });
  }
  await kubectl(["delete", "pod", name, "-n", namespace, "--wait=false"]);
  res.json({ success: true, message: `Pod ${name} deletion requested.` });
}));

app.use((error, _req, res, _next) => {
  res.status(error.status || 500).json({ success: false, message: error.message || "Internal server error" });
});

app.listen(port, () => console.log(`KubeManager backend running at http://localhost:${port}`));
