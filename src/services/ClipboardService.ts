import * as Clipboard from 'expo-clipboard';

export interface ClipboardService {
  copyText(value: string): Promise<boolean>;
}

export const nativeClipboardService: ClipboardService = {
  async copyText(value: string) {
    return Clipboard.setStringAsync(value);
  },
};
