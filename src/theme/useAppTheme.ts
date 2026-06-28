import { useMemo } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export function useAppTheme() {
  const colorScheme = useColorScheme();

  // Memoize the theme object to prevent creating new object on every render
  return useMemo(() => {
    const colors = colorScheme === "dark" ? darkColors : lightColors;
    return {
      colors,
      colorScheme: colorScheme === "dark" ? "dark" : "light",
      spacing,
      typography,
    };
  }, [colorScheme]);
}
