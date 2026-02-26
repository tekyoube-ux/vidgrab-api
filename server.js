const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(__dirname));

// Kullanicinin Premium RapidAPI Bilgileri
const RAPIDAPI_KEY = '70e243b92fmsh9a964bc0fd33646p13bb1cjsndedd8a1abde9';
const RAPIDAPI_HOST = 'social-media-video-downloader.p.rapidapi.com';

// Linkin hangi platforma ait oldugunu anlayip ilgili adrese yonlendirecek sistem.
function getRapidApiPath(url) {
    if (url.includes('tiktok.com')) {
        return `tiktok/v3/post/details?url=${encodeURIComponent(url)}`;
    } else if (url.includes('instagram.com')) {
        const match = url.match(/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
        const shortcode = match ? match[1] : null;
        if (!shortcode) return null;
        return `instagram/v3/media/post/details?shortcode=${shortcode}`;
    }
    return null; // Desteklenmeyen platform
}

app.post('/api/download', async (req, res) => {
    const { url, quality, format, audioOnly } = req.body;

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ status: 'error', error: { code: 'Geçersiz URL' } });
    }

    try {
        console.log(`Began processing via Premium RapidAPI: ${url}`);

        const apiPath = getRapidApiPath(url);
        if (!apiPath) {
            return res.status(400).json({ status: 'error', error: { code: 'Hata: Sadece TikTok veya Instagram linkleri desteklenir.' } });
        }

        const rapidUrl = `https://${RAPIDAPI_HOST}/${apiPath}`;

        console.log(`➡️ İstek Yönlendiriliyor: ${rapidUrl}`);

        const result = await fetch(rapidUrl, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': RAPIDAPI_HOST
            }
        });

        if (!result.ok) {
            const txt = await result.text();
            throw new Error(`Cloud API HTTP ${result.status} Hatasi: ${txt}`);
        }

        const data = await result.json();

        if (data.error || (data.message && data.message.toLowerCase().includes('not exist'))) {
            throw new Error(data.message || data.error.message || 'Bulut API tarafinca icerik bulunamadi.');
        }

        if (!data.contents || !data.contents[0]) {
            throw new Error('Icerik verisi boss veya alinamadi. Dosya gizli veya silinmis olabilir.');
        }

        const content = data.contents[0];
        let downloadUrl = null;
        let audioUrl = null;

        // Smart Extraction Logic (Genisletilmis Link Arayisi)
        if (content.videos && Array.isArray(content.videos) && content.videos.length > 0) {
            // İlk gecerli .mp4 veya genel url'yi bul
            const v = content.videos.find(x => x.url && x.url.includes('.mp4')) || content.videos[0];
            downloadUrl = v.url || v.downloadUrl;
        } else if (content.videoUrl) {
            downloadUrl = content.videoUrl;
        } else if (content.downloadUrl) {
            downloadUrl = content.downloadUrl;
        }

        if (!downloadUrl) {
            throw new Error('Videoya ait gecerli bir indirme (.mp4) linki API tarafindan saglanamadi.');
        }

        // Force proxy override for direct download (Especially for iOS Safari)
        const hostUrl = req.protocol + '://' + req.get('host');
        downloadUrl = `${hostUrl}/api/stream?url=${encodeURIComponent(downloadUrl)}`;

        return res.json({
            status: 'redirect',
            url: downloadUrl,
            audio: audioUrl // Opsiyonel, su an sade video sunuluyor
        });

    } catch (error) {
        console.error('Download Error:', error.message);
        return res.status(500).json({
            status: 'error',
            error: { code: 'Hata: ' + error.message }
        });
    }
});

// Proxy Stream Endpoint - Forces direct download on mobile devices (iOS/Safari)
app.get('/api/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('No URL provided');

    try {
        const https = require('https');

        // Some CDNs require specific user agents or headers, but basic get is usually fine
        https.get(videoUrl, (streamRes) => {
            if (streamRes.statusCode >= 400) {
                return res.status(streamRes.statusCode).send(`Proxy Error: ${streamRes.statusCode}`);
            }

            const allowedHeaders = ['content-type', 'content-length', 'accept-ranges', 'x-content-length'];
            for (const name in streamRes.headers) {
                if (allowedHeaders.includes(name.toLowerCase())) {
                    res.setHeader(name.toLowerCase() === 'x-content-length' ? 'content-length' : name, streamRes.headers[name]);
                }
            }

            // CRITICAL: Force the browser to download instead of play
            res.setHeader('Content-Disposition', 'attachment; filename="mindir_video.mp4"');
            res.setHeader('Access-Control-Allow-Origin', '*');

            streamRes.pipe(res);

            streamRes.on('error', (err) => {
                console.error('Stream Pipe Error:', err);
                res.end();
            });
        }).on('error', (err) => {
            console.error('HTTPS Proxy Network Error:', err.message);
            res.status(500).send('Network Error: ' + err.message);
        });

    } catch (e) {
        console.error('Stream Setup Error:', e.message);
        res.status(500).send('Stream Setup Error: ' + e.message);
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ VidGrab Premium RapidAPI Backend is running on port ${PORT}`);
});
