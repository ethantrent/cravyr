const fs = require('fs');
const path = require('path');

const filePath = path.resolve(
  __dirname,
  '../node_modules/@react-native/gradle-plugin/settings.gradle.kts',
);

if (!fs.existsSync(filePath)) {
  console.log('[patch] @react-native/gradle-plugin settings.gradle.kts not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('foojay-resolver-convention')) {
  console.log('[patch] foojay-resolver-convention already removed, skipping');
  process.exit(0);
}

content = content.replace(
  /plugins\s*\{\s*id\("org\.gradle\.toolchains\.foojay-resolver-convention"\)\.version\("[^"]+"\)\s*\}/,
  '// foojay-resolver-convention removed — incompatible with Gradle 9 (IBM_SEMERU removed)',
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('[patch] Removed foojay-resolver-convention from @react-native/gradle-plugin');
