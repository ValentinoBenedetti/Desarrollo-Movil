import React, { forwardRef, useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, style, onFocus, onBlur, ...rest }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputFocused,
            error && styles.inputError,
            rest.editable === false && styles.inputDisabled,
          ]}
        >
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor="#898989"
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...rest}
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#343434',
    marginBottom: 8,
  },
  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: '#CACACA',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputFocused: {
    borderColor: '#281C9D',
  },
  inputError: {
    borderColor: '#FF4267',
  },
  inputDisabled: {
    backgroundColor: '#F2F1F9',
    opacity: 0.6,
  },
  input: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#343434',
    flex: 1,
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#FF4267',
    marginTop: 4,
  },
});
