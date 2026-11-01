
export type LegitNetwork =
  | 1 // MTN
  | 2 // Airtel
  | 3 // Glo
  | 4 // 9mobile
  | 5; // Vitel

export interface LegitDataRequest {
  network: number;
  phone: string;
  data_plan: number;
  bypass?: boolean;
  requestId: string;
}

export interface LegitAirtimeRequest {
  network: number;
  phone: string;
  amount: number;
  bypass?: boolean;
  requestId: string;
}

export interface LegitProviderResponse {
  status?: string;
  message?: string;
  response?: string;
  "request-id"?: string;
  request_id?: string;
  transaction_id?: string;
  reference?: string;
  amount?: number | string;
  oldbal?: number | string;
  newbal?: number | string;
  [key: string]: unknown;
}

export interface LegitdatawayPlan {
  id: string | number;
  networkId?: string | number;
  network?: string | number;
  planName?: string;
  planType?: string;
  amount?: number;
  validity?: string | number;
  raw?: unknown;
}

export interface LegitdatawayCatalogResult {
  success: boolean;
  type: "data";
  plans: LegitdatawayPlan[];
  raw: unknown;
}
