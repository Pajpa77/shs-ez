const fs = require('fs');

function bump(file, regex, replacement) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(regex, replacement);
  fs.writeFileSync(file, c);
}

bump('package.json', /"version": "5\.0\.0"/, `"version": "5.1.0"`);
bump('src/components/AdminDashboard.tsx', /Release v5\.0/, 'Release v5.1');
bump('src/components/LoginScreen.tsx', /v5\.0/, 'v5.1');

console.log('Bumped version to 5.1');
