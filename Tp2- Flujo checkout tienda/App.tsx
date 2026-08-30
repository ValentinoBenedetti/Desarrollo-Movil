import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ShoppingCartScreen from './src/screens/ShoppingCartScreen';
import SecurePaymentScreen from './src/screens/SecurePaymentScreen';
import { StatusBar } from 'expo-status-bar';
import { CartProvider } from './src/context/CartContext';
import { PaymentProvider } from './src/context/PaymentContext';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <CartProvider>
      <PaymentProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ShoppingCart" component={ShoppingCartScreen} />
            <Stack.Screen name="SecurePayment" component={SecurePaymentScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaymentProvider>
    </CartProvider>
  );
}
