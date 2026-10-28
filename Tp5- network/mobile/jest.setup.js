/* eslint-env jest */
import { NativeModules } from 'react-native';

// 1. Native Modules & Permissions Mocking
NativeModules.CellularInfoModule = {
  getCellularInfo: jest.fn().mockResolvedValue({
    carrier: 'Claro AR',
    radioType: 'LTE',
    generation: '4G',
    signalStrengthDbm: -85,
    signalLevel: 3,
    isRegistered: true,
  }),
};

const { PermissionsAndroid } = require('react-native');
PermissionsAndroid.requestMultiple = jest.fn().mockResolvedValue({
  'android.permission.ACCESS_FINE_LOCATION': 'granted',
  'android.permission.ACCESS_COARSE_LOCATION': 'granted',
  'android.permission.READ_PHONE_STATE': 'granted',
  'android.permission.POST_NOTIFICATIONS': 'granted',
});
PermissionsAndroid.request = jest.fn().mockResolvedValue('granted');
PermissionsAndroid.check = jest.fn().mockResolvedValue(true);


// 2. NetInfo Mock
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback) => {
    callback({
      type: 'cellular',
      isConnected: true,
      isInternetReachable: true,
      details: {
        isConnectionExpensive: true,
        cellularGeneration: '4g',
        carrier: 'Claro AR',
      },
    });
    return jest.fn();
  }),
  fetch: jest.fn().mockResolvedValue({
    type: 'cellular',
    isConnected: true,
    isInternetReachable: true,
    details: {
      isConnectionExpensive: true,
      cellularGeneration: '4g',
      carrier: 'Claro AR',
    },
  }),
}));

// 3. BackgroundFetch Mock
jest.mock('react-native-background-fetch', () => ({
  configure: jest.fn((config, onEvent) => {
    return Promise.resolve(2);
  }),
  finish: jest.fn(),
  status: jest.fn((callback) => callback(2)),
  scheduleTask: jest.fn().mockResolvedValue(true),
}));

// 4. Notifee Mock
jest.mock('@notifee/react-native', () => ({
  createChannel: jest.fn().mockResolvedValue('qos_alerts'),
  displayNotification: jest.fn().mockResolvedValue('notif_123'),
  requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
  },
}));

// 5. Geolocation Service Mock
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn((success) => {
    success({
      coords: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 12.5,
        altitude: 25.0,
        speed: 1.2,
      },
      timestamp: Date.now(),
    });
  }),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

// 6. React Native Maps Mock
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = (props) => <View {...props} testID="mock-map-view">{props.children}</View>;
  MockMapView.Marker = (props) => <View {...props} testID="mock-marker">{props.children}</View>;
  MockMapView.Circle = (props) => <View {...props} testID="mock-circle" />;
  MockMapView.Heatmap = (props) => <View {...props} testID="mock-heatmap" />;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMapView.Marker,
    Circle: MockMapView.Circle,
    Heatmap: MockMapView.Heatmap,
    PROVIDER_DEFAULT: 'default',
    PROVIDER_GOOGLE: 'google',
  };
});

// 7. React Native Share Mock
jest.mock('react-native-share', () => ({
  open: jest.fn().mockResolvedValue({ success: true }),
}));

// 8. SQLite Storage Mock
jest.mock('react-native-sqlite-storage', () => ({
  enablePromise: jest.fn(),
  openDatabase: jest.fn().mockResolvedValue({
    executeSql: jest.fn().mockResolvedValue([
      {
        rows: {
          length: 0,
          item: () => null,
        },
      },
    ]),
  }),
}));

// 9. TCP Socket Mock
jest.mock('react-native-tcp-socket', () => {
  const EventEmitter = require('events');
  return {
    createConnection: jest.fn((options, callback) => {
      const emitter = new EventEmitter();
      emitter.destroy = jest.fn();
      emitter.setTimeout = jest.fn();
      setTimeout(() => {
        if (callback) callback();
      }, 5);
      return emitter;
    }),
  };
});

// 10. React Native SVG Mock
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockSvg = (props) => <View {...props}>{props.children}</View>;
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Circle: MockSvg,
    Rect: MockSvg,
    Path: MockSvg,
    Text: MockSvg,
    G: MockSvg,
    Line: MockSvg,
    Polyline: MockSvg,
  };
});

// 11. React Native WebView Mock
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: (props) => <View testID="webview-mock" {...props} />,
    default: (props) => <View testID="webview-mock" {...props} />,
  };
});

