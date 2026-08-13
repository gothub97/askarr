# Single image, two processes: `web` and `bot` differ only by their command.
# Building once keeps the two halves on exactly the same code and schema.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---------------------------------------------------------------- deps
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# --------------------------------------------------------------- build
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nothing about this build is install-specific. Askarr reads APP_URL at run
# time only (src/lib/env.ts explains why it is not a NEXT_PUBLIC_ variable),
# so one published image serves every deployment.
RUN npx prisma generate && npm run build

# --------------------------------------------------------------- runner
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# The bot runs from TypeScript through tsx, and `prisma migrate deploy` runs at
# web start-up, so this image carries the full dependency tree rather than a
# standalone bundle.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs src ./src
COPY --chown=nextjs:nodejs package.json next.config.ts tsconfig.json ./

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "start"]
