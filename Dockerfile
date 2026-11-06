FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM oven/bun:1.4.2
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 AUDIT_DB=/app/data/audit.sqlite
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
COPY --from=build --chown=bun:bun /app/public ./public
COPY LICENSE THIRD_PARTY.md ./
COPY licenses ./licenses
RUN mkdir -p /app/data && chown bun:bun /app/data
VOLUME ["/app/data"]
EXPOSE 3000
USER bun
CMD ["bun","server.js"]
