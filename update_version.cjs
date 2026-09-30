const fs = require('fs');

// 1. Update package.json
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '5.0.0';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

// 2. Update android/app/build.gradle
let gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
gradle = gradle.replace(/versionName\s+"[^"]+"/g, 'versionName "5.0.0"');
gradle = gradle.replace(/versionCode\s+(\d+)/g, (match, p1) => {
  const code = parseInt(p1) + 1;
  return 'versionCode ' + code;
});
fs.writeFileSync('android/app/build.gradle', gradle);

console.log('Version updated to 4.9.0');
