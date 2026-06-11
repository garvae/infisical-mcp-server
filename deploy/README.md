# Deploying the Forked MCP Runtime

This directory contains the minimum server-side scaffolding required to run the
fork as an internal `streamable-http` service for MCPHub.

## Files

- `docker-compose.yml`: container definition for the MCP runtime

## Expected server layout

Create a deploy directory on the target server, for example:

```bash
/opt/infisical-mcp/
  docker-compose.yml
  .env.infisical-mcp
```

Copy `docker-compose.yml` into that directory and create `.env.infisical-mcp`
outside the repository checkout.

## Required runtime variables

The compose stack expects the runtime authentication variables to be provided
through `.env.infisical-mcp`:

```bash
INFISICAL_AUTH_METHOD=access-token
INFISICAL_TOKEN=replace-me
INFISICAL_HOST_URL=https://app.infisical.com
```

For universal auth, replace the token variables with:

```bash
INFISICAL_AUTH_METHOD=universal-auth
INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=replace-me
INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=replace-me
INFISICAL_HOST_URL=https://app.infisical.com
```

Optional transport settings can live either in `.env.infisical-mcp` or in the
host shell environment:

```bash
MCP_HTTP_PORT=3333
MCP_HTTP_PATH=/mcp
MCP_HTTP_BODY_LIMIT_BYTES=4194304
MCP_HTTP_SESSION_TTL_MS=300000
```

## Required GitHub Actions secrets

The deploy workflow expects these repository secrets:

- `DEPLOY_SSH_HOST`
- `DEPLOY_SSH_PORT`
- `DEPLOY_SSH_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_USERNAME`
- `GHCR_PULL_TOKEN`

`GHCR_PULL_TOKEN` must be able to pull from `ghcr.io/<owner>/infisical-mcp-server`.

## MCPHub connection

Once the service is up on the shared Docker network, MCPHub should connect to:

```text
http://infisical-mcp-http:3333/mcp
```

The container also exposes a health endpoint:

```text
http://infisical-mcp-http:3333/health
```
