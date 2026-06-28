const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that adds `use_modular_headers!` to the Podfile.
 * Fixes: "The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
 * `RecaptchaInterop`, which do not define modules."
 */
function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Disable network inspector to prevent SIGSEGV in ExpoRequestCdpInterceptor
      if (!podfile.includes("ENV['EX_DEV_CLIENT_NETWORK_INSPECTOR'] = '0'")) {
        podfile = podfile.replace(
          /prepare_react_native_project!\n/,
          "prepare_react_native_project!\n\nENV['EX_DEV_CLIENT_NETWORK_INSPECTOR'] = '0'\nuse_modular_headers!\n"
        );
      } else if (!podfile.includes('use_modular_headers!')) {
        podfile = podfile.replace(
          /prepare_react_native_project!\n/,
          "prepare_react_native_project!\n\nuse_modular_headers!\n"
        );
      }

      fs.writeFileSync(podfilePath, podfile);

      return config;
    },
  ]);
}

module.exports = withModularHeaders;
