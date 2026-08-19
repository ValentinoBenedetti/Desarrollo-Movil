import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ContadorScreen from './src/screens/ContadorScreen';
import ToDoScreen from './src/screens/ToDoScreen';
import { StatusBar } from 'expo-status-bar';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2196F3',
          tabBarInactiveTintColor: 'gray',
        }}
      >
        <Tab.Screen 
          name="Contador" 
          component={ContadorScreen} 
          options={{ title: 'Ej 01: Contador' }} 
        />
        <Tab.Screen 
          name="ToDo" 
          component={ToDoScreen} 
          options={{ title: 'Ej 02: To-Do List' }} 
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
