/**
 * Bootstrap Owner pertama — AMAN, dijalankan manual di server, bukan endpoint publik.
 *
 * Jalankan:
 *   cd backend
 *   OWNER_EMAIL=owner@toko.com OWNER_PASSWORD='GantiIni123' OWNER_NAME='Owner' \
 *     npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/bootstrap-owner.ts
 *
 * Idempoten: kalau email sudah ada, tidak membuat ulang.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME ?? 'Owner';
  if (!email || !password) {
    throw new Error('Set OWNER_EMAIL dan OWNER_PASSWORD di environment.');
  }
  if (password.length < 8) throw new Error('OWNER_PASSWORD minimal 8 karakter.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Owner ${email} sudah ada (id=${existing.id}). Lewati.`);
    return;
  }

  // Role OWNER: pakai yang ada, atau buat.
  let role = await prisma.role.findFirst({
    where: { name: { in: ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'] } },
  });
  if (!role) role = await prisma.role.create({ data: { name: 'OWNER' } });

  const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt());
  const user = await prisma.user.create({
    data: { name, email, passwordHash, roleId: role.id, branchId: null },
  });
  console.log(`Owner dibuat: id=${user.id} email=${email} role=${role.name}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
