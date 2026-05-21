import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useTranslation } from '@/i18n';
import {
  nativeClipboardService,
  type ClipboardService,
} from '@/services/ClipboardService';
import { nativeShareService, type ShareService } from '@/services/ShareService';
import { useTransactionStore } from '@/store/transactionStore';
import type { TransactionDetailScreenProps } from '@/types/navigation';
import { buildTransactionReceipt, getTransactionType } from '@/utils/transaction';

interface UseTransactionDetailViewModelParams {
  route: TransactionDetailScreenProps['route'];
  clipboardService?: ClipboardService;
  shareService?: ShareService;
}

export function useTransactionDetailViewModel({
  route,
  clipboardService = nativeClipboardService,
  shareService = nativeShareService,
}: UseTransactionDetailViewModelParams) {
  const { t } = useTranslation();
  const [isCopySnackbarVisible, setIsCopySnackbarVisible] = useState(false);
  const transaction = useTransactionStore((state) =>
    state.getTransactionByRefId(route.params.refId),
  );
  const transactionType = transaction ? getTransactionType(transaction.amount) : undefined;

  useEffect(() => {
    if (!isCopySnackbarVisible) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setIsCopySnackbarVisible(false);
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [isCopySnackbarVisible]);

  const copyReferenceId = useCallback(async () => {
    if (!transaction) {
      return;
    }

    const didCopy = await clipboardService.copyText(transaction.refId);

    if (didCopy) {
      setIsCopySnackbarVisible(true);
    }
  }, [clipboardService, transaction]);

  const shareTransaction = useCallback(async () => {
    if (!transaction) {
      return;
    }

    try {
      await shareService.share(buildTransactionReceipt(transaction, t));
    } catch {
      Alert.alert(t.detail.unableToShareTitle, t.detail.unableToShareMessage);
    }
  }, [shareService, t, transaction]);

  return {
    transaction,
    transactionType,
    isCopySnackbarVisible,
    actions: {
      copyReferenceId,
      shareTransaction,
    },
  };
}
