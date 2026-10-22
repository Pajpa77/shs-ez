import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const docRef = doc(db, 'system_config', 'app_version');
  const releaseData = {
    version: '7.1.0',
    apkUrl: 'https://shs-ea.web.app/shs-ez-latest.apk',
    releaseDate: '2026-10-23',
    releaseNotes: 'v7.1.0: Interaktives Punkt-für-Punkt Sektorzeichnen in Hauptapp & Jugendgruppe (Verschieben, Löschen, Zwischenpunkte, Flächenberechnung), Trackingtest lokale PDF-Sicherung, WakeLock/GPS-Aktivierung bei Bereit & Admin-Übersicht für angemeldete Jugendmitglieder.',
    fileSizeMb: 'ca. 11 MB',
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
