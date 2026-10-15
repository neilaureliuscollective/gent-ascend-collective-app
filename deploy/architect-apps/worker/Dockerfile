FROM node:24-alpine
# Isolated compilation worker. Generated project code is never copied into this image.
# Sibling Docker compiles use deploy/architect-apps/Dockerfile with --network none.
WORKDIR /opt/architect-apps-worker
RUN apk add --no-cache docker-cli tini \
  && adduser -D -u 1000 appsworker
COPY apps-worker.mjs /opt/architect-apps-worker/apps-worker.mjs
COPY entrypoint.sh /opt/architect-apps-worker/entrypoint.sh
RUN chmod 755 /opt/architect-apps-worker/entrypoint.sh \
  && chown -R appsworker:appsworker /opt/architect-apps-worker
USER 1000:1000
ENTRYPOINT ["/sbin/tini", "--", "/opt/architect-apps-worker/entrypoint.sh"]
