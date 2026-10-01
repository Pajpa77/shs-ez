import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function check() {
  const snap = await getDocs(collection(db, 'chat_messages'));
  console.log('Total chat_messages in Firestore:', snap.size);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log('-', d.id, '| channel:', data.channel, '| alert:', data.isAlert, '|', data.text?.slice(0, 60));
  });
  process.exit(0);
}
check();
