#!/usr/bin/env bash
# ติดตั้ง Phase 4 ทับโปรเจกต์เดิมอย่างปลอดภัย
#
# วิธีใช้: ยืนอยู่ใน "โฟลเดอร์โปรเจกต์ของคุณ" (โฟลเดอร์ที่มี frontend/ และ backend/ อยู่ข้างใน) แล้วรัน
#   bash /tmp/p4/witchyu/apply-phase4.sh
#
# สคริปต์นี้จะ:
#  1) สำรองไฟล์เดิมที่จะถูกแทนที่ไว้ในโฟลเดอร์ .backup-before-phase4-<เวลา>  (แก้อะไรไว้เอง เอากลับมาได้)
#  2) ลบโค้ดเก่าที่ถูกแทนที่ทั้งโฟลเดอร์ แล้วคัดลอกของใหม่ (ไม่ให้ไฟล์เก่าที่เลิกใช้แล้วตกค้างจนทำให้ build พัง)
#  3) ไม่แตะ node_modules, backend/.env, .git, package-lock.json
#  4) เติมค่าที่ Phase 4 ต้องใช้ลงใน backend/.env (สร้าง ADMIN_TOKEN_SECRET ให้เอง)
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$(pwd)"

if [ ! -d "$DEST/frontend" ] || [ ! -d "$DEST/backend" ]; then
  echo "✗ โฟลเดอร์ปัจจุบันไม่มี frontend/ และ backend/ — ให้ cd ไปที่โฟลเดอร์โปรเจกต์ของคุณก่อน แล้วรันใหม่"
  exit 1
fi
if [ "$SRC" = "$DEST" ]; then
  echo "✗ อย่ารันสคริปต์ในโฟลเดอร์ที่แตก zip — ให้ cd ไปที่โฟลเดอร์โปรเจกต์ของคุณแล้วเรียก: bash $SRC/apply-phase4.sh"
  exit 1
fi
if [ ! -d "$SRC/backend/src" ] || [ ! -d "$SRC/frontend/src" ]; then
  echo "✗ ไม่พบไฟล์ Phase 4 ข้างสคริปต์ ($SRC) — แตก zip ให้ครบก่อน"
  exit 1
fi

DIRS="frontend/src frontend/public backend/src backend/prisma backend/test .devcontainer"
FILES="frontend/index.html frontend/package.json frontend/vite.config.ts frontend/tsconfig.json frontend/tailwind.config.js frontend/postcss.config.js frontend/.env.example backend/package.json backend/tsconfig.json backend/tsconfig.test.json backend/.env.example backend/.gitignore README.md .gitignore"

BK="$DEST/.backup-before-phase4-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BK"
echo "• สำรองของเดิมไว้ที่ $BK"
for p in $DIRS $FILES; do
  if [ -e "$DEST/$p" ]; then
    mkdir -p "$BK/$(dirname "$p")"
    cp -R "$DEST/$p" "$BK/$p"
  fi
done

echo "• แทนที่โฟลเดอร์โค้ด"
for d in $DIRS; do
  rm -rf "$DEST/$d"
  mkdir -p "$DEST/$(dirname "$d")"
  cp -R "$SRC/$d" "$DEST/$d"
done

echo "• คัดลอกไฟล์ตั้งค่า"
for f in $FILES; do
  mkdir -p "$DEST/$(dirname "$f")"
  cp "$SRC/$f" "$DEST/$f"
done

ENV="$DEST/backend/.env"
if [ -f "$ENV" ]; then
  echo "• อัปเดต backend/.env (ไม่ทับค่าเดิม)"
  printf '\n' >> "$ENV"
  if ! grep -Eq '^ADMIN_TOKEN_SECRET=.{32,}' "$ENV"; then
    sed -i '/^ADMIN_TOKEN_SECRET=/d' "$ENV"
    echo "ADMIN_TOKEN_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> "$ENV"
    echo "  - สร้าง ADMIN_TOKEN_SECRET ใหม่ให้แล้ว"
  fi
  for k in ADMIN_USERNAME ADMIN_PASSWORD ADMIN_DISPLAY_NAME; do
    grep -q "^$k=" "$ENV" || echo "$k=" >> "$ENV"
  done
else
  echo "! ไม่พบ backend/.env — ให้ทำตาม README (คัดลอกจาก backend/.env.example แล้วใส่ DATABASE_URL)"
fi

cat <<'MSG'

✓ วางไฟล์ Phase 4 เรียบร้อย  ขั้นต่อไป (ทำตามลำดับ):

  1) cd backend
  2) แก้ไฟล์ backend/.env  ใส่ ADMIN_USERNAME และ ADMIN_PASSWORD (อย่างน้อย 10 ตัวอักษร)
  3) npm install
  4) npm run db:push          # เพิ่มตารางสวิตช์ร้าน (ไม่ลบข้อมูลเดิม)
  5) npm run db:seed          # ปลอดภัยที่จะรันซ้ำ
  6) npm run admin:create     # สร้างบัญชีแอดมิน
  7) ลบบรรทัด ADMIN_PASSWORD ออกจาก backend/.env
  8) npm test                 # ต้องผ่านทั้งหมด
  9) npm run dev              # เปิดค้างไว้  แล้วเปิดอีก Terminal:
 10) cd frontend && npm install && npm run build && npm run dev
 11) เปิดแอปแล้วต่อท้าย URL ด้วย /admin
MSG
