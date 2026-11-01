import {
  purchaseAirtime,
  purchaseData,
} from "./client";

export const legitdataway = {
  name: "LEGITDATAWAY",

  async data(params: {
    network: number;
    phone: string;
    dataPlan: number;
    requestId: string;
  }) {
    return purchaseData({
      network: params.network,
      phone: params.phone,
      data_plan: params.dataPlan,
      requestId: params.requestId,
    });
  },

  async airtime(params: {
    network: number;
    phone: string;
    amount: number;
    requestId: string;
  }) {
    return purchaseAirtime({
      network: params.network,
      phone: params.phone,
      amount: params.amount,
      requestId: params.requestId,
    });
  },
};