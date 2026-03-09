import { db } from "./firebaseConfig.js";

import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/*
export async function addProduct(product) {
    try {
        const docRef = await addDoc(
            collection(db, "products"),
            product
        );
        console.log("Product added: ", docRef.id);
    }
    catch(error){
        console.error("Error adding product: ", error);
    }
}
*/

export async function getCollection(collectionName) {
    const querySnapshot = await getDocs(collection(db, collectionName));

    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

export async function getDocument(collectionName, id) {
    const document = await getDoc(doc(db,collectionName, id));

    return {
        id: document.id,
        ...document.data()
    };
}

export async function addDocument(collectionName, data) {
    return await addDoc(collection(db, collectionName), data);
}

export async function updateDocument(collectionName, id, data) {
    const ref = doc(db, collectionName, id);
    return await updateDoc(ref, data);
}

export async function deleteDocument(collectionName, id) {
    const ref = doc(db, collectionName, id);
    return await deleteDoc(ref);
}