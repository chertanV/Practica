//import { addDocument } from "../services/firestoreService.js";
import { db } from "../services/firebaseConfig.js";
import {
    collection,
    writeBatch,
    doc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";


export async function saveImportedData(collectionName, data) {
    const batch = writeBatch(db);
    const collectionRef = collection(db, collectionName);

    data.forEach((item) => {
        const newDoc = doc(collectionRef);
        batch.set(newDoc, item);
    });

    await batch.commit();
}