const fs = require('fs');
const https = require('https');

https.get('https://raw.githubusercontent.com/eesur/country-codes-lat-long/master/country-codes-lat-long-alpha3.json', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        const mapping = JSON.parse(body).ref_country_codes;
        const data = JSON.parse(fs.readFileSync('src/app/data.json', 'utf8'));
        
        data.forEach(d => {
            const code = d['Country Code'];
            const cInfo = mapping.find(c => c.alpha3 === code);
            if (cInfo) {
                d.latitude = parseFloat(cInfo.latitude);
                d.longitude = parseFloat(cInfo.longitude);
            } else {
                d.longitude = 0;
                d.latitude = 0;
                console.log("Not found:", d['Country Name']);
            }
        });
        
        fs.writeFileSync('src/app/data.json', JSON.stringify(data, null, 2));
        console.log("Done adding coordinates!");
    });
});
