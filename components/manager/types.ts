import type { LpoDocumentDTO, StoreDTO } from "@/lib/queries";
import type { StockRow } from "@/lib/stock";

export type StoreOrder = {
  store: StoreDTO;
  rows: StockRow[]; // only the rows with reorder > 0
  totalUnits: number;
  totalValue: number;
  lpoDocuments: LpoDocumentDTO[];
};

export type StoreTableRow = {
  store: StoreDTO;
  lastStocktakeDate: string | null;
  hasStocktake: boolean;
  outOfStock: boolean;
  needsReorder: boolean;
};

export type ProductionRow = {
  sku: string;
  flavour: string;
  range: string;
  price: number;
  totalQty: number;
  storesNeeding: number;
};

export type AlertItem = { storeId: number; storeName: string; county: string; detail: string };

export type CheckItem = {
  storeId: number;
  storeName: string;
  date: string;
  checksPlacement: string | null;
  checksPrices: string | null;
  checksMissing: string | null;
  checksNotes: string;
  placementPhotoUrl: string | null;
  pricesPhotoUrl: string | null;
  promotionType: string;
  promotionPhotoUrl: string | null;
  competitorBrands: string;
  competitorPhotoUrl: string | null;
  competitors: Array<{ brand: string; gram: string; description: string; price: number; photoUrl: string | null }>;
};

export type AlertsData = {
  outOfStock: AlertItem[];
  belowMinimum: AlertItem[];
  expiry: AlertItem[];
  damaged: AlertItem[];
  noStocktake: AlertItem[];
  displayIssues: CheckItem[];
  competitorReports: CheckItem[];
  activePromotions: CheckItem[];
};

export type DashboardData = {
  totalBranches: number;
  outOfStock: number;
  needReorder: number;
  noStocktake: number;
  totalReorderUnits: number;
  totalReorderValue: number;
  expiryFlags: number;
  stocktakeCount: number;
  movementCount: number;
  countyData: Array<{ county: string; value: number }>;
};

export type MerchandiserRow = { id: string; name: string; active: boolean; lastActive: string };
