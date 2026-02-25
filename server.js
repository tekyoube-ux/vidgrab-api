const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(__dirname));

// Render.com'un banlanmış IP adresini kullanmak yerine,
// Tüm istekleri bu gizli proxy havuzuna dağıtıyoruz.
const COBALT_INSTANCES = [
    'https://co.wuk.sh/api/json',
    'https://cobalt.catto.lat/api/json',
    'https://api.cobalt.best/api/json',
    'https://cobalt.canine.tools/api/json',
    'https://cobalt.meowing.de/api/json',
    'https://co.anontier.nl/api/json'
];

app.post('/api/download', async (req, res) => {
    const { url, quality, format, audioOnly } = req.body;

    if (!url || (!url.startsWith('http') && !url.startsWith('https'))) {
        return res.status(400).json({ status: 'error', error: { code: 'Geçersiz URL' } });
    }

    let cQuality = '1080';
    if (quality && quality !== 'max') {
        cQuality = quality.replace('p', '');
    } else if (quality === 'max') {
        cQuality = 'max';
    }

    const cobaltHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const cobaltBody = {
        url: url,
        vQuality: cQuality,
        isAudioOnly: audioOnly || false,
        aFormat: format === 'mp3' ? 'mp3' : 'best',
        vCodec: 'h264'
    };

    let lastError = 'Tüm proxy sunucuları yanıt vermedi.';

    for (const instance of COBALT_INSTANCES) {
        try {
            console.log(`📡 Istek Atiliyor -> ${instance}`);
            const result = await fetch(instance, {
                method: 'POST',
                headers: cobaltHeaders,
                body: JSON.stringify(cobaltBody),
                signal: AbortSignal.timeout(12000)
            });

            if (!result.ok) {
                lastError = `HTTP ${result.status}`;
                console.log(`❌ Proxy Reddedildi: ${instance} (${lastError})`);
                continue;
            }

            const data = await result.json();

            if (data.status === 'error' || data.error) {
                lastError = data.text || data.error?.code || 'Bilinmeyen ic hata';
                console.log(`❌ Proxy Icerik Hatasi: ${instance} (${lastError})`);
                continue;
            }

            // Basari!
            console.log(`✅ Basarili: ${instance}`);
            return res.json({
                status: 'redirect',
                url: data.url,
                audio: data.audio
            });

        } catch (err) {
            lastError = err.message || 'Baglanti koptu';
            console.log(`❌ Proxy Erismedi: ${instance} (${lastError})`);
            continue;
        }
    }

    console.error('🚨 Bütün proxy sunucuları tükendi!');
    return res.status(500).json({ status: 'error', error: { code: 'Hata: Proxy Sistemleri Gecici Olarak Mesgul - ' + lastError } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy Router API Porda Çalısıyor: ${PORT}`));
