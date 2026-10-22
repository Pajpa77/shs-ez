import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const docRef = doc(db, 'system_config', 'app_version');
  const releaseData = {
    version: '6.6.0',
    apkUrl: 'https://shs-ea.web.app/shs-ez-latest.apk',
    releaseDate: '2026-10-22',
    releaseNotes: 'v6.6.0: Behebt Synchronisationsfehler bei gelöschten Einsätzen & automatische Abmeldung inaktiver Einsatzkräfte. Update-Service & Gerät merken aktiv.',
    fileSizeMb: 'ca. 31 MB',
    updatedAt: new Date().toISOString()
  };

  await setDoc(docRef, releaseData, { merge: true });
  console.log('Successfully written system_config/app_version to Firestore:', releaseData);
  process.exit(0);
}

main().catch(err => {
  console.error('Error writing version to Firestore:', err);
  process.exit(1);
});
