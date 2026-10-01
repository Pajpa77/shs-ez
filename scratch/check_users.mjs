import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function checkUsers() {
  const snap = await getDocs(collection(db, 'users'));
  console.log(`Total users in Firestore: ${snap.size}`);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`- ${d.id} (${data.name || data.username}): isActive=${data.isActive}, activeSessionId=${data.activeSessionId}`);
  });
  process.exit(0);
}
checkUsers();
