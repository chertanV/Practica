import { auth } from "../services/firebaseConfig.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


// Вход в систему 
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "../index.html";
        } catch (error) {
            document.getElementById("errorMessage").innerText = error.message;
        }
    });
}


// Защита обхода 
onAuthStateChanged(auth, (user) => {
    if (!user && window.location.pathname.includes("index.html")) {
        window.location.href = "./login.html";
    }
});