# Kubernetes Deployment Guide

Operations runbook for deploying and maintaining the UML Assessment Platform on Kubernetes.

## Architecture Overview

The platform runs 2 services in Kubernetes. Database and auth are managed externally by **Supabase**.

| Component | Where | Scaling |
|-----------|-------|---------|
| **web** | K8s Deployment | 2-6 replicas (HPA on CPU > 70%) |
| **worker** | K8s Deployment | 1-3 replicas (manual) |
| **PostgreSQL** | Supabase (managed) | Managed by Supabase |
| **Auth** | Supabase (managed) | Managed by Supabase |
| **LLM** | OpenAI / Anthropic API | External SaaS |

```
                    ┌─────────────┐
                    │   Ingress   │
                    │  (Traefik)  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Web Service │
                    │  (ClusterIP) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼────┐ ┌────▼─────┐ ┌────▼─────┐
        │  web-0   │ │  web-1   │ │  web-N   │
        │ (Hono)   │ │ (Hono)   │ │ (Hono)   │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │             │            │
             └──────┬──────┘            │
                    │                   │
              ┌─────▼───────────┐  ┌───▼──────────┐
              │    Supabase     │  │    worker     │
              │ (PostgreSQL +   │◄─│  (Graphile)   │
              │     Auth)       │  └───────────────┘
              └─────────────────┘
                   (external)
```

**How it works**: The web server enqueues grading jobs into PostgreSQL (Supabase) via `quickAddJob()`. The worker polls the queue and processes them. Both use the same Docker image — only the startup command differs.

### Key Design Decisions

| Decision | Why | Tradeoff |
|----------|-----|----------|
| Managed Supabase for DB + auth | No DBA overhead, built-in backups/PITR, connection pooling via Supavisor | External dependency — requires internet from cluster to Supabase |
| Pooled connection (port 6543) for app | Transaction-mode pooling handles many pods efficiently within Supabase's connection limits | Cannot use prepared statements (already handled: `prepare: false`) |
| Direct connection (port 5432) for migrations | Drizzle migrator uses prepared statements which require a direct connection | Only used by the short-lived migration Job |
| No in-cluster PostgreSQL | Supabase handles backups, scaling, monitoring, and failover | Adds network latency vs in-cluster DB |
| No PgBouncer | Supabase provides Supavisor (their built-in connection pooler) | N/A — already handled |
| No Redis for rate limiting | Per-pod limits adequate for school network behind firewall | Auth rate limit becomes 5×N instead of 5 |
| No nginx for static files | Hono handles it fine at school scale | Add Ingress caching if perf becomes an issue |
| Worker replicas: 1 (default) | LLM throughput limited by API rate limits, not pod count | Scale to 2-3 if queue backs up |

---

## Prerequisites

- **Kubernetes cluster**: k3s recommended for on-premise (lightweight, ships with Traefik)
- **kubectl** configured with cluster access
- **Supabase project**: With database and auth configured
- **DNS**: `uml.school.edu` (or your domain) pointed to the cluster's Ingress IP
- **TLS**: cert-manager installed (optional but recommended), or manual TLS cert
- **Network**: Cluster nodes must have outbound internet access to reach Supabase, OpenAI/Anthropic APIs

---

## Initial Setup

### 1. Create the namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### 2. Configure secrets

**Never commit real secrets to git.** You need these values from Supabase Dashboard:

| Secret | Where to find it |
|--------|-----------------|
| `DATABASE_URL` | Settings → Database → Connection string → URI (Pooler, Transaction mode, port 6543) |
| `DIRECT_DATABASE_URL` | Settings → Database → Connection string → URI (Direct, port 5432) |
| `VITE_SUPABASE_ANON_KEY` | Settings → API → Project API keys → `anon` / `public` |
| `JWT_SECRET` | Generate with `openssl rand -base64 48` (this is your custom JWT secret, not Supabase's) |

Edit `k8s/secrets.yaml` with your values, then apply:

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
```

### 3. Run database migrations

```bash
# Update the image in migration-job.yaml to your actual image tag first
kubectl apply -f k8s/migration-job.yaml

# Wait for completion
kubectl wait --for=condition=complete job/db-migrate -n uml-assessment --timeout=120s

# Check logs if it fails
kubectl logs job/db-migrate -n uml-assessment
```

### 4. Deploy the application

```bash
# Update the image in web.yaml and worker.yaml to your actual image tag
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/worker.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/ingress.yaml
```

### 5. Verify deployment

```bash
# Check all pods are running
kubectl get pods -n uml-assessment

# Expected output:
# NAME                      READY   STATUS    RESTARTS   AGE
# web-xxxxx-yyyyy           1/1     Running   0          2m
# web-xxxxx-zzzzz           1/1     Running   0          2m
# worker-xxxxx-yyyyy        1/1     Running   0          2m

# Check the web service is accessible
kubectl port-forward svc/web 3000:80 -n uml-assessment
# Visit http://localhost:3000 in your browser
```

---

## Common Operations

### Scaling for exam periods

```bash
# Pre-scale before a known exam window (e.g., 4 web pods)
kubectl scale deployment web --replicas=4 -n uml-assessment

# The HPA will maintain at least 4 and scale up further if CPU > 70%

# After the exam, scale back down
kubectl scale deployment web --replicas=2 -n uml-assessment

# If the grading queue is backing up, add worker replicas
kubectl scale deployment worker --replicas=2 -n uml-assessment

# After grading completes, scale back
kubectl scale deployment worker --replicas=1 -n uml-assessment
```

### Checking grading queue status

```bash
# Option 1: Via the API
kubectl exec deployment/web -n uml-assessment -- \
  wget -qO- http://localhost:3000/api/auto-grade/queue

# Option 2: Direct DB query (requires psql and direct connection)
# Check Supabase Dashboard → SQL Editor for pending jobs:
# SELECT task_identifier, count(*) FROM graphile_worker.jobs GROUP BY task_identifier;
```

### Viewing logs

```bash
# Web server logs
kubectl logs deployment/web -n uml-assessment --tail=100 -f

# Worker logs (see grading progress)
kubectl logs deployment/worker -n uml-assessment --tail=100 -f
```

### Restarting services

```bash
# Rolling restart (zero-downtime for web)
kubectl rollout restart deployment/web -n uml-assessment
kubectl rollout restart deployment/worker -n uml-assessment

# Check rollout status
kubectl rollout status deployment/web -n uml-assessment
```

---

## Backups

Supabase handles database backups automatically:

- **Daily backups**: Enabled by default on all Supabase plans
- **Point-in-time recovery (PITR)**: Available on Pro plan and above
- **Manual backup**: Use Supabase Dashboard → Database → Backups

For additional safety before exams, you can take a manual snapshot via the Supabase dashboard.

---

## Troubleshooting

### Pod won't start (CrashLoopBackOff)

```bash
# Check pod logs for the error
kubectl logs <pod-name> -n uml-assessment --previous

# Common causes:
# - Missing/invalid env vars → check secrets.yaml values
# - Supabase unreachable → check network/firewall rules from cluster
# - Migration not run → run the migration job first
```

### Web pods are "Not Ready"

The readiness probe (`/api/health/ready`) checks database connectivity. If pods show `0/1 Ready`:

```bash
# Check if Supabase is reachable from the cluster
kubectl exec deployment/web -n uml-assessment -- \
  wget -qO- http://localhost:3000/api/health/ready

# Common causes:
# - Supabase connection string wrong → verify DATABASE_URL in secrets
# - Supabase project paused (free tier) → unpause in dashboard
# - Firewall blocking outbound from cluster → check network policies
```

### Grading jobs stuck

```bash
# Check worker logs for errors
kubectl logs deployment/worker -n uml-assessment --tail=200

# Common causes:
# - OpenAI/Anthropic API key missing or expired
# - API rate limit hit → check LLM provider dashboard
# - Worker pod died mid-job → Graphile Worker auto-releases advisory locks after timeout

# Force restart the worker
kubectl rollout restart deployment/worker -n uml-assessment
```

### Connection limit errors

Supabase plans have connection limits. With the pooled connection (port 6543), each pod shares connections efficiently. But if you see `too many connections`:

```bash
# Check how many pods are running
kubectl get pods -n uml-assessment

# Each web pod opens ~10 pooled connections, each worker opens ~5
# Free tier: 60 direct connections (pooler handles multiplexing)
# Pro tier: 200 direct connections

# Scale down if needed
kubectl scale deployment web --replicas=2 -n uml-assessment
```

---

## Supabase Connection Details

| Connection Type | Port | Used By | `prepare` |
|----------------|------|---------|-----------|
| **Pooler (Transaction mode)** | 6543 | web pods, worker pods | `false` (required) |
| **Direct** | 5432 | migration Job only | `true` (default) |

The app and worker use the **pooled** connection (port 6543) because:
- Transaction-mode pooling efficiently shares a small number of real DB connections across many pods
- Already configured: `prepare: false` in `src/db/index.ts`, `noPreparedStatements: true` in Graphile Worker

The migration Job uses the **direct** connection (port 5432) because:
- Drizzle's migrator uses prepared statements internally
- Migrations are short-lived (single Job, runs once per deploy)

---

## Resource Budget

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|---------|------------|-----------|---------------|-------------|----------|
| web | 100m | 500m | 256Mi | 512Mi | 2 |
| worker | 100m | 250m | 256Mi | 512Mi | 1 |
| **Total** | **300m** | **1250m** | **768Mi** | **1536Mi** | |

Without an in-cluster database, the baseline footprint is much lighter — fits easily on a single 2-core, 4GB node. A second node provides redundancy via pod anti-affinity on web pods.

---

## Manifest Index

| File | Purpose |
|------|---------|
| `namespace.yaml` | Single `uml-assessment` namespace |
| `configmap.yaml` | Non-secret config (NODE_ENV, VITE_APP_URL, VITE_SUPABASE_URL) |
| `secrets.yaml` | Template for secrets (DATABASE_URL, JWT_SECRET, API keys) |
| `web.yaml` | Web Deployment (2 replicas) + ClusterIP Service |
| `worker.yaml` | Worker Deployment (1 replica, 120s termination grace) |
| `ingress.yaml` | TLS Ingress for external access |
| `hpa.yaml` | Auto-scale web 2→6 on CPU > 70% |
| `pdb.yaml` | Pod disruption budgets |
| `migration-job.yaml` | Pre-deployment DB migration Job (uses direct connection) |
