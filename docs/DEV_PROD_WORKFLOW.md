# Kalemart — Dev & Prod Workflow

> Reference for humans and AI agents. Read this before touching the cluster.

---

## TL;DR

### AI agent quickstart — local deploy/test

If a user asks an AI agent to deploy or test Kalemart locally, do **exactly** this:

```bash
cd /Users/sreekanth/work/kalemart
export DOCKER_HOST=unix:///Users/sreekanth/.orbstack/run/docker.sock
kubectl config use-context orbstack
./scripts/deploy-local.sh dev
```

Then open services in a separate terminal:

```bash
cd /Users/sreekanth/work/kalemart
./scripts/port-forward.sh
```

Then verify in a third terminal:

```bash
cd /Users/sreekanth/work/kalemart
./scripts/verify-local.sh
```

Expected success:

```txt
Passed: 28  Failed: 0
Local dev deployment is ready.
```

Rules for AI agents:
- Do **not** use `docker-compose`; it is legacy.
- Do **not** assume `localhost:3001` is another app instance; it is Grafana.
- Do **not** use production Argo CD for local testing.
- Do **not** claim success until `./scripts/verify-local.sh` passes.
- If Docker cannot connect, set `DOCKER_HOST=unix:///Users/sreekanth/.orbstack/run/docker.sock`.
- If Grafana login fails locally, reset it with `kubectl exec -n observability deploy/grafana -- grafana cli admin reset-admin-password kalemart-dev`.

| Goal                      | Command                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| **Full local deploy**     | `./scripts/deploy-local.sh dev`                                      |
| **Iterate on 1–2 services** | `kubectl set image` + `kubectl patch` (see *Surgical patch* below) |
| **Open the app locally**  | `./scripts/port-forward.sh` → `http://localhost:3000`                |
| **Ship to prod**          | `git push origin main` — CI builds, Argo CD syncs                    |
| **Verify prod**           | `kalemart.sreekanthp.com` (Cloudflare Tunnel) + Argo CD UI           |

**Critical:** `docker-compose.yml` exists but is **legacy / not the source of truth**. The real platform is OrbStack Kubernetes + Helm + Argo CD. Do not test changes against compose unless explicitly told to.

---

## 1. Environment

### Local (dev cluster)
- **Cluster:** OrbStack-bundled k8s, kubectl context `orbstack`
- **App namespace:** `kalemart`
- **Observability namespace:** `observability` (Prometheus, Grafana, Loki, Tempo, OTel Collector)
- **Docker socket:** `unix:///Users/sreekanth/.orbstack/run/docker.sock`
  - If `docker` CLI says "daemon not running", set `DOCKER_HOST` to the path above.
- **Helm release name:** `kalemart` (in `kalemart` ns)
- **Ingress:** No ingress controller in the local cluster. Use port-forward.
- **Argo CD:** Not installed locally. Local deploys are direct `helm upgrade`.

### Prod
- **Cluster:** Remote VM (k3s) provisioned via `infra/terraform` + `infra/ansible`
- **GitOps:** Argo CD watches `infra/argocd/apps/*.yaml` → those Applications point at this repo's `helm/` and `observability/` paths
- **Public URL:** `https://kalemart.sreekanthp.com` via Cloudflare Tunnel (`infra/argocd/apps/cloudflared.yaml`)
- **Public Grafana:** `https://grafana.kalemart.sreekanthp.com` via the same Cloudflare Tunnel with anonymous read-only Viewer access.
- **Grafana dashboards:** Argo CD app `grafana-dashboards` applies `observability/grafana-dashboards-configmap.yaml`; the production Grafana sidecar loads ConfigMaps labeled `grafana_dashboard=1`.
- **Cloudflare DNS requirement:** `grafana.kalemart.sreekanthp.com` must be configured as a Cloudflare Tunnel public hostname/CNAME for the URL to resolve publicly.
- **Image registry:** `ghcr.io/sreekanthca6/kalemart/<svc>:<tag>`
- **CI:** `.github/workflows/ci.yml` builds + pushes images. On `main` and `dev` branches it bumps image tags in `values.*.yaml` and commits with `[skip ci]` (see commit `d08d783` for an example).

### Required env (root `.env`)
```
POSTGRES_PASSWORD=...
JWT_SECRET=...
ANTHROPIC_API_KEY=...
```
The `deploy-local.sh` script reads `.env` and passes `ANTHROPIC_API_KEY` to Helm via `--set`.

---

## 2. Dev workflow

### 2a. The one true local loop

Use this sequence when testing locally. It keeps the mental model simple:

```bash
# 1. Build and deploy to OrbStack Kubernetes.
export DOCKER_HOST=unix:///Users/sreekanth/.orbstack/run/docker.sock
./scripts/deploy-local.sh dev

# 2. In a separate terminal, expose local URLs.
./scripts/port-forward.sh

# 3. In a third terminal, prove everything is correct.
./scripts/verify-local.sh
```

Expected local URLs:

| URL | Service |
| --- | --- |
| `http://localhost:3000` | KaleMart frontend |
| `http://localhost:4000/health` | Backend health |
| `http://localhost:3001` | Grafana (`admin` / `kalemart-dev`) |
| `http://localhost:9090` | Prometheus |
| `http://localhost:9093` | Alertmanager |

If the app still looks old after a change, do **not** trust the browser first. Run:

```bash
./scripts/verify-local.sh
```

It checks the actual deployed image tags, pull policy, Ops page content, Grafana auth, Prometheus readiness, and Alertmanager readiness.

### 2b. Full deploy (the 99% path)

Use this when you've changed code and want a clean rollout. It builds **all** images, helm-upgrades, and rollout-restarts.

```bash
./scripts/deploy-local.sh dev
```

What it does (from `scripts/deploy-local.sh`):
1. Asserts kubectl context is `orbstack`
2. Loads `.env`
3. Builds 4 ARM64 images locally tagged `kalemart/<svc>:dev` (backend, frontend, worker, ai-service) — calls `scripts/build-images.sh`
4. (Optionally) deploys observability stack via `helmfile -f observability/helmfile.local.yaml apply`. Skip with `SKIP_OBSERVABILITY=true`.
5. `helm upgrade --install kalemart helm/kalemart` with:
   - `global.imageRegistry=""` (use local images, not ghcr)
   - `global.imagePullPolicy=Never` (do not try to pull)
   - All four `*.image.tag=dev`
   - `secrets.anthropicApiKey=$ANTHROPIC_API_KEY`
6. `kubectl rollout restart` on the four app deployments + waits for ready

**Skip rebuild** (just re-run helm + restart) with: `SKIP_BUILD=true ./scripts/deploy-local.sh dev`

### 2c. Surgical patch — fastest path when changing only 1–2 services

Useful when you don't want to rebuild all 5 services and don't want to bump the helm release revision.

```bash
export DOCKER_HOST=unix:///Users/sreekanth/.orbstack/run/docker.sock

# 1. Build only the service(s) you changed
docker build --platform linux/arm64 -t kalemart/backend:dev-local apps/backend/

# 2. Patch the deployment to use the local image with pullPolicy=Never
kubectl set image deploy/kalemart-backend backend=kalemart/backend:dev-local -n kalemart
kubectl patch deploy/kalemart-backend -n kalemart \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"backend","imagePullPolicy":"Never"}]}}}}'

kubectl rollout status deploy/kalemart-backend -n kalemart --timeout=120s
```

To revert a surgical patch:
```bash
kubectl set image deploy/kalemart-backend backend=ghcr.io/sreekanthca6/kalemart/backend:dev-latest -n kalemart
kubectl patch deploy/kalemart-backend -n kalemart \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"backend","imagePullPolicy":"Always"}]}}}}'
```

Or wholesale: `helm rollback kalemart -n kalemart`.

### 2d. Helm template changes only (no image rebuild)

If you changed only the Helm chart (e.g. `helm/kalemart/templates/ingress.yaml`), apply just that template without re-running the whole release:

```bash
helm template kalemart ./helm/kalemart \
  -n kalemart \
  -f helm/kalemart/values.yaml \
  -f helm/kalemart/values.dev.yaml \
  -s templates/ingress.yaml | kubectl apply -f - -n kalemart
```

This sidesteps the helm release lock (see *Pitfalls*).

### 2e. Verify dev

```bash
# Pods
kubectl get pods -n kalemart

# Image + pullPolicy currently deployed
kubectl get deploy -n kalemart -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[*].image}{"\t"}{.spec.template.spec.containers[*].imagePullPolicy}{"\n"}{end}'

# Ingress paths
kubectl get ingress -n kalemart -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.rules[0].http.paths[*].path}{"\n"}{end}'

# Open in browser via port-forward
./scripts/port-forward.sh
# → http://localhost:3000        (frontend)
# → http://localhost:4000/health (backend)
# → http://localhost:3001        (Grafana — separate local port to avoid frontend's 3000)
# → http://localhost:9090        (Prometheus)
# → http://localhost:9093        (Alertmanager)

# Automated verification
./scripts/verify-local.sh

# In-cluster smoke test (no port-forward) using ephemeral curl pod
kubectl run -it --rm sre-test --image=curlimages/curl:8.10.1 --restart=Never -n kalemart --quiet -- \
  -s http://kalemart-backend:4000/health
```

### 2f. Tear down dev

```bash
make -C infra dev-teardown   # uninstalls the kalemart helm release
# observability stays up; teardown manually with `helm uninstall ... -n observability`
```

---

## 3. Prod workflow

Prod is fully GitOps — **you do not deploy directly**. You commit, push, and Argo CD syncs.

### 3a. Pre-flight (before pushing)

1. Tested via `./scripts/deploy-local.sh dev` on `orbstack`.
2. `kubectl get pods -n kalemart` is all `1/1 Running`.
3. Smoke test passes (`./scripts/smoke-test.sh` if applicable, or curl the health endpoint via port-forward).

### 3b. Ship

```bash
git add <changed files>
git commit -m "feat(scope): summary"
git push origin main
```

CI then:
1. Builds + pushes `ghcr.io/sreekanthca6/kalemart/<svc>:sha-<short-sha>` for changed services
2. (For `main`) bumps tags in `helm/kalemart/values.prod.yaml` and pushes a `[skip ci]` commit (see commit `d08d783`)
3. Argo CD detects the change in the repo and syncs the prod cluster

### 3c. Verify prod

```bash
# Watch sync status (if you can reach the prod cluster)
kubectl --context=<prod-context> -n argocd get applications

# Or check the live URL
curl -fsSL https://kalemart.sreekanthp.com/health
curl -fsSL https://kalemart.sreekanthp.com  # frontend should 200
curl -fsSL https://grafana.kalemart.sreekanthp.com/api/health

# Check what image SHA prod is on
kubectl --context=<prod-context> get deploy -n kalemart \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[*].image}{"\n"}{end}'
```

If `grafana.kalemart.sreekanthp.com` does not resolve, create the Cloudflare Tunnel public hostname/DNS route for tunnel `632d3823-1e7a-44f6-ad9f-0ab3452be703`:

```bash
cloudflared tunnel route dns 632d3823-1e7a-44f6-ad9f-0ab3452be703 grafana.kalemart.sreekanthp.com
```

Argo CD must also sync `cloudflared`, `kube-prometheus`, and `grafana-dashboards`.

If Argo CD is out of sync, do **not** kubectl-edit prod. Either:
- Sync via Argo CD UI / `argocd app sync kalemart`
- Or push a follow-up commit fixing the underlying issue.

### 3d. Rollback prod

```bash
git revert <bad-commit>
git push origin main
# Argo CD will sync the revert
```

For an emergency, `argocd app rollback kalemart <previous-revision>` works, but the next sync will re-apply HEAD — so always follow up with a git revert.

---

## 4. Pitfalls (things I learned the hard way)

1. **`docker-compose up` is not the same as the cluster.** The compose file references a static `ai-service` upstream in `deploy/nginx.conf`; if you only bring up backend+frontend the nginx container crash-loops with `host not found in upstream "ai-service"`. The cluster doesn't use that nginx at all.

2. **OrbStack docker socket.** The `docker` CLI on macOS often defaults to Docker Desktop's socket. Always set `DOCKER_HOST=unix:///Users/sreekanth/.orbstack/run/docker.sock` for OrbStack.

3. **No ingress controller in local cluster.** The Helm `Ingress` resources exist but no controller serves them. **Use port-forward, not `kalemart.local`.** The ingress is only for prod (where it's served via the in-cluster nginx-ingress + Cloudflare Tunnel).

4. **Helm release lock.** If `helm upgrade --wait` gets interrupted (Ctrl-C, sandbox timeout), the release is left in `pending-upgrade` and blocks all subsequent `helm upgrade` / `helm install` calls with `another operation (install/upgrade/rollback) is in progress`. Fix:
   ```bash
   helm rollback kalemart -n kalemart   # back to last good revision
   ```

5. **Don't override all 4 image tags to a tag you only built for some.** If you set `frontend.image.tag=dev` and `backend.image.tag=dev` but `worker` and `ai-service` only exist in ghcr as `dev-latest`, with `imagePullPolicy=Never` the worker and ai-service pods get `ErrImageNeverPull`. Either build all four locally (the deploy script does this) or use the surgical-patch approach (§ 2b).

6. **`values.dev.yaml` uses `ghcr.io/sreekanthca6` registry + `dev-latest` tag with pullPolicy=Always.** This is the *normal* dev mode (CI builds the image, your cluster pulls). The deploy script overrides this only when running locally.

7. **`values.yaml` (the base) uses `kalemart/<svc>:sha-<sha>`** — this is what `values.prod.yaml` extends and what CI bumps. Never edit `sha-...` tags by hand; CI manages them.

8. **`.env` must exist.** `deploy-local.sh` errors if `.env` is missing. Copy from `.env.example` and fill in.

9. **Curl/wget output blocked in sandbox.** When using context-mode sandboxed shells, prefer `python3 -c` to fetch+process responses, or run via the host `Bash` tool.

10. **Pre-existing pods can be 5+ hours old without it being broken.** Always check `kubectl get deploy -o jsonpath=...` for the *current* image, not pod age.

---

## 5. File map (where things live)

```
apps/<svc>/                       # source code (each has Dockerfile)
helm/kalemart/                    # Helm chart for the app
helm/kalemart/values.yaml         # base — referenced sha-tags (CI-managed)
helm/kalemart/values.dev.yaml     # dev overrides — ghcr registry, dev-latest
helm/kalemart/values.prod.yaml    # prod overrides
observability/                    # helmfile + values for Prometheus/Grafana/Loki/Tempo/OTel
observability/helmfile.local.yaml  # local OrbStack override; Grafana root_url localhost:3001, no ingress
observability/alert-rules.yaml    # Prometheus alert rules
infra/argocd/apps/                # Argo CD Application manifests (prod)
infra/ansible/                    # bootstrap playbook for prod VM (k3s, argocd, etc.)
infra/terraform/                  # VM provisioning (GCP)
.github/workflows/ci.yml          # CI pipeline
scripts/build-images.sh           # builds all ARM64 images locally
scripts/deploy-local.sh           # full local deploy (orbstack)
scripts/port-forward.sh           # port-forwards all services
scripts/smoke-test.sh             # post-deploy smoke checks
scripts/verify-local.sh           # verifies local OrbStack deploy + Ops/Grafana observability path
scripts/verify-deploy.sh          # verifies a deploy
deploy/nginx.conf                 # ONLY used by docker-compose (legacy)
docker-compose.yml                # legacy — do not use
```

---

## 6. Decision matrix for AI agents

| Situation                                              | Do                                                  |
| ------------------------------------------------------ | --------------------------------------------------- |
| User asks to "test locally"                            | § 2a or § 2b — never compose                        |
| User changed only `apps/backend/...`                    | § 2b surgical patch                                 |
| User changed Helm template only                         | § 2c apply rendered template                        |
| User changed multiple services                         | § 2a full deploy                                    |
| User wants to ship to prod                             | § 3b push to main, do **not** kubectl-edit prod     |
| Helm upgrade hangs / stays "pending"                   | § 4 #4 — `helm rollback`                            |
| Pods stuck `ErrImageNeverPull`                         | § 4 #5 — build missing images or revert tag         |
| Need to verify what's actually running                 | `kubectl get deploy -o jsonpath='...image...'`      |
| Need to undo all uncommitted work                       | `git checkout -- <files>` + delete new files + § 2b revert |
