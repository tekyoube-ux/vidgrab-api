const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const youtubedl = require('youtube-dl-exec');

const app = express();

// Middleware
app.use(cors()); // Allow all cross-origin requests
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint for Render.com
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'VidGrab API Backend' });
});

app.post('/api/download', async (req, res) => {
    const { url, quality, format, audioOnly } = req.body;

    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ status: 'error', error: { code: 'Geçersiz URL' } });
    }

    try {
        console.log(`Began processing: ${url}`);

        let customQuality = 'best';
        if (quality && quality !== 'max') {
            customQuality = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`;
        }

        const { execFile } = require('child_process');
        const path = require('path');
        const isWin = process.platform === 'win32';
        const ytdlpBinary = isWin ? 'yt-dlp.exe' : 'yt-dlp';
        const ytdlpPath = path.resolve(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', ytdlpBinary);

        const args = [url, '--dump-single-json', '--no-check-certificates', '--no-warnings', '--prefer-free-formats', '--add-header', 'referer:youtube.com', '--add-header', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'];

        if (audioOnly) {
            args.push('--extract-audio');
            if (format === 'mp3') {
                args.push('--audio-format', 'mp3');
            } else {
                args.push('--format', 'bestaudio/best');
            }
        } else {
            args.push('--format', customQuality);
        }

        const runYtdlp = () => new Promise((resolve, reject) => {
            execFile(ytdlpPath, args, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('yt-dlp stderr:', stderr);
                    return reject(new Error('Yt-dlp işlemi başarısız: ' + error.message));
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error('Çıktı okunamadı (JSON hatası).'));
                }
            });
        });

        const videoInfo = await runYtdlp();

        if (!videoInfo || (!videoInfo.url && !videoInfo.requested_formats)) {
            throw new Error('Could not parse raw video URL from site.');
        }

        // Return the direct URL to the client. The browser will download it directly!
        const responseData = {
            status: 'redirect'
        };

        if (videoInfo.url) {
            responseData.url = videoInfo.url;
        }

        // If the site splits audio and video URLs (like modern YouTube), return both if available
        if (videoInfo.requested_formats) {
            const vFormat = videoInfo.requested_formats.find(f => f.vcodec !== 'none');
            const aFormat = videoInfo.requested_formats.find(f => f.acodec !== 'none');
            if (vFormat) responseData.url = vFormat.url;
            if (aFormat && vFormat && vFormat.acodec === 'none') {
                responseData.audio = aFormat.url; // Send audio URL separately if needed
            }
        }

        return res.json(responseData);

    } catch (error) {
        console.error('Download Error:', error.message);
        return res.status(500).json({
            status: 'error',
            error: { code: 'Hata: ' + error.message }
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ VidGrab Backend API is running on port ${PORT}`);
});
