const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

if (!app.includes('CapacitorApp.addListener')) {
  app = app.replace('import React', "import { App as CapacitorApp } from '@capacitor/app';\nimport { Capacitor } from '@capacitor/core';\nimport React");

  const listener = `
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          showConfirmModal({
            title: 'App beenden?',
            message: 'Möchten Sie SHS-EZ wirklich schließen?',
            confirmLabel: 'Beenden',
            cancelLabel: 'Zurück',
            isDanger: true,
            onConfirm: () => {
              CapacitorApp.exitApp();
            }
          });
        }
      });
    }
  }, [showConfirmModal]);
`;
  
  app = app.replace('const [isSearchTeamsModalOpen, setIsSearchTeamsModalOpen] = useState(false);', 'const [isSearchTeamsModalOpen, setIsSearchTeamsModalOpen] = useState(false);\n' + listener);
  fs.writeFileSync('src/App.tsx', app);
}
console.log("App.tsx patched");
