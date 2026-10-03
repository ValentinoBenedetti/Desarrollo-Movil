import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plots"
        options={{
          title: 'Lotes',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'leaf' : 'leaf-outline'} size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Cuenta',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size || 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
