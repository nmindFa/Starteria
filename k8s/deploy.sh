#!/usr/bin/env bash
#
# Starteria Kubernetes Deployment Script
#
# Deploys the full Starteria stack to the Rackspace Spot Kubernetes cluster:
#   1. PostgreSQL (StatefulSet + Service)
#   2. Backend API (Deployment + Service)
#   3. Frontend (Deployment + Service)
#   4. Cloudflare Tunnel (ConfigMap + Deployment + Service)
#
# Prerequisites:
#   - kubectl configured with cluster access
#   - Docker images built and pushed to a container registry
#   - Cloudflare tunnel token created as a Kubernetes secret
#   - At least one worker node available in the cluster
#
# Usage:
#   ./deploy.sh                  # Deploy everything
#   ./deploy.sh --dry-run        # Show what would be applied without making changes
#   ./deploy.sh --status         # Show current deployment status only
#
# Building and pushing Docker images (run before deploying):
#
#   # Set your container registry (e.g., Docker Hub, GHCR, or private registry)
#   export REGISTRY=your-registry.example.com/starteria
#
#   # Build and push the backend image
#   docker build -t $REGISTRY/starteria-backend:latest -f Dockerfile.backend .
#   docker push $REGISTRY/starteria-backend:latest
#
#   # Build and push the frontend image
#   docker build -t $REGISTRY/starteria-frontend:latest -f Dockerfile.frontend .
#   docker push $REGISTRY/starteria-frontend:latest
#
#   # Then update the image references in:
#   #   k8s/backend-deployment.yaml  -> image: $REGISTRY/starteria-backend:latest
#   #   k8s/frontend-deployment.yaml -> image: $REGISTRY/starteria-frontend:latest
#
# Creating the Cloudflare tunnel secret (run before deploying):
#
#   kubectl create secret generic cloudflared-token \
#     -n starteria \
#     --from-literal=token=YOUR_CLOUDFLARE_TUNNEL_TOKEN
#
# Updating the Cloudflare tunnel ID:
#
#   Edit k8s/cloudflared-configmap.yaml and replace REPLACE_WITH_TUNNEL_ID
#   with your actual Cloudflare tunnel ID.
#

set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="starteria"
CLUSTER_SERVER="hcp-34be98c0-890e-47a9-b5e9-cb2466094274.spot.rackspace.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Helper functions ---

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

separator() {
    echo "============================================================"
}

# --- Preflight checks ---

check_kubectl() {
    log_info "Checking for kubectl..."

    # Check common locations
    if command -v kubectl &>/dev/null; then
        KUBECTL="kubectl"
    elif [ -x "$HOME/bin/kubectl" ]; then
        KUBECTL="$HOME/bin/kubectl"
    elif [ -x "/usr/local/bin/kubectl" ]; then
        KUBECTL="/usr/local/bin/kubectl"
    else
        log_error "kubectl not found. Install it or ensure ~/bin/kubectl exists."
        exit 1
    fi

    local version
    version=$($KUBECTL version --client --short 2>/dev/null || $KUBECTL version --client 2>/dev/null | head -1)
    log_success "kubectl found: $KUBECTL ($version)"
}

check_cluster_connectivity() {
    log_info "Checking cluster connectivity..."

    if ! $KUBECTL cluster-info &>/dev/null; then
        log_error "Cannot connect to the Kubernetes cluster."
        log_error "Expected cluster: $CLUSTER_SERVER"
        log_error ""
        log_error "Ensure your kubeconfig is set up correctly:"
        log_error "  export KUBECONFIG=~/.kube/config"
        log_error "  kubectl config current-context"
        exit 1
    fi

    local context
    context=$($KUBECTL config current-context 2>/dev/null || echo "unknown")
    log_success "Connected to cluster (context: $context)"
}

check_worker_nodes() {
    log_info "Checking for available worker nodes..."

    local node_count
    node_count=$($KUBECTL get nodes --no-headers 2>/dev/null | grep -c "Ready" || echo "0")

    if [ "$node_count" -eq 0 ]; then
        log_warn "No worker nodes with Ready status found in the cluster."
        log_warn "Pods will remain in Pending state until nodes are available."
        log_warn ""
        log_warn "To add nodes on Rackspace Spot:"
        log_warn "  1. Go to the Rackspace Spot console"
        log_warn "  2. Navigate to your cluster: $CLUSTER_SERVER"
        log_warn "  3. Add a node pool with at least 1 worker node"
        log_warn ""
        read -r -p "Continue deployment anyway? (y/N): " response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled."
            exit 0
        fi
    else
        log_success "Found $node_count Ready node(s)"
    fi
}

check_prerequisites() {
    log_info "Checking deployment prerequisites..."

    local warnings=0

    # Check if cloudflared-configmap still has placeholder
    if grep -q "REPLACE_WITH_TUNNEL_ID" "$SCRIPT_DIR/cloudflared-configmap.yaml" 2>/dev/null; then
        log_warn "cloudflared-configmap.yaml still contains REPLACE_WITH_TUNNEL_ID placeholder."
        log_warn "Edit this file and replace it with your actual Cloudflare tunnel ID."
        warnings=$((warnings + 1))
    fi

    # Check if Docker images use default names (not pushed to a registry)
    if grep -q "image: starteria-backend:latest" "$SCRIPT_DIR/backend-deployment.yaml" 2>/dev/null; then
        log_warn "backend-deployment.yaml uses local image name 'starteria-backend:latest'."
        log_warn "Update to a registry-qualified name (e.g., registry.example.com/starteria-backend:latest)."
        warnings=$((warnings + 1))
    fi

    if grep -q "image: starteria-frontend:latest" "$SCRIPT_DIR/frontend-deployment.yaml" 2>/dev/null; then
        log_warn "frontend-deployment.yaml uses local image name 'starteria-frontend:latest'."
        log_warn "Update to a registry-qualified name (e.g., registry.example.com/starteria-frontend:latest)."
        warnings=$((warnings + 1))
    fi

    # Check if the cloudflared secret exists in the cluster
    if $KUBECTL get secret cloudflared-token -n "$NAMESPACE" &>/dev/null; then
        log_success "Cloudflare tunnel secret exists in the cluster"
    else
        log_warn "Cloudflare tunnel secret 'cloudflared-token' not found in namespace '$NAMESPACE'."
        log_warn "Create it with:"
        log_warn "  kubectl create secret generic cloudflared-token -n $NAMESPACE --from-literal=token=YOUR_TOKEN"
        warnings=$((warnings + 1))
    fi

    if [ "$warnings" -gt 0 ]; then
        log_warn ""
        log_warn "$warnings warning(s) found. The deployment may not work correctly."
        read -r -p "Continue anyway? (y/N): " response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled. Fix the warnings above and re-run."
            exit 0
        fi
    else
        log_success "All prerequisites look good"
    fi
}

# --- Deployment functions ---

create_namespace() {
    log_info "Ensuring namespace '$NAMESPACE' exists..."

    if $KUBECTL get namespace "$NAMESPACE" &>/dev/null; then
        log_success "Namespace '$NAMESPACE' already exists"
    else
        if [ "${DRY_RUN:-false}" = "true" ]; then
            log_info "(dry-run) Would create namespace '$NAMESPACE'"
        else
            $KUBECTL create namespace "$NAMESPACE"
            log_success "Created namespace '$NAMESPACE'"
        fi
    fi
}

apply_manifest() {
    local file="$1"
    local description="$2"

    if [ ! -f "$file" ]; then
        log_error "Manifest not found: $file"
        return 1
    fi

    log_info "Applying $description..."

    if [ "${DRY_RUN:-false}" = "true" ]; then
        $KUBECTL apply -f "$file" --dry-run=client
    else
        $KUBECTL apply -f "$file"
    fi
}

deploy_postgres() {
    separator
    log_info "Step 1/4: Deploying PostgreSQL..."
    separator

    apply_manifest "$SCRIPT_DIR/postgres-service.yaml" "PostgreSQL Service"
    apply_manifest "$SCRIPT_DIR/postgres-statefulset.yaml" "PostgreSQL StatefulSet"

    if [ "${DRY_RUN:-false}" != "true" ]; then
        log_info "Waiting for PostgreSQL to be ready (timeout: 120s)..."
        if $KUBECTL rollout status statefulset/starteria-db -n "$NAMESPACE" --timeout=120s 2>/dev/null; then
            log_success "PostgreSQL is ready"
        else
            log_warn "PostgreSQL is not ready yet (may need worker nodes). Continuing..."
        fi
    fi
}

deploy_backend() {
    separator
    log_info "Step 2/4: Deploying Backend API..."
    separator

    apply_manifest "$SCRIPT_DIR/backend-service.yaml" "Backend Service"
    apply_manifest "$SCRIPT_DIR/backend-deployment.yaml" "Backend Deployment"

    if [ "${DRY_RUN:-false}" != "true" ]; then
        log_info "Waiting for Backend to be ready (timeout: 120s)..."
        if $KUBECTL rollout status deployment/starteria-backend -n "$NAMESPACE" --timeout=120s 2>/dev/null; then
            log_success "Backend is ready"
        else
            log_warn "Backend is not ready yet (may need worker nodes or PostgreSQL). Continuing..."
        fi
    fi
}

deploy_frontend() {
    separator
    log_info "Step 3/4: Deploying Frontend..."
    separator

    apply_manifest "$SCRIPT_DIR/frontend-service.yaml" "Frontend Service"
    apply_manifest "$SCRIPT_DIR/frontend-deployment.yaml" "Frontend Deployment"

    if [ "${DRY_RUN:-false}" != "true" ]; then
        log_info "Waiting for Frontend to be ready (timeout: 120s)..."
        if $KUBECTL rollout status deployment/starteria-frontend -n "$NAMESPACE" --timeout=120s 2>/dev/null; then
            log_success "Frontend is ready"
        else
            log_warn "Frontend is not ready yet (may need worker nodes). Continuing..."
        fi
    fi
}

deploy_cloudflared() {
    separator
    log_info "Step 4/4: Deploying Cloudflare Tunnel..."
    separator

    apply_manifest "$SCRIPT_DIR/cloudflared-configmap.yaml" "Cloudflare Tunnel ConfigMap"
    apply_manifest "$SCRIPT_DIR/cloudflared-service.yaml" "Cloudflare Tunnel Service"
    apply_manifest "$SCRIPT_DIR/cloudflared-deployment.yaml" "Cloudflare Tunnel Deployment"

    if [ "${DRY_RUN:-false}" != "true" ]; then
        log_info "Waiting for Cloudflare Tunnel to be ready (timeout: 120s)..."
        if $KUBECTL rollout status deployment/cloudflared-tunnel -n "$NAMESPACE" --timeout=120s 2>/dev/null; then
            log_success "Cloudflare Tunnel is ready"
        else
            log_warn "Cloudflare Tunnel is not ready yet. Continuing..."
        fi
    fi
}

show_status() {
    separator
    log_info "Deployment Status"
    separator

    echo ""
    log_info "Nodes:"
    $KUBECTL get nodes -o wide 2>/dev/null || log_warn "Could not retrieve node information"

    echo ""
    log_info "Pods in namespace '$NAMESPACE':"
    $KUBECTL get pods -n "$NAMESPACE" -o wide 2>/dev/null || log_warn "No pods found"

    echo ""
    log_info "Services in namespace '$NAMESPACE':"
    $KUBECTL get svc -n "$NAMESPACE" 2>/dev/null || log_warn "No services found"

    echo ""
    log_info "StatefulSets in namespace '$NAMESPACE':"
    $KUBECTL get statefulsets -n "$NAMESPACE" 2>/dev/null || log_warn "No statefulsets found"

    echo ""
    log_info "Deployments in namespace '$NAMESPACE':"
    $KUBECTL get deployments -n "$NAMESPACE" 2>/dev/null || log_warn "No deployments found"

    echo ""
    log_info "PersistentVolumeClaims in namespace '$NAMESPACE':"
    $KUBECTL get pvc -n "$NAMESPACE" 2>/dev/null || log_warn "No PVCs found"

    echo ""
    log_info "Secrets in namespace '$NAMESPACE':"
    $KUBECTL get secrets -n "$NAMESPACE" 2>/dev/null || log_warn "No secrets found"
}

# --- Main ---

main() {
    local mode="${1:-deploy}"

    echo ""
    separator
    echo "  Starteria Kubernetes Deployment"
    echo "  Cluster: $CLUSTER_SERVER"
    echo "  Namespace: $NAMESPACE"
    separator
    echo ""

    case "$mode" in
        --dry-run)
            DRY_RUN="true"
            log_info "Running in DRY-RUN mode (no changes will be made)"
            echo ""
            ;;
        --status)
            check_kubectl
            check_cluster_connectivity
            show_status
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run|--status|--help]"
            echo ""
            echo "Options:"
            echo "  (none)       Deploy all components"
            echo "  --dry-run    Show what would be applied without making changes"
            echo "  --status     Show current deployment status"
            echo "  --help       Show this help message"
            echo ""
            echo "Prerequisites:"
            echo "  1. kubectl configured with access to the Rackspace Spot cluster"
            echo "  2. Docker images built and pushed to a container registry:"
            echo "       docker build -t REGISTRY/starteria-backend:latest -f Dockerfile.backend ."
            echo "       docker build -t REGISTRY/starteria-frontend:latest -f Dockerfile.frontend ."
            echo "       docker push REGISTRY/starteria-backend:latest"
            echo "       docker push REGISTRY/starteria-frontend:latest"
            echo "  3. Update image references in backend-deployment.yaml and frontend-deployment.yaml"
            echo "  4. Cloudflare tunnel token secret created:"
            echo "       kubectl create secret generic cloudflared-token -n starteria \\"
            echo "         --from-literal=token=YOUR_CLOUDFLARE_TUNNEL_TOKEN"
            echo "  5. Cloudflare tunnel ID set in cloudflared-configmap.yaml"
            echo "  6. At least one worker node in the cluster"
            exit 0
            ;;
    esac

    # Preflight checks
    check_kubectl
    check_cluster_connectivity
    check_worker_nodes
    check_prerequisites

    echo ""

    # Deploy in order
    deploy_postgres
    echo ""
    deploy_backend
    echo ""
    deploy_frontend
    echo ""
    deploy_cloudflared

    echo ""

    # Final status
    show_status

    echo ""
    separator
    if [ "${DRY_RUN:-false}" = "true" ]; then
        log_info "Dry run complete. No changes were made."
    else
        log_success "Deployment complete!"
        echo ""
        log_info "If pods are in Pending state, check that:"
        log_info "  1. Worker nodes are available: $KUBECTL get nodes"
        log_info "  2. Docker images are accessible from the cluster"
        log_info "  3. The cloudflared-token secret has been created"
        log_info "  4. The tunnel ID has been set in cloudflared-configmap.yaml"
        echo ""
        log_info "Useful commands:"
        log_info "  $KUBECTL get pods -n $NAMESPACE -w          # Watch pod status"
        log_info "  $KUBECTL logs -n $NAMESPACE -l app=NAME     # View logs for a component"
        log_info "  $KUBECTL describe pod -n $NAMESPACE POD     # Debug a specific pod"
        log_info "  $0 --status                                 # Show full status"
    fi
    separator
}

main "$@"
