// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB8lZHA30-3jE--U7n-luYPZkdCl82pO6g",
  authDomain: "shedr-2ea24.firebaseapp.com",
  databaseURL: "https://shedr-2ea24-default-rtdb.firebaseio.com",
  projectId: "shedr-2ea24",
  storageBucket: "shedr-2ea24.firebasestorage.app",
  messagingSenderId: "1001426454469",
  appId: "1:1001426454469:web:e89af88ecf73b6880aadac",
  measurementId: "G-RRPBN59DJS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);