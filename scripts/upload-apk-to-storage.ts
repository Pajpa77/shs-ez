import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function main() {
  console.log('Initializing Firebase App for Storage Upload v7.1.0...');
  const app = initializeApp(firebaseConfig);
  const storage = getStorage(app);
  const db = getFirestore(app);

  const apkPath = fs.existsSync('SHS-EZ_v7.1.apk') 
    ? 'SHS-EZ_v7.1.apk' 
    : fs.existsSync('android/app/release/SHS-EZ_v7.1.apk')
    ? 'android/app/release/SHS-EZ_v7.1.apk'
    : 'android/app/build/outputs/apk/release/app-release.apk';
  if (!fs.existsSync(apkPath)) {
    throw new Error('APK not found at ' + apkPath);
  }

  const apkBuffer = fs.readFileSync(apkPath);
  const sizeMb = (apkBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`Loaded APK v7.1.0 (${apkBuffer.length} bytes / ${sizeMb} MB)...`);

  const metadata = {
    contentType: 'application/vnd.android.package-archive',
    customMetadata: {
      version: '7.1.0',
      uploadedAt: new Date().toISOString()
    }
  };

  // 1. Upload as apk/shs-ez-latest.apk
  console.log('Uploading to apk/shs-ez-latest.apk...');
  const latestRef = ref(storage, 'apk/shs-ez-latest.apk');
  await uploadBytes(latestRef, apkBuffer, metadata);
  const latestUrl = await getDownloadURL(latestRef);
  console.log('Successfully uploaded latest APK! Download URL:', latestUrl);

  // 2. Upload as apk/SHS-EZ_v7.1.apk
  console.log('Uploading to apk/SHS-EZ_v7.1.apk...');
  const v7Ref = ref(storage, 'apk/SHS-EZ_v7.1.apk');
  await uploadBytes(v7Ref, apkBuffer, metadata);
  const v7Url = await getDownloadURL(v7Ref);
  console.log('Successfully uploaded v7.1 APK! Download URL:', v7Url);

  // 3. Update Firestore system_config/app_version
  console.log('Updating Firestore system_config/app_version...');
  const docRef = doc(db, 'system_config', 'app_version');
  const releaseData = {
    version: '7.1.0',
    apkUrl: latestUrl,
    releaseDate: '2026-10-23',
    releaseNotes: 'v7.1.0: Interaktives Punkt-für-Punkt Sektorzeichnen in Hauptapp & Jugendgruppe (Verschieben, Löschen, Zwischenpunkte, Flächenberechnung), Trackingtest lokale PDF-Sicherung, WakeLock/GPS-Aktivierung bei Bereit & Admin-Übersicht für angemeldete Jugendmitglieder.',
    fileSizeMb: `ca. ${Math.round(apkBuffer.length / (1024 * 1024))} MB`,
    updatedAt: new Date().toISOString()
  };
  await setDoc(docRef, releaseData, { merge: true });
  console.log('Successfully updated Firestore release config:', releaseData);

  console.log('=== All Firebase Storage and Firestore updates completed successfully ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to upload APK to Firebase Storage:', err);
  process.exit(1);
});
