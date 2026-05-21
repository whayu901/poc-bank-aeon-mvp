import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import { TransactionCard } from '@/components/TransactionCard';
import type { Transaction } from '@/types/transaction';

const transaction: Transaction = {
  refId: '123ABC',
  transferDate: '2024-10-15T12:34:56Z',
  recipientName: 'John Doe',
  transferName: 'Salary Payment',
  amount: 1500,
};

describe('TransactionCard', () => {
  it('renders transfer details', () => {
    const screen = render(<TransactionCard transaction={transaction} onPress={jest.fn()} />);

    expect(screen.getByText('Salary Payment')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('+ RM 1,500.00')).toBeTruthy();
    expect(screen.getByText('Ref 123ABC')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const screen = render(<TransactionCard transaction={transaction} onPress={onPress} />);

    fireEvent.press(screen.getByTestId('transaction-card-123ABC'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
