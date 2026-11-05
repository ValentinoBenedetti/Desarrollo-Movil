import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { Text } from 'react-native';
import { DiagnosticScreen } from '../screens/DiagnosticScreen';
import { DiscoveryScreen } from '../screens/DiscoveryScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { InstallationScreen } from '../screens/InstallationScreen';
import { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const SuiteDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0f172a',
    card: '#020617',
    text: '#f8fafc',
    border: '#1e293b',
    primary: '#38bdf8',
  },
};

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer theme={SuiteDarkTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#020617',
            borderTopColor: '#1e293b',
            height: 58,
            paddingBottom: 6,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#38bdf8',
          tabBarInactiveTintColor: '#64748b',
          tabBarIcon: ({ color }) => {
            const icons: Record<keyof RootTabParamList, string> = {
              Discovery: 'RADAR',
              Diagnostic: 'SNMP/SSH',
              Installation: 'INSTALL',
              History: 'OUTBOX',
            };
            return (
              <Text style={{ color, fontSize: 10, fontWeight: '800' }}>
                {icons[route.name]}
              </Text>
            );
          },
        })}>
        <Tab.Screen
          name="Discovery"
          component={DiscoveryScreen}
          options={{ title: 'LAN Radar' }}
        />
        <Tab.Screen
          name="Diagnostic"
          component={DiagnosticScreen}
          options={{ title: 'Diagnostics' }}
        />
        <Tab.Screen
          name="Installation"
          component={InstallationScreen}
          options={{ title: 'Install & PDF' }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'Offline Store' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

