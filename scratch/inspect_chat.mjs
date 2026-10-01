import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'chat_messages'));
  console.log(`Total messages in Firestore: ${snap.size}`);
  const breakdown = {};
  snap.docs.forEach(d => {
    const data = d.data();
    const ch = data.channel || 'none';
    breakdown[ch] = (breakdown[ch] || 0) + 1;
  });
  console.log('Breakdown by channel:', breakdown);
  process.exit(0);
}
run();
