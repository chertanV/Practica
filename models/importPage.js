import { saveImportedData } from "../viewmodels/importViewModel.js";



export default function initImportPage() {
    console.log("importPage.js загружен");
    
    const fileInput = document.getElementById("excelFile");
    const button = document.getElementById("uploadExcel");
    const status = document.getElementById("status");    
    
    button.addEventListener("click", async () => {
        const file = fileInput.files[0];
        
        if (!file) {
            alert("Выберите Excel файл");
            return;
        }
        
        const data = await readExcel(file);

        if (!data.length) {
            alert("Excel файл пуст или не содержит данных в первой строке");
        }

        console.log("Файл выбран: ", file.name);
        console.log("Excel -> JSON: ", data);
        
        await saveImportedData("products", data);
        
        status.innerText = "Импорт завершён.";
    });
}


function readExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array"});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            resolve(json);
        };

        reader.onerror = reject;

        reader.readAsArrayBuffer(file);
    });
}