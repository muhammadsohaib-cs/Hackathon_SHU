const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('Global_Climate_Dataset.xlsx');
const sheetName = 'Agriculture_Crops';
const worksheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(worksheet, { range: 1 });
fs.writeFileSync('src/app/crops_data.json', JSON.stringify(data, null, 2));
console.log(`Wrote ${data.length} records from ${sheetName}`);
