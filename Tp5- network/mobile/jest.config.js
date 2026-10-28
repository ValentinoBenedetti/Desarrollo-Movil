module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|react-native-background-fetch|@notifee/react-native|react-native-maps|react-native-share|react-native-sqlite-storage|react-native-tcp-socket|react-native-svg|react-native-geolocation-service)/',
  ],
};
