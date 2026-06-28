import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmountText } from "@/components/AmountText";
import { CopyIcon } from "@/components/CopyIcon";
import { InfoRow } from "@/components/InfoRow";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Snackbar } from "@/components/Snackbar";
import { TransactionBadge } from "@/components/TransactionBadge";
import { useTranslation } from "@/i18n";
import type { ClipboardService } from "@/services/ClipboardService";
import { createTransactionDetailStyles } from "@/screens/transactionDetail/styles";
import { useTransactionDetailViewModel } from "@/screens/transactionDetail/useTransactionDetailViewModel";
import type { ShareService } from "@/services/ShareService";
import { useAppTheme } from "@/theme/useAppTheme";
import type { TransactionDetailScreenProps } from "@/types/navigation";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";

interface TransactionDetailScreenInnerProps extends TransactionDetailScreenProps {
  clipboardService?: ClipboardService;
  shareService?: ShareService;
}

export function TransactionDetailScreen({
  clipboardService,
  route,
  shareService,
}: TransactionDetailScreenInnerProps) {
  const { colors, spacing } = useAppTheme();
  const { t } = useTranslation();
  const styles = createTransactionDetailStyles(colors, spacing);
  const viewModel = useTransactionDetailViewModel({
    clipboardService,
    route,
    shareService,
  });
  const { transaction, transactionType, actions, isLoading, error } = viewModel;

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundCard} testID="transaction-loading">
          <Text style={styles.notFoundTitle}>Loading...</Text>
          <Text style={styles.notFoundText}>
            Fetching transaction details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if fetching failed
  if (error || (!transaction && !isLoading)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundCard} testID="transaction-not-found">
          <Text style={styles.notFoundTitle}>{t.detail.notFoundTitle}</Text>
          <Text style={styles.notFoundText}>
            {t.detail.notFoundDescription}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show not found if no transaction after loading
  if (!transaction || !transactionType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundCard} testID="transaction-not-found">
          <Text style={styles.notFoundTitle}>{t.detail.notFoundTitle}</Text>
          <Text style={styles.notFoundText}>
            {t.detail.notFoundDescription}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        testID="transaction-detail-screen"
      >
        <View style={styles.receiptCard}>
          <View style={styles.amountBlock}>
            <Text style={styles.receiptLabel}>{t.detail.receiptAmount}</Text>
            <AmountText
              amount={transaction.amount}
              size="large"
              testID="detail-amount"
            />
            <Text style={styles.transferName}>{transaction.transferName}</Text>
            <TransactionBadge type={transactionType} />
          </View>

          <View style={styles.divider} />

          <InfoRow
            actionAccessibilityLabel={t.detail.copyReferenceId}
            actionIcon={<CopyIcon />}
            actionTestID="copy-reference-id-button"
            label={t.detail.referenceId}
            onActionPress={() => void actions.copyReferenceId()}
            value={transaction.refId}
            testID="detail-ref-id"
          />
          <InfoRow
            label={t.detail.recipient}
            value={transaction.recipientName}
            testID="detail-recipient"
          />
          <InfoRow
            label={t.detail.transferDate}
            value={formatDate(transaction.transferDate)}
          />
          <InfoRow
            label={t.detail.transactionType}
            value={t.transactionType[transactionType]}
          />
          <InfoRow
            label={t.common.amount}
            value={formatCurrency(transaction.amount)}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          accessibilityLabel={t.detail.shareTransaction}
          label={t.detail.shareTransaction}
          onPress={() => void actions.shareTransaction()}
          testID="share-transaction-button"
        />
      </View>

      <Snackbar
        message={t.detail.referenceIdCopied}
        visible={viewModel.isCopySnackbarVisible}
        testID="copy-reference-snackbar"
      />
    </SafeAreaView>
  );
}
