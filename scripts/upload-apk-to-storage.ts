import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as fs from 'fs';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

async function main() {
  console.log('Initializing Firebase App for Storage Upload v6.7.0...');
  const app = initializeApp(firebaseConfig);
  const storage = getStorage(app);

  const apkPath = 'android/app/release/SHS-EZ_v6.7.apk';
  if (!fs.existsSync(apkPath)) {
    throw new Error('APK not found at ' + apkPath);
  }

  const apkBuffer = fs.readFileSync(apkPath);
  console.log(`Loaded APK v6.7.0 (${apkBuffer.length} bytes / ${(apkBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);

  const metadata = {
    contentType: 'application/vnd.android.package-archive',
    customMetadata: {
      version: '6.7.0',
      uploadedAt: new Date().toISOString()
    }
  };

  // 1. Upload as apk/shs-ez-latest.apk
  console.log('Uploading to apk/shs-ez-latest.apk...');
  const latestRef = ref(storage, 'apk/shs-ez-latest.apk');
  await uploadBytes(latestRef, apkBuffer, metadata);
  const latestUrl = await getDownloadURL(latestRef);
  console.log('Successfully uploaded latest APK! Download URL:', latestUrl);

  // 2. Upload as apk/SHS-EZ_v6.7.apk
  console.log('Uploading to apk/SHS-EZ_v6.7.apk...');
  const v67Ref = ref(storage, 'apk/SHS-EZ_v6.7.apk');
  await uploadBytes(v67Ref, apkBuffer, metadata);
  const v67Url = await getDownloadURL(v67Ref);
  console.log('Successfully uploaded v6.7 APK! Download URL:', v67Url);

  process.exit(0);
}

main().catch(err => {
  console.error('Failed to upload APK to Firebase Storage:', err);
  process.exit(1);
});
