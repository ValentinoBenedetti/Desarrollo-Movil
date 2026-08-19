import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useThemeStyles, Theme } from '../hooks/useThemeStyles';

export default function ContadorScreen() {
  const [count, setCount] = useState<number>(0);
  const [theme, setTheme] = useState<Theme>('light');

  const styles = useThemeStyles(theme);

  const handleIncrement = () => {
    if (count >= 10) {
      Alert.alert('Aviso', 'El contador ha llegado a su límite de 10.');
      return;
    }
    setCount(prev => prev + 1);
  };

  const handleReset = () => {
    setCount(0);
  };

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.text}>Tema actual: {theme.toUpperCase()}</Text>
        
        <Text style={styles.counterText}>{count}</Text>

        <Pressable 
          style={({ pressed }) => [
            styles.button,
            count >= 10 && styles.disabledButton,
            { opacity: pressed ? 0.7 : 1 }
          ]} 
          onPress={handleIncrement}
          disabled={count >= 10}
        >
          <Text style={styles.buttonText}>+1</Text>
        </Pressable>

        <Pressable 
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed ? 0.7 : 1 }
          ]} 
          onPress={handleReset}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </Pressable>

        <Pressable 
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed ? 0.7 : 1, marginTop: 20 }
          ]} 
          onPress={handleToggleTheme}
        >
          <Text style={styles.buttonText}>Toggle Tema</Text>
        </Pressable>
      </View>
    </View>
  );
}


