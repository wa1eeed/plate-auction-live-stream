# syntax=docker/dockerfile:1

# ==============================================================
#  سوق اللوحات — صورة إنتاج
#
#  لا خدمة قاعدة بيانات ولا volume: المخزن في الذاكرة (`MemoryStore`)
#  وبيانات الديمو كودٌ في `src/lib/store/seed.ts` تُشحن داخل الصورة، فتُبذر
#  متطابقة في كل إقلاع. وكل إعادة تشغيل تُرجع البيئة إلى حالة معلومة.
#
#  والعملية **واحدة لا تُنسخ**: `server.mjs` يحمل خادم Next وخادم WebSocket
#  والحالة كلّها على `globalThis`. نسختان = عالمان، ومزايدون لا يرى بعضهم بعضًا.
# ==============================================================

# ---------- 1. اعتماديات البناء (بما فيها أدوات التطوير) ----------
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- 2. البناء ----------
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` يُجري فحص الأنواع والتدقيق أيضًا — فلا تُبنى صورةٌ من كود مكسور
RUN pnpm build

# ---------- 3. اعتماديات التشغيل وحدها ----------
#
# تُثبَّت مسطّحة (`hoisted`) لا بروابط pnpm الرمزية: النسخ بين مراحل الصورة
# يتبع الروابط إلى مخزنٍ لا يُنسخ معها، فتصل الحزم فارغة.
FROM node:20-alpine AS prod-deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --config.node-linker=hoisted

# ---------- 4. التشغيل ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOST=0.0.0.0 \
    PORT=3000

# مستخدم غير جذر: خادمٌ مكشوف للإنترنت لا يعمل بصلاحيات الجذر
RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build     --chown=app:app /app/.next        ./.next
COPY --chown=app:app public         ./public
COPY --chown=app:app package.json next.config.mjs server.mjs ./

USER app
EXPOSE 3000

# `dumb-init` ليس ضروريًّا: `server.mjs` يلتقط SIGTERM/SIGINT ويُغلق المقابس
CMD ["node", "server.mjs"]
