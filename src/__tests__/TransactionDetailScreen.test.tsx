import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Share } from 'react-native';

import { TransactionDetailScreen } from '@/screens/TransactionDetailScreen';
import type { ClipboardService } from '@/services/ClipboardService';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTransactionStore } from '@/store/transactionStore';
import type { TransactionDetailScreenProps } from '@/types/navigation';

jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as TransactionDetailScreenProps['navigation'];

function renderDetail(refId: string, clipboardService?: ClipboardService) {
  return render(
    <TransactionDetailScreen
      clipboardService={clipboardService}
      navigation={navigation}
      route={{ key: 'TransactionDetail', name: 'TransactionDetail', params: { refId } }}
    />,
  );
}

describe('TransactionDetailScreen', () => {
  beforeEach(() => {
    useTransactionStore.setState({
      transactions: [
        {
          refId: '123ABC',
          transferDate: '2024-10-15T12:34:56Z',
          recipientName: 'John Doe',
          transferName: 'Salary Payment',
          amount: 1500,
        },
      ],
      isLoading: false,
      error: null,
    });
    usePreferencesStore.setState({ language: 'en' });
    jest.clearAllMocks();
  });

  it('renders transaction details correctly', () => {
    const screen = renderDetail('123ABC');

    expect(screen.getAllByText('+ RM 1,500.00')).toHaveLength(2);
    expect(screen.getByText('Salary Payment')).toBeTruthy();
    expect(screen.getByText('123ABC')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getAllByText('Incoming')).toHaveLength(2);
  });

  it('shows Transaction not found for unknown refId', () => {
    const screen = renderDetail('UNKNOWN');

    expect(screen.getByText('Transaction not found')).toBeTruthy();
  });

  it('calls Share.share from the share button', async () => {
    const screen = renderDetail('123ABC');

    fireEvent.press(screen.getByTestId('share-transaction-button'));

    await waitFor(() => expect(Share.share).toHaveBeenCalledTimes(1));
    expect(Share.share).toHaveBeenCalledWith({
      message: expect.stringContaining('Reference ID: 123ABC'),
    });
  });

  it('localizes share receipt labels for Bahasa Malaysia', async () => {
    usePreferencesStore.setState({ language: 'ms' });
    const screen = renderDetail('123ABC');

    fireEvent.press(screen.getByTestId('share-transaction-button'));

    await waitFor(() => expect(Share.share).toHaveBeenCalledTimes(1));
    expect(Share.share).toHaveBeenCalledWith({
      message: expect.stringContaining('ID Rujukan: 123ABC'),
    });
  });

  it('copies reference ID and shows snackbar', async () => {
    const clipboardService = {
      copyText: jest.fn<ClipboardService['copyText']>().mockResolvedValue(true),
    };
    const screen = renderDetail('123ABC', clipboardService);

    fireEvent.press(screen.getByTestId('copy-reference-id-button'));

    await waitFor(() => expect(clipboardService.copyText).toHaveBeenCalledWith('123ABC'));
    expect(screen.getByTestId('copy-reference-snackbar')).toBeTruthy();
    expect(screen.getByText('Reference ID copied')).toBeTruthy();
  });
});
