import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import type { Language } from '@/store/preferencesStore';
import type { TransactionListStyles } from '@/screens/transactionList/styles';

interface TransactionListHeaderProps {
  language: Language;
  onChangeLanguage: (language: Language) => void;
  styles: TransactionListStyles;
}

export function TransactionListHeader({
  language,
  onChangeLanguage,
  styles,
}: TransactionListHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>{t.list.title}</Text>
        <View accessibilityLabel={t.language.toggleLabel} style={styles.languageToggle}>
          {(['en', 'ms'] as const).map((option) => {
            const isSelected = language === option;
            const label = option === 'en' ? t.language.english : t.language.bahasaMalaysia;

            return (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                key={option}
                onPress={() => onChangeLanguage(option)}
                style={[styles.languageOption, isSelected && styles.languageOptionSelected]}
                testID={`language-toggle-${option}`}>
                <Text
                  style={[
                    styles.languageOptionText,
                    isSelected && styles.languageOptionTextSelected,
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={styles.subtitle}>{t.list.subtitle}</Text>
    </View>
  );
}
