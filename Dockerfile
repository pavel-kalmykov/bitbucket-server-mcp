FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS base

ARG VERSION
RUN test -n "${VERSION}" && npm install -g "@pavel-kalmykov/bitbucket-server-mcp@${VERSION}"

USER node

ENTRYPOINT ["bitbucket-server-mcp"]
