import "server-only";
import React from "react";
import { Document, Page, View, Text, Image, Link, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { RANGES, RANGE_COLORS, PURE_LOGO, ENJOY_LOGO } from "@/lib/brand";

const GREEN = "#6DBE00";
const GREEN_DARK = "#4E8A00";
const RED = "#C0392B";
const INK = "#1F2937";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MERCHANDISER_VISIT_FEE_KES = 300;

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica", color: INK },
  logoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  pureLogo: { height: 26 },
  enjoyLogo: { height: 16 },
  headerBand: { padding: 14, borderRadius: 4, marginBottom: 16 },
  headerType: { color: "#ffffff", fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  headerStore: { color: "#ffffff", fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 3 },
  headerSub: { color: "#ffffff", fontSize: 10, marginTop: 2 },
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowLabel: { width: 140, color: MUTED },
  rowValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, marginTop: 4 },
  banner: { padding: 10, borderRadius: 4, marginBottom: 14 },
  bannerText: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: BG, paddingVertical: 4, paddingHorizontal: 4 },
  tableHeaderCell: { fontSize: 7, color: MUTED, letterSpacing: 0.5 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tableCell: { fontSize: 9 },
  rangeHeader: { fontSize: 8, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 2, letterSpacing: 0.5 },
  notes: { fontSize: 10, marginBottom: 14 },
  footer: { fontSize: 8, color: MUTED, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8, marginTop: 10 },
  summaryCard: { padding: 12, borderRadius: 4, marginBottom: 16 },
  summaryValue: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  summaryLabel: { fontSize: 7, color: MUTED, letterSpacing: 0.5, marginBottom: 2 },
});

function LogoRow() {
  return (
    <View style={styles.logoRow}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={PURE_LOGO} style={styles.pureLogo} />
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={ENJOY_LOGO} style={styles.enjoyLogo} />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export async function renderStocktakeSummaryPdf(
  store: { name: string; county: string; type: string },
  entry: {
    date: string;
    visitTime: string;
    merchandiser: string;
    idNumber: string;
    merchandiserPhone: string;
    kraPin: string;
    embedded: boolean;
    signatureUrl: string;
    notes: string;
    checksPlacement: string | null;
    checksPrices: string | null;
    checksMissing: string | null;
    items: Array<{
      name: string;
      range: string;
      shelfQty: number;
      backStock: number;
      expired: number;
      damaged: number;
      batchCode: string;
    }>;
    competitors: Array<{ brand: string; gram: string; description: string; price: number }>;
  },
  minStock: number
): Promise<Buffer> {
  const flagged = entry.checksPlacement === "No" || entry.checksPrices === "No" || entry.checksMissing === "Yes";
  const lowStockCount = entry.items.filter((it) => it.shelfQty + it.backStock < minStock).length;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <LogoRow />
        <View style={[styles.headerBand, { backgroundColor: GREEN }]}>
          <Text style={styles.headerStore}>{store.name.trim()}</Text>
          <Text style={styles.headerSub}>
            {store.county} · {store.type}
          </Text>
        </View>

        <DetailRow label="Date" value={entry.visitTime ? `${entry.date} at ${entry.visitTime}` : entry.date} />
        <DetailRow
          label="Submitted by"
          value={[
            entry.merchandiser,
            entry.idNumber ? `ID ${entry.idNumber}` : "",
            entry.merchandiserPhone,
            entry.kraPin ? `KRA ${entry.kraPin}` : "",
          ]
            .filter(Boolean)
            .join(" — ")}
        />

        {!entry.embedded && (
          <View style={[styles.banner, { backgroundColor: "#FFF8EC" }]}>
            <Text style={[styles.bannerText, { color: "#8A5A00" }]}>
              Merchandiser service fee: KES {MERCHANDISER_VISIT_FEE_KES} (logged as a draft expense in Odoo)
            </Text>
          </View>
        )}

        <View
          style={[
            styles.banner,
            { backgroundColor: lowStockCount > 0 || flagged ? "#FEF6F5" : "#EEF7DE", marginTop: 4 },
          ]}
        >
          {lowStockCount > 0 && (
            <Text style={[styles.bannerText, { color: RED }]}>
              {lowStockCount} product{lowStockCount === 1 ? "" : "s"} below minimum stock ({minStock} units)
            </Text>
          )}
          {entry.checksPlacement !== null && flagged && (
            <Text style={[styles.bannerText, { color: RED, marginTop: lowStockCount > 0 ? 2 : 0 }]}>
              Store display check flagged an issue — see app for details
            </Text>
          )}
          {!(lowStockCount > 0 || flagged) && (
            <Text style={[styles.bannerText, { color: GREEN_DARK }]}>No stock or display issues flagged</Text>
          )}
        </View>

        {entry.notes ? <Text style={styles.notes}>Notes: {entry.notes}</Text> : null}

        <Text style={styles.sectionTitle}>Stock counts</Text>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>PRODUCT</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>SHELF</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>BACK</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>TOTAL</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}></Text>
        </View>
        {RANGES.map((range) => {
          const rangeItems = entry.items.filter((it) => it.range === range);
          if (rangeItems.length === 0) return null;
          return (
            <View key={range}>
              <Text style={[styles.rangeHeader, { color: RANGE_COLORS[range] || MUTED }]}>{range}</Text>
              {rangeItems.map((it, i) => {
                const onHand = it.shelfQty + it.backStock;
                const low = onHand < minStock;
                const extras = [
                  it.expired ? `${it.expired} expired` : "",
                  it.damaged ? `${it.damaged} damaged` : "",
                  (it.expired || it.damaged) && it.batchCode ? `batch ${it.batchCode}` : "",
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tableCell, { flex: 3 }]}>{it.name}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: "center" }]}>{it.shelfQty}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: "center" }]}>{it.backStock}</Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { flex: 1, textAlign: "center", fontFamily: "Helvetica-Bold", color: low ? RED : INK },
                      ]}
                    >
                      {onHand}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 2, color: RED, fontSize: 8 }]}>{extras}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {entry.competitors.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Competitor check</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>BRAND</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>WEIGHT</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>DESCRIPTION</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>PRICE</Text>
            </View>
            {entry.competitors.map((c, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={[styles.tableCell, { flex: 2 }]}>
                  {i + 1}. {c.brand}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "center", color: MUTED }]}>{c.gram}</Text>
                <Text style={[styles.tableCell, { flex: 3, color: MUTED }]}>{c.description}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                  KES {c.price}
                </Text>
              </View>
            ))}
          </View>
        )}

        {entry.signatureUrl ? (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.summaryLabel, { marginBottom: 4 }]}>SIGNED BY {entry.merchandiser.toUpperCase()}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={entry.signatureUrl} style={{ maxWidth: 180, borderRadius: 4 }} />
          </View>
        ) : null}

        <Text style={styles.footer}>Generated automatically by the Rubis Enjoy Stock &amp; Reorder app.</Text>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  SALE: "Sale",
  RETURN: "Return",
  EXPIRED_DAMAGED: "Expired/Damaged",
};

export async function renderMovementSummaryPdf(
  store: { name: string; county: string; type: string },
  entry: {
    type: string;
    date: string;
    time: string;
    merchandiser: string;
    productName: string | null;
    qty: number;
    batchCode: string;
    deliveryNote: string;
    deliveryNotePhotoUrl: string | null;
    invoiceNumber: string;
    receivedBy: string;
    notes: string;
    signatureUrl: string;
  }
): Promise<Buffer> {
  const typeLabel = MOVEMENT_TYPE_LABELS[entry.type] || entry.type;
  const typeColor = entry.type === "EXPIRED_DAMAGED" ? RED : GREEN_DARK;
  const typeTint = entry.type === "EXPIRED_DAMAGED" ? "#FEF6F5" : "#EEF7DE";
  const isDelivery = entry.type === "DELIVERY";

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <LogoRow />
        <View style={[styles.headerBand, { backgroundColor: typeColor }]}>
          <Text style={styles.headerType}>{typeLabel.toUpperCase()}</Text>
          <Text style={styles.headerStore}>{store.name.trim()}</Text>
          <Text style={styles.headerSub}>
            {store.county} · {store.type}
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: typeTint }]}>
          {isDelivery ? (
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>DELIVERY NOTE NR</Text>
                <Text style={styles.summaryValue}>{entry.deliveryNote}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>INVOICE NR</Text>
                <Text style={styles.summaryValue}>{entry.invoiceNumber}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.summaryValue}>
              {entry.qty} × {entry.productName || "Unknown"}
            </Text>
          )}
        </View>

        <DetailRow label="Date" value={entry.time ? `${entry.date} at ${entry.time}` : entry.date} />
        {entry.merchandiser ? <DetailRow label="Logged by" value={entry.merchandiser} /> : null}
        {!isDelivery && entry.batchCode ? <DetailRow label="Batch code" value={entry.batchCode} /> : null}
        {isDelivery && entry.receivedBy ? <DetailRow label="Received by" value={entry.receivedBy} /> : null}

        {entry.notes ? <Text style={[styles.notes, { marginTop: 10 }]}>Notes: {entry.notes}</Text> : null}

        {isDelivery && entry.deliveryNotePhotoUrl ? (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.summaryLabel, { marginBottom: 4 }]}>DELIVERY NOTE</Text>
            {entry.deliveryNotePhotoUrl.toLowerCase().endsWith(".pdf") ? (
              <Link src={entry.deliveryNotePhotoUrl} style={{ fontSize: 10, color: GREEN_DARK }}>
                View delivery note (PDF)
              </Link>
            ) : (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={entry.deliveryNotePhotoUrl} style={{ maxWidth: 300, borderRadius: 4 }} />
            )}
          </View>
        ) : null}

        {entry.signatureUrl ? (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.summaryLabel, { marginBottom: 4 }]}>
              SIGNED{entry.merchandiser ? ` BY ${entry.merchandiser.toUpperCase()}` : ""}
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={entry.signatureUrl} style={{ maxWidth: 180, borderRadius: 4 }} />
          </View>
        ) : null}

        <Text style={styles.footer}>Generated automatically by the Rubis Enjoy Stock &amp; Reorder app.</Text>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}

export async function renderOrderSummaryPdf(
  store: { name: string; county: string; type: string },
  items: Array<{ sku: string; flavour: string; reorder: number }>,
  odooOrderName: string | null,
  orderRef: string,
  signatureUrl: string | null
): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <LogoRow />
        <View style={[styles.headerBand, { backgroundColor: GREEN_DARK }]}>
          <Text style={styles.headerType}>ORDER PLACED</Text>
          <Text style={styles.headerStore}>{store.name.trim()}</Text>
          <Text style={styles.headerSub}>
            {store.county} · {store.type}
          </Text>
        </View>

        <DetailRow label="Order reference" value={orderRef} />
        {odooOrderName ? <DetailRow label="Odoo Sales Order" value={odooOrderName} /> : null}

        <View style={{ marginTop: 10 }}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>PRODUCT</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>QTY</Text>
          </View>
          {items.map((it, i) => (
            <View style={styles.tableRow} key={i}>
              <View style={{ flex: 3 }}>
                <Text style={styles.tableCell}>{it.flavour}</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{it.sku}</Text>
              </View>
              <Text style={[styles.tableCell, { flex: 1, textAlign: "center", fontFamily: "Helvetica-Bold" }]}>
                {it.reorder}
              </Text>
            </View>
          ))}
        </View>

        {signatureUrl ? (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.summaryLabel, { marginBottom: 4 }]}>SIGNED</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={signatureUrl} style={{ maxWidth: 180, borderRadius: 4 }} />
          </View>
        ) : null}

        <Text style={styles.footer}>
          Placed directly from the branch's own reorder list in the Rubis Enjoy Stock &amp; Reorder app.
        </Text>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
