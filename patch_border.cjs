const fs = require('fs');

let code = fs.readFileSync('src/components/TacticalMap.tsx', 'utf8');

code = code.replace(
  /const avatarBorderClass = \(!isOpRunning && currentOperation\?\.status !== 'paused'\)[\s\S]*?\? 'border-white ring-2 ring-white\/50'[\s\S]*?: isPaused/,
  'const avatarBorderClass = isPaused'
);

fs.writeFileSync('src/components/TacticalMap.tsx', code);
console.log('Fixed avatar border.');

let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '4.7.0';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('Bumped to 4.7.0');
