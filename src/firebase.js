import {getApp,getApps,initializeApp} from 'firebase/app';
import {connectAuthEmulator,getAuth} from 'firebase/auth';
import {connectFirestoreEmulator,getFirestore} from 'firebase/firestore';

const env=import.meta.env;
const projectId=env.VITE_FIREBASE_PROJECT_ID;
export const firebaseEnabled=Boolean(projectId);
export const usingFirebaseEmulator=env.VITE_USE_FIREBASE_EMULATOR==='true';

const config={
 apiKey:env.VITE_FIREBASE_API_KEY,
 authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,
 projectId,
 storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET,
 messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID,
 appId:env.VITE_FIREBASE_APP_ID
};

export const firebaseApp=firebaseEnabled?(getApps().length?getApp():initializeApp(config)):null;
export const firestore=firebaseApp?getFirestore(firebaseApp):null;
export const firebaseAuth=firebaseApp?getAuth(firebaseApp):null;

if(usingFirebaseEmulator&&firestore&&firebaseAuth){
 const host=window.location.hostname||'localhost';
 connectFirestoreEmulator(firestore,host,8080);
 connectAuthEmulator(firebaseAuth,`http://${host}:9099`,{disableWarnings:true});
}
