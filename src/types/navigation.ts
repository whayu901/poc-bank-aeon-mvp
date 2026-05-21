import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  TransactionList: undefined;
  TransactionDetail: {
    refId: string;
  };
};

export type TransactionListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TransactionList'
>;

export type TransactionDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TransactionDetail'
>;
