/**
 * Seeds the catalogue (18 products), the 75 branches, and the three shared role codes.
 *
 * Safe to re-run: every write is an upsert whose `update` clause is a no-op, so
 * existing rows (manager-edited targets, branch contact overrides, rotated access
 * codes) are never clobbered. Only genuinely missing rows are inserted.
 */
import { PrismaClient, RoleCodeType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PRODUCTS, STORES } from "./seed-data";

const prisma = new PrismaClient();

function storeCodeFor(id: number) {
  return "RB" + String(id).padStart(3, "0");
}

const DEFAULT_ROLE_CODES: Array<{ type: RoleCodeType; code: string }> = [
  { type: RoleCodeType.MERCHANDISER, code: "PURE2026" },
  { type: RoleCodeType.MANAGER, code: "RUBIS-ADMIN" },
  { type: RoleCodeType.HQ, code: "RUBIS-HQ" },
];

async function main() {
  console.log("Seeding products…");
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {}, // never overwrite a manager-tuned target
      create: {
        sku: p.sku,
        barcode: p.barcode,
        range: p.range,
        flavour: p.flavour,
        price: p.price,
        target: p.target,
        unavailable: p.unavailable ?? false,
      },
    });
  }

  console.log("Seeding stores…");
  for (const s of STORES) {
    await prisma.store.upsert({
      where: { id: s.id },
      update: {}, // never overwrite branch-manager self-service edits
      create: {
        id: s.id,
        name: s.name,
        type: s.type,
        county: s.county,
        seedPhone: s.phone,
        seedEmail: s.email,
        codeHash: await bcrypt.hash(storeCodeFor(s.id), 10),
      },
    });
  }

  // Explicit ids were inserted above, so the identity sequence still points at 1.
  // Fast-forward it so newly added branches get ids after the seeded range.
  const maxId = await prisma.store.aggregate({ _max: { id: true } });
  if (maxId._max.id) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Store"', 'id'), ${maxId._max.id}, true)`
    );
  }

  console.log("Seeding role codes…");
  for (const rc of DEFAULT_ROLE_CODES) {
    await prisma.roleCode.upsert({
      where: { type: rc.type },
      update: {}, // never reset a rotated code
      create: { type: rc.type, codeHash: await bcrypt.hash(rc.code, 10) },
    });
  }

  console.log("Seed complete.");
  console.log("  Merchandiser backup code : PURE2026");
  console.log("  Pure Nutrition Manager   : RUBIS-ADMIN");
  console.log("  Rubis HQ                 : RUBIS-HQ");
  console.log("  Branch codes             : RB001 … RB0NN (derived from store id)");
  console.log("Change these from Manager → Team Access as soon as the app is live.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
