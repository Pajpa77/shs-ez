const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

if (!code.includes('import { Capacitor }')) {
  code = code.replace(
    /import React, \{ useState, useEffect, useRef, useMemo \} from 'react';/,
    "import React, { useState, useEffect, useRef, useMemo } from 'react';\nimport { Capacitor } from '@capacitor/core';"
  );
}

const searchStr = '{/* Hosentaschen Modus */}';
const replacement = '{/* Hosentaschen Modus */}\n          {!Capacitor.isNativePlatform() && (';

if (code.includes(searchStr) && !code.includes('!Capacitor.isNativePlatform() && (')) {
  code = code.replace(searchStr, replacement);
  
  // Find the closing button for Hosentaschen Modus
  const endSearch = '<span className="sm:hidden">LOCK</span>\n          </button>';
  const endReplacement = '<span className="sm:hidden">LOCK</span>\n          </button>\n          )}';
  
  code = code.replace(endSearch, endReplacement);
  fs.writeFileSync('src/components/Navbar.tsx', code);
  console.log('Patched Navbar');
} else {
  console.log('Not found or already patched');
}
