FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY --chown=bun:bun package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY --chown=bun:bun . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build
RUN mkdir -p /app/data && chown bun:bun /app/data
ENV AUDIT_DB=/app/data/audit.sqlite
VOLUME ["/app/data"]
USER bun
CMD ["bun","run","start"]
