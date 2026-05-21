import { Share } from 'react-native';

export interface ShareService {
  share(message: string): Promise<void>;
}

export const nativeShareService: ShareService = {
  async share(message: string) {
    await Share.share({ message });
  },
};
