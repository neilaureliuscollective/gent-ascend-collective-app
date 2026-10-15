FROM node:24-alpine
# Pinned Architect Apps toolchain. Generated project code is copied in at run time.
# This image is not a model-controlled Dockerfile.
WORKDIR /opt/apps-toolchain
RUN npm init -y \
  && npm install --omit=dev typescript@6.0.3 vite@8.3.0 react@19.3.0 react-dom@19.3.0 @types/react@19.3.0 @types/react-dom@19.3.0 \
  && chmod -R a+rX /opt/apps-toolchain
USER 65534:65534
