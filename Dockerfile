FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY index.ts ./

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "index.ts"]
