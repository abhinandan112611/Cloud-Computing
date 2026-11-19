# KubeManager – Kubernetes Resource Management Dashboard

**Cloud Computing Lab – Problem 06: Resource Quotas and Limit Ranges**

KubeManager is a React + Express dashboard for demonstrating Kubernetes namespace isolation, ResourceQuota enforcement, LimitRange defaults, and pod management.

> **Archive note:** This ZIP is a reconstructed runnable project based on the commands, configuration values, and screenshots shared in this conversation. The original local source files were not uploaded, so this is not a byte-for-byte archive of your existing folder. Review it and merge any additional code you already have before pushing to GitHub.

## Features
- Two isolated namespaces: `app-a` and `app-b`
- ResourceQuota for pod count, CPU requests/limits, and memory requests/limits
- LimitRange with default, minimum, and maximum container resources
- Deploy and delete pods from the web dashboard
- Live namespace, quota, LimitRange, and pod data from Kubernetes
- Dashboard charts for CPU and memory requests versus quota

## Technology
Docker Desktop Kubernetes · kubectl · YAML · Node.js · Express · React · Vite · Recharts

## Folder structure
```text
Kubernetes-Resource-Manager/
├── backend/
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── style.css
├── kubernetes/
│   ├── namespaces.yaml
│   ├── resource-quota.yaml
│   ├── limit-range.yaml
│   ├── pod-success.yaml
│   ├── pod-default.yaml
│   └── pod-rejected.yaml
├── screenshots/
└── .gitignore
```

## Prerequisites
1. Docker Desktop with Kubernetes enabled and running.
2. Node.js and npm.
3. kubectl configured for the Docker Desktop cluster.

Verify:
```powershell
docker --version
node --version
npm --version
kubectl version --client
kubectl config current-context
kubectl get nodes
```
The context used in the lab is `docker-desktop`; the node should be `Ready`.

## 1. Apply Kubernetes manifests
Run these commands from the project root:
```powershell
kubectl apply -f kubernetes/namespaces.yaml
kubectl apply -f kubernetes/resource-quota.yaml
kubectl apply -f kubernetes/limit-range.yaml
kubectl apply -f kubernetes/pod-success.yaml
kubectl apply -f kubernetes/pod-default.yaml
```

Verify:
```powershell
kubectl get namespaces
kubectl get resourcequota -A
kubectl get limitrange -A
kubectl get pods -n app-a
kubectl get pods -n app-b
```

### Demonstrate ResourceQuota rejection
`pod-rejected.yaml` requests 600m CPU in `app-a`. The successful `app-a-pod1` already requests 600m CPU, while the namespace request quota is 1 CPU. The second pod should be rejected because 600m + 600m exceeds 1000m:
```powershell
kubectl apply -f kubernetes/pod-rejected.yaml
```
Expected: Kubernetes returns a `Forbidden` / quota-exceeded error. The rejected pod should not appear in `kubectl get pods -n app-a`.

### Demonstrate LimitRange defaults
`pod-default.yaml` creates a pod in `app-b` without explicit resource requests and limits. Kubernetes applies the namespace's configured defaults. Inspect:
```powershell
kubectl describe pod default-pod -n app-b
```

## 2. Start the backend
Open PowerShell in the `backend` folder:
```powershell
npm install
npm run dev
```
Backend health endpoint: http://localhost:5000/api/health

Keep this terminal open. The backend uses `kubectl`, so Docker Desktop Kubernetes must remain running and the current Windows user must have access to the cluster.

## 3. Start the frontend
Open a second PowerShell in the `frontend` folder:
```powershell
npm install
npm run dev
```
Open http://localhost:5173

The Vite development server proxies `/api` requests to the backend on port 5000.

## API endpoints
- `GET /api/health`
- `GET /api/overview`
- `GET /api/namespaces`
- `GET /api/quotas`
- `GET /api/limitranges`
- `GET /api/pods`
- `POST /api/pods`
- `DELETE /api/pods/:namespace/:name`

## Resource settings configured for each namespace

| Resource | Quota |
|---|---:|
| Pods | 4 |
| CPU requests | 1 |
| Memory requests | 1Gi |
| CPU limits | 2 |
| Memory limits | 2Gi |

LimitRange values:
- Default request: 200m CPU / 256Mi memory
- Default limit: 500m CPU / 512Mi memory
- Minimum: 100m CPU / 128Mi memory
- Maximum: 1 CPU / 1Gi memory

## Useful verification commands
```powershell
kubectl get nodes
kubectl get namespaces
kubectl get resourcequota -A
kubectl describe quota app-a-quota -n app-a
kubectl describe quota app-b-quota -n app-b
kubectl get limitrange -A
kubectl describe limitrange app-a-limits -n app-a
kubectl get pods -A
```

## Cleanup
This deletes the lab namespaces and all resources inside them:
```powershell
kubectl delete namespace app-a app-b
```

## GitHub upload
From the project root:
```powershell
git init
git add .
git commit -m "Add Kubernetes resource quota manager project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
Replace the remote URL with your own GitHub repository URL. Never commit credentials or `.env` files.
