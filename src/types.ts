export interface MetalPrice {
  date: string; // YYYY-MM
  ni: string;
  co: string;
  mn: string;
}

export interface PrecursorProduct {
  id: string;
  name: string;
  niRatio: number;
  coRatio: number;
  mnRatio: number;
  processingFee: number; // USD/kg
}

export interface PurchaseAnalysis {
  month: string;
  productName: string;
  materialCost: number;
  purchasePrice: number;
  isForecast: boolean;
}
