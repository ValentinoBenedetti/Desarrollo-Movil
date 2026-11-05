import { Buffer } from 'buffer';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

AppRegistry.registerComponent(appName, () => App);

