import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BackgroundTaskService } from './src/services/background/backgroundTaskService';
import { GeolocationService } from './src/services/geo/geolocationService';
import { CellularInfoService } from './src/services/native/CellularInfo';
import { netInfoService } from './src/services/network/netInfoService';
import { NotificationService } from './src/services/notifications/notificationService';
import { AnalyticsScreen } from './src/ui/screens/AnalyticsScreen';
import { DashboardScreen } from './src/ui/screens/DashboardScreen';
import { ExportScreen } from './src/ui/screens/ExportScreen';
import { MapScreen } from './src/ui/screens/MapScreen';
import { theme } from './src/ui/theme';
import { requestAndroidPermissions } from './src/utils/permissions';
import { useNetworkStore } from './src/core/store/useNetworkStore';

type TabType = 'dashboard' | 'map' | 'analytics' | 'export';

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  useEffect(() => {
    const bootstrap = async () => {
      // 1. Solicitar permisos dinámicos (Android / iOS)
      await requestAndroidPermissions();

      // 2. Inicializar listeners reactivos de NetInfo
      netInfoService.startListening();

      // 3. Inicializar canal de notificaciones locales
      await NotificationService.init();

      // 4. Inicializar tareas de fondo (Background Fetch)
      await BackgroundTaskService.initBackgroundFetch();

      // 5. Iniciar rastreo GPS de alta precisión
      GeolocationService.startTracking(5000, 10);

      // 6. Primera lectura nativa de señal celular
      const cellular = await CellularInfoService.getCellularInfo();
      useNetworkStore.getState().setCellularInfo(cellular);
    };

    bootstrap();

    return () => {
      netInfoService.stopListening();
      GeolocationService.stopTracking();
      BackgroundTaskService.stopLiveSampling();
    };
  }, []);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'map':
        return <MapScreen />;
      case 'analytics':
        return <AnalyticsScreen />;
      case 'export':
        return <ExportScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Monitor', icon: '📶' },
    { id: 'map', label: 'Mapa', icon: '🗺️' },
    { id: 'analytics', label: 'Analíticas', icon: '📊' },
    { id: 'export', label: 'Ajustes', icon: '⚙️' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header Superior de la App */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Network QoS Monitor</Text>
          <Text style={styles.headerSubtitle}>Telecom & Data Networks • FCyT</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>PRO</Text>
        </View>
      </View>

      {/* Contenido Principal de la Pantalla Activa */}
      <View style={styles.screenContainer}>{renderActiveScreen()}</View>

      {/* Tab Bar Inferior */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.surfaceBorder,
    borderBottomWidth: 1,
    backgroundColor: theme.colors.background,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 1,
    fontWeight: '500',
  },
  headerBadge: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  headerBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.surfaceBorder,
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabButtonActive: {
    borderTopColor: theme.colors.primary,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});

export default App;
