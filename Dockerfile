FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

COPY --from=build /app /app

ENV NODE_ENV=production
ENV NARENJ_SQLITE_PATH=/data/narenj.sqlite

EXPOSE 3000

CMD ["npm", "run", "start"]
