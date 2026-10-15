#!/bin/sh
set -eu
# Preflight names, isolation and worker identity. Secret values are never printed.
node /opt/architect-apps-worker/apps-worker.mjs --preflight
exec node /opt/architect-apps-worker/apps-worker.mjs --supervised
