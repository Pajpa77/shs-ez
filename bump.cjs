const fs = require('fs');

let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '4.9.1';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

let gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
gradle = gradle.replace(/versionName ".*"/, 'versionName "4.9.1"');
fs.writeFileSync('android/app/build.gradle', gradle);

let admin = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');
admin = admin.replace(/v4\.9\.0/g, 'v4.9.1');
fs.writeFileSync('src/components/AdminDashboard.tsx', admin);

let login = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');
login = login.replace(/v4\.9\.0/g, 'v4.9.1');
fs.writeFileSync('src/components/LoginScreen.tsx', login);

console.log('Version bumped to 4.9.1');
