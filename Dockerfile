# syntax=docker/dockerfile:1

# ==============================================================
#  سوق اللوحات — صورة إنتاج
#
#  الصورة بلا قاعدة بيانات بداخلها: `DATABASE_URL` يشير إلى خدمةٍ مجاورة،
#  ويُرحَّل المخطَّط عند الإقلاع. وبلا الرابط يقع المخزن في الذاكرة ويبذر نفسه
#  في كل إقلاع — صالحٌ للعرض، لا لبياناتٍ تبقى.
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

# --------------------------------------------------------------
#  ⚠ العنوان العام يُخبَز في الحزمة وقت البناء لا يُقرأ وقت التشغيل.
#
#  كل `NEXT_PUBLIC_*` يستبدله Next بقيمته النصّية أثناء الترجمة — في حزمة
#  الخادم أيضًا لا العميل وحده. فتصير `appUrl()` ثابتًا:
#
#      function appUrl(){ return "https://your-domain".replace(/\/$/,"") }
#
#  ولو مُرِّر المتغيّر وقت التشغيل فقط لخُبز الافتراضي `http://localhost:3000`،
#  فتُرسَل بوابة الدفع المشتريَ إلى `localhost` بعد سداده، ويُطلب الويبهوك من
#  عنوانٍ لا يصله أحد — بلا خطأ في أي سجلّ.
#
#  في Coolify: علّم المتغيّر **Build Variable**، وإلّا لم يصل إلى هنا.
# --------------------------------------------------------------
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

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

# ---- ما يحتاجه الإقلاع خارج حزمة Next
#
# `server.mjs` يُرحّل المخطَّط قبل أن يبدأ Next، فيستورد `scripts/db-migrate.mjs`
# ويقرأ ملفّات `drizzle/*.sql`. وهما **ليسا** في حزمة Next: الأولى تُستورد وقت
# التشغيل لا وقت البناء، والثانية بياناتٌ تُقرأ من القرص.
#
# ونسيانُهما لا يُسقط البناء — يُسقط الحاوية عند أوّل إقلاع بـ
# `ERR_MODULE_NOT_FOUND`، فيردّ الوكيل «no available server» بلا أثرٍ في سجلّ
# البناء. يحرسه `tests/unit/dockerfile.test.ts`.
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app drizzle ./drizzle

# ---- مجلّد الإعدادات الدائم
#
# ما تضبطه الإدارة — الهويّة والصفحات والأسئلة والعمولة والدفع — يُكتب هنا
# فيبقى بعد إعادة النشر. وبلا ربط مجلّدٍ دائم بهذا المسار في كوليفاي يبقى
# داخل الحاوية، والحاوية تُستبدل مع كل نشرة فيعود الضبط افتراضيًّا.
#
#   Coolify → Storages → Volume Mount: /app/data
ENV PLATFORM_DATA_DIR=/app/data
RUN mkdir -p /app/data && chown -R app:app /app/data
VOLUME ["/app/data"]

USER app
EXPOSE 3000

# `dumb-init` ليس ضروريًّا: `server.mjs` يلتقط SIGTERM/SIGINT ويُغلق المقابس
CMD ["node", "server.mjs"]
