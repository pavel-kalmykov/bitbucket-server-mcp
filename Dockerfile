# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f
FROM ${NODE_IMAGE} AS builder

WORKDIR /src
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src/ ./src/
RUN npm run build

FROM ${NODE_IMAGE} AS runtime

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /src/build/ ./build/

USER node

ENTRYPOINT ["node", "/app/build/entry.js"]
