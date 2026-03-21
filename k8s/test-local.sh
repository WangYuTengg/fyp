#!/bin/bash
set -euo pipefail

# Local K8s testing script — creates a k3d cluster, builds the image,
# and deploys the full stack against your real Supabase instance.
#
# Prerequisites:
#   - docker, k3d, kubectl installed
#   - .env file with Supabase credentials in project root
#
# Usage:
#   ./k8s/test-local.sh          # Full setup: cluster + build + deploy
#   ./k8s/test-local.sh deploy   # Skip cluster creation, just rebuild + redeploy
#   ./k8s/test-local.sh teardown # Delete the cluster entirely
#
# After deploy, access the app:
#   http://localhost:8080

CLUSTER_NAME="uml-local"
IMAGE_NAME="uml-assessment:local"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; }

# --- Teardown ---
if [[ "${1:-}" == "teardown" ]]; then
  log "Deleting k3d cluster '$CLUSTER_NAME'..."
  k3d cluster delete "$CLUSTER_NAME" 2>/dev/null || true
  log "Done."
  exit 0
fi

# --- Load .env ---
if [[ ! -f "$ENV_FILE" ]]; then
  err ".env file not found at $ENV_FILE"
  err "Copy .env.example and fill in your Supabase credentials."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

# Validate required vars
for var in DATABASE_URL VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY JWT_SECRET; do
  if [[ -z "${!var:-}" ]]; then
    err "Missing required env var: $var (check your .env file)"
    exit 1
  fi
done


# --- Create cluster (skip if just redeploying) ---
if [[ "${1:-}" != "deploy" ]]; then
  if k3d cluster list 2>/dev/null | grep -q "$CLUSTER_NAME"; then
    warn "Cluster '$CLUSTER_NAME' already exists. Use 'teardown' to remove it first, or 'deploy' to redeploy."
    warn "Continuing with existing cluster..."
  else
    log "Creating k3d cluster '$CLUSTER_NAME'..."
    # Map port 8080 on host → port 80 on the k3s load balancer (Traefik)
    k3d cluster create "$CLUSTER_NAME" \
      --port "8080:80@loadbalancer" \
      --agents 1 \
      --wait
    log "Cluster created."
  fi
fi

# Point kubectl at the cluster
kubectl config use-context "k3d-$CLUSTER_NAME"

# --- Build Docker image ---
log "Building Docker image '$IMAGE_NAME'..."
docker build \
  --build-arg "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" \
  --build-arg "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" \
  --build-arg "VITE_API_URL=" \
  -t "$IMAGE_NAME" \
  "$PROJECT_DIR"

# Import image into k3d cluster (so pods can pull it without a registry)
log "Importing image into k3d cluster..."
k3d image import "$IMAGE_NAME" -c "$CLUSTER_NAME"

# --- Apply K8s manifests ---
log "Applying namespace..."
kubectl apply -f "$SCRIPT_DIR/namespace.yaml"

log "Creating secrets from .env..."
kubectl create secret generic app-secrets \
  --namespace=uml-assessment \
  --from-literal="DATABASE_URL=$DATABASE_URL" \
  --from-literal="JWT_SECRET=$JWT_SECRET" \
  --from-literal="VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" \
  --from-literal="OPENAI_API_KEY=${OPENAI_API_KEY:-}" \
  --from-literal="ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}" \
  --from-literal="SMTP_HOST=${SMTP_HOST:-}" \
  --from-literal="SMTP_PORT=${SMTP_PORT:-}" \
  --from-literal="SMTP_USER=${SMTP_USER:-}" \
  --from-literal="SMTP_PASS=${SMTP_PASS:-}" \
  --from-literal="SMTP_FROM=${SMTP_FROM:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

log "Creating configmap..."
kubectl create configmap app-config \
  --namespace=uml-assessment \
  --from-literal="NODE_ENV=production" \
  --from-literal="VITE_APP_URL=http://localhost:8080" \
  --from-literal="VITE_SUPABASE_URL=$VITE_SUPABASE_URL" \
  --dry-run=client -o yaml | kubectl apply -f -

# --- Run migrations ---
log "Running database migrations..."
kubectl delete job db-migrate -n uml-assessment --ignore-not-found

# Patch the migration job to use our local image
sed "s|ghcr.io/OWNER/uml-assessment:latest|$IMAGE_NAME|g" "$SCRIPT_DIR/migration-job.yaml" | \
  kubectl apply -f -

log "Waiting for migration job to complete (timeout: 120s)..."
if kubectl wait --for=condition=complete job/db-migrate -n uml-assessment --timeout=120s; then
  log "Migrations completed successfully."
else
  err "Migration failed! Check logs:"
  echo "  kubectl logs job/db-migrate -n uml-assessment"
  exit 1
fi

# --- Deploy web + worker ---
log "Deploying web and worker..."

# Patch image references to use local image
sed "s|ghcr.io/OWNER/uml-assessment:latest|$IMAGE_NAME|g" "$SCRIPT_DIR/web.yaml" | \
  kubectl apply -f -

sed "s|ghcr.io/OWNER/uml-assessment:latest|$IMAGE_NAME|g" "$SCRIPT_DIR/worker.yaml" | \
  kubectl apply -f -

# Apply remaining resources (skip HPA — metrics-server may not be available in k3d)
kubectl apply -f "$SCRIPT_DIR/pdb.yaml"

# Create a simple Ingress for local testing (no TLS)
kubectl apply -f - <<'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  namespace: uml-assessment
spec:
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
EOF

# --- Wait for rollout ---
log "Waiting for web deployment..."
kubectl rollout status deployment/web -n uml-assessment --timeout=120s

log "Waiting for worker deployment..."
kubectl rollout status deployment/worker -n uml-assessment --timeout=120s

# --- Summary ---
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  App:     http://localhost:8080"
echo "  Pods:    kubectl get pods -n uml-assessment"
echo "  Logs:    kubectl logs deployment/web -n uml-assessment -f"
echo "  Worker:  kubectl logs deployment/worker -n uml-assessment -f"
echo "  k9s:     k9s -n uml-assessment"
echo ""
echo "  Teardown: ./k8s/test-local.sh teardown"
echo ""
