import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Cravyr',
  slug: 'cravyr',
  version: '0.0.1',
  orientation: 'portrait',
  // icon: './assets/icon.png',  // TODO: add app icon
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#f97316',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.cravyr.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Cravyr uses your location to find restaurants near you and show distance information.',
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#f97316',
    },
    package: 'com.cravyr.app',
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Cravyr uses your location to find restaurants near you and show distance information.',
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME,
      },
    ],
  ],
  scheme: 'cravyr',
  experiments: {
    typedRoutes: true,
  },
});
