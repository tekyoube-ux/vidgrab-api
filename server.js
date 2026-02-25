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
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        else if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        if (!videoId) return null;
        return `youtube/v3/video/details?videoId=${videoId}&urlAccess=proxied`;
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
            return res.status(400).json({ status: 'error', error: { code: 'Hata: Sadece YouTube, TikTok veya Instagram linkleri desteklenir.' } });
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

        if (apiPath.includes('youtube/v3') || url.includes('youtube.com') || url.includes('youtu.be')) {
            const hostUrl = req.protocol + '://' + req.get('host');
            downloadUrl = `${hostUrl}/api/stream?url=${encodeURIComponent(downloadUrl)}`;
        }

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

app.get('/api/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('No URL provided');

    try {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const allowedHeaders = ['content-type', 'content-length', 'accept-ranges', 'x-content-length'];
        response.headers.forEach((value, name) => {
            if (allowedHeaders.includes(name.toLowerCase())) {
                res.setHeader(name.toLowerCase() === 'x-content-length' ? 'content-length' : name, value);
            }
        });

        res.setHeader('Content-Disposition', 'attachment; filename="vidgrab_video.mp4"');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (response.body.pipe) {
            response.body.pipe(res);
        } else {
            const { Readable } = require('stream');
            Readable.fromWeb(response.body).pipe(res);
        }
    } catch (e) {
        console.error('Stream Proxy Hatasi:', e.message);
        res.status(500).send('Stream Proxy Hatasi: ' + e.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ VidGrab Premium RapidAPI Backend is running on port ${PORT}`);
});
