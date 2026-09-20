import { NextResponse } from "next/server";
import { debugPostSaleOrderMessageViaCreate } from "@/lib/odoo";

// TEMPORARY — removed once the Odoo chatter-escaping bug is diagnosed.
export async function GET() {
  const body =
    `<a href="https://wa.me/254717507475?text=New%20order%20from%20Rubis%20HURLINGHAM%20COCO%20%E2%80%94%20please%20accept%20%26%20collect" ` +
    `target="_blank" style="display:inline-block;padding:10px 18px;background-color:#25D366;color:#ffffff;` +
    `font-weight:bold;font-size:14px;text-decoration:none;border-radius:6px;">📱 DEBUG create() test — delete me</a>`;
  const result = await debugPostSaleOrderMessageViaCreate(1467, body);
  return NextResponse.json({ result });
}
