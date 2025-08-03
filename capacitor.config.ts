import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.baekya.protocol',
  appName: '백야 프로토콜',
  webDir: 'webapp',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Device: {
      // UUID 생성을 위한 기기 정보 접근
      permissions: ["ANDROID_ID"]
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK"
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;