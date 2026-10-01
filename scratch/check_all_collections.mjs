import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const collectionsToCheck = ['operations', 'chat_messages', 'users', 'user_locations', 'findings'];

async function checkAll() {
  for (const colName of collectionsToCheck) {
    const snap = await getDocs(collection(db, colName));
    console.log(`Collection: ${colName} -> ${snap.size} documents`);
    if (colName === 'operations') {
      snap.docs.forEach(d => console.log('  Op:', d.id, d.data().title, d.data().status));
    }
    if (colName === 'findings') {
      snap.docs.forEach(d => console.log('  Finding:', d.id, d.data().title, d.data().operationId));
    }
  }
  process.exit(0);
}
checkAll();
