FROM node:24-alpine
# Isolated compilation worker. Generated project code is never copied into this image.
# Sibling Docker compiles use deploy/architect-apps/Dockerfile with --network none.
# node:24-alpine already owns uid 1000 as the node user; do not add a colliding account.
WORKDIR /opt/architect-apps-worker
RUN apk add --no-cache docker-cli tini
COPY apps-worker.mjs /opt/architect-apps-worker/apps-worker.mjs
COPY entrypoint.sh /opt/architect-apps-worker/entrypoint.sh
RUN chmod 755 /opt/architect-apps-worker/entrypoint.sh \
    && chown -R node:node /opt/architect-apps-worker
USER node
ENTRYPOINT ["/sbin/tini", "--", "/opt/architect-apps-worker/entrypoint.sh"]
