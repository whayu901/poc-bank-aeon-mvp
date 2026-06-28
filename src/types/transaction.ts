export interface Transaction {
  refId: string;
  transferDate: string;
  recipientName: string;
  transferName: string;
  amount: number;
  id?: any;
  type?: any;
}

export type TransactionType = "incoming" | "outgoing";
