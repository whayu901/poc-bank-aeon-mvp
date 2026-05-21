import type { Transaction } from '@/types/transaction';

export const mockTransactionsResponse: { data: Transaction[] } = {
  data: [
    {
      refId: '123ABC',
      transferDate: '2024-10-15T12:34:56Z',
      recipientName: 'John Doe',
      transferName: 'Salary Payment',
      amount: 1500.0,
    },
    {
      refId: '456DEF',
      transferDate: '2024-09-21T09:12:45Z',
      recipientName: 'Jane Smith',
      transferName: 'Invoice Payment',
      amount: 2300.75,
    },
    {
      refId: '789GHI',
      transferDate: '2024-10-05T16:18:30Z',
      recipientName: 'Robert Brown',
      transferName: 'Refund',
      amount: -500.0,
    },
    {
      refId: '101JKL',
      transferDate: '2024-08-30T11:47:22Z',
      recipientName: 'Emily Davis',
      transferName: 'Bonus Payment',
      amount: 1200.0,
    },
  ],
};
