import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBhI-X_AghoWlUocOb_haArNCWIY2LcX38",
  authDomain: "diario-di-bordo-c40e9.firebaseapp.com",
  projectId: "diario-di-bordo-c40e9",
  storageBucket: "diario-di-bordo-c40e9.firebasestorage.app",
  messagingSenderId: "1012829073494",
  appId: "1:1012829073494:web:e53eb2992759a7bba38bf7",
  measurementId: "G-DEF6XGCM73",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
