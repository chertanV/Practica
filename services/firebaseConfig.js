import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";

import { getAnalytics } from 
"https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";

import { getAuth } from 
"https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import { getFirestore} from
"https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyAEbaqxardPM5YF9ip0HScdEiOVoip1zXU",
    authDomain: "practikach.firebaseapp.com",
    projectId: "practikach",
    storageBucket: "practikach.firebasestorage.app",
    messagingSenderId: "1066273688579",
    appId: "1:1066273688579:web:2d681e1ee88a0221245236",
    measurementId: "G-NSZJN9K93T"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);