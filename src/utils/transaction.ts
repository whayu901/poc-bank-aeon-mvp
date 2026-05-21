import type { Translation } from "@/i18n";
import type { Transaction, TransactionType } from "@/types/transaction";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";

export type TransactionTypeFilter = "all" | TransactionType;
export type TransactionDateRangeFilter = "all" | "week" | "month";

export function getTransactionType(amount: number): TransactionType {
  return amount < 0 ? "outgoing" : "incoming";
}

export function sortTransactionsByLatest(
  transactions: Transaction[],
): Transaction[] {
  return [...transactions].sort(
    (current, next) =>
      new Date(next.transferDate).getTime() -
      new Date(current.transferDate).getTime(),
  );
}

export function filterTransactionsByQuery(
  transactions: Transaction[],
  query: string,
): Transaction[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return transactions;
  }

  return transactions.filter((transaction) => {
    const transactionType = getTransactionType(transaction.amount);
    const searchableValues = [
      transaction.transferName,
      transaction.recipientName,
      transaction.refId,
      String(transaction.amount),
      formatCurrency(transaction.amount),
      transactionType,
    ];

    return searchableValues.some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });
}

export function filterTransactionsByType(
  transactions: Transaction[],
  type: TransactionTypeFilter,
): Transaction[] {
  if (type === "all") {
    return transactions;
  }

  return transactions.filter(
    (transaction) => getTransactionType(transaction.amount) === type,
  );
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  dateRange: TransactionDateRangeFilter,
): Transaction[] {
  if (dateRange === "all") {
    return transactions;
  }

  const latestTimestamp = getLatestTransactionTimestamp(transactions);

  if (latestTimestamp === null) {
    return [];
  }

  const rangeInDays = dateRange === "week" ? 7 : 30;
  const startTimestamp = latestTimestamp - rangeInDays * 24 * 60 * 60 * 1000;

  return transactions.filter((transaction) => {
    const transactionTimestamp = new Date(transaction.transferDate).getTime();

    if (Number.isNaN(transactionTimestamp)) {
      return false;
    }

    return (
      transactionTimestamp >= startTimestamp &&
      transactionTimestamp <= latestTimestamp
    );
  });
}

export function getFilteredTransactions({
  transactions,
  query,
  type,
  dateRange,
}: {
  transactions: Transaction[];
  query: string;
  type: TransactionTypeFilter;
  dateRange: TransactionDateRangeFilter;
}): Transaction[] {
  const sortedTransactions = sortTransactionsByLatest(transactions);
  const queryFilteredTransactions = filterTransactionsByQuery(
    sortedTransactions,
    query,
  );
  const typeFilteredTransactions = filterTransactionsByType(
    queryFilteredTransactions,
    type,
  );

  return filterTransactionsByDateRange(typeFilteredTransactions, dateRange);
}

export function buildTransactionReceipt(
  transaction: Transaction,
  t: Translation,
): string {
  const transactionType = getTransactionType(transaction.amount);

  return [
    t.receipt.title,
    "",
    `${t.receipt.referenceId}: ${transaction.refId}`,
    `${t.receipt.transferName}: ${transaction.transferName}`,
    `${t.receipt.recipient}: ${transaction.recipientName}`,
    `${t.receipt.date}: ${formatDate(transaction.transferDate)}`,
    `${t.receipt.amount}: ${formatCurrency(transaction.amount)}`,
    `${t.receipt.type}: ${t.transactionType[transactionType]}`,
  ].join("\n");
}

function getLatestTransactionTimestamp(
  transactions: Transaction[],
): number | null {
  const validTimestamps = transactions
    .map((transaction) => new Date(transaction.transferDate).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp));

  if (validTimestamps.length === 0) {
    return null;
  }

  return Math.max(...validTimestamps);
}
