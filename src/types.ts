export const SALE_STATUSES = ['Sold', 'Sample', 'Rejected', 'Callback'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export interface Visit {
  id: number | string;
  shop_name: string;
  phone_number: string;
  sale_status: SaleStatus;
  sale_amount: number;
  units_sold?: number;
  notes: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  synced?: boolean;
}

export interface VisitFormData {
  shop_name: string;
  phone_number: string;
  sale_status: SaleStatus;
  sale_amount: number;
  units_sold?: number;
  notes: string;
  latitude: number;
  longitude: number;
}

export interface DayMetrics {
  totalVisited: number;
  totalSalesAmount: number;
  totalUnitsSold: number;
  conversionRate: number; // percentage e.g. 66.7
  soldCount: number;
  sampleCount: number;
  rejectedCount: number;
  callbackCount: number;
  averageSaleAmount: number;
}

export interface RepLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface DailySalesPoint {
  date: string;
  dayLabel: string;
  rawDayName: string;
  shortDate: string;
  salesAmount: number;
  unitsSold: number;
  soldCount: number;
  sampleCount: number;
  totalVisits: number;
}
