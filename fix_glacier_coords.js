const fs = require('fs');
const https = require('https');

const DATA_FILE = 'src/app/data.json';
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Sleep utility to respect API rate limits (Nominatim limit is 1 req/sec)
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(glacierName, countryName) {
    // Sometimes the first glacier is "None"
    if (!glacierName || glacierName.toLowerCase() === 'none') {
        return null;
    }

    const query = encodeURIComponent(`${glacierName} Glacier, ${countryName}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'GlacierTracker/1.0' } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json && json.length > 0) {
                        resolve({
                            lat: parseFloat(json[0].lat),
                            lon: parseFloat(json[0].lon)
                        });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            resolve(null);
        });
    });
}

// Fallback search without country if the first fails
async function geocodeFallback(glacierName) {
    if (!glacierName || glacierName.toLowerCase() === 'none') return null;
    const query = encodeURIComponent(`${glacierName} Glacier`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'GlacierTracker/1.0' } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json && json.length > 0) {
                        resolve({
                            lat: parseFloat(json[0].lat),
                            lon: parseFloat(json[0].lon)
                        });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    console.log(`Updating coordinates for ${data.length} regions...`);
    let updatedCount = 0;

    for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        
        // Ensure "Major Glaciers" field exists
        const majorStr = entry['Major Glaciers'];
        if (!majorStr || typeof majorStr !== 'string') continue;
        
        const firstGlacier = majorStr.split(',')[0].trim();
        const country = entry['Country Name'];

        if (firstGlacier !== 'None' && firstGlacier !== 'N/A') {
            console.log(`[${i+1}/${data.length}] Looking up ${firstGlacier} in ${country}...`);
            let coords = await geocode(firstGlacier, country);
            await sleep(1100);

            if (!coords) {
                console.log(`   -> Not found with country. Trying just "${firstGlacier} Glacier"...`);
                coords = await geocodeFallback(firstGlacier);
                await sleep(1100);
            }

            if (coords) {
                entry.latitude = coords.lat;
                entry.longitude = coords.lon;
                updatedCount++;
                console.log(`   -> Success: ${coords.lat}, ${coords.lon}`);
            } else {
                console.log(`   -> Failed to locate ${firstGlacier}`);
            }
        }
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`\nFinished! Updated ${updatedCount} out of ${data.length} regions.`);
}

run();
