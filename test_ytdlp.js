const youtubedl = require('youtube-dl-exec');

async function test() {
    try {
        console.log("Testing yt-dlp executable direct integration...");
        const result = await youtubedl('https://www.youtube.com/watch?v=M9EJguHq8DI', {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });
        console.log("SUCCESS:");
        console.log(result.url ? `URL: ${result.url.substring(0, 50)}...` : result);
    } catch (e) {
        console.error("FAILED:");
        console.error(e.message);
        console.error("STDERR:", e.stderr);
    }
}
test();
