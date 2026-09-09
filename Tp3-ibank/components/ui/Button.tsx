import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ title, loading, variant = 'primary', disabled, style, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary';
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? styles.primary : styles.outline,
        disabled && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#281C9D'} />
      ) : (
        <Text
          style={[
            styles.text,
            isPrimary ? styles.textPrimary : styles.textOutline,
            disabled && styles.textDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 100, // Pill shape according to Figma
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: '#281C9D',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#281C9D',
  },
  disabled: {
    backgroundColor: '#CACACA',
    borderColor: '#CACACA',
  },
  text: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textOutline: {
    color: '#281C9D',
  },
  textDisabled: {
    color: '#898989',
  },
});
