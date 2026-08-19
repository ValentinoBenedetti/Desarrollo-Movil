import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

export type Theme = 'light' | 'dark';

interface ThemeStyles {
  container: ViewStyle;
  card: ViewStyle;
  text: TextStyle;
  button: ViewStyle;
  buttonText: TextStyle;
  counterText: TextStyle;
  disabledButton: ViewStyle;
}

export const useThemeStyles = (theme: Theme): ThemeStyles => {
  const isDark = theme === 'dark';

  return StyleSheet.create<ThemeStyles>({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#121212' : '#F5F5F5',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
      borderRadius: 16,
      padding: 30,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.5 : 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    text: {
      color: isDark ? '#FFFFFF' : '#333333',
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 20,
    },
    counterText: {
      color: isDark ? '#64B5F6' : '#2196F3',
      fontSize: 72,
      fontWeight: 'bold',
      marginVertical: 20,
    },
    button: {
      backgroundColor: isDark ? '#BB86FC' : '#6200EE',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      marginVertical: 8,
      width: '100%',
      alignItems: 'center',
    },
    disabledButton: {
      backgroundColor: isDark ? '#555555' : '#CCCCCC',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
};

