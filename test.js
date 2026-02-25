const COBALT_INSTANCES = [
    'https://cobalt.catto.lat/',
    'https://cobalt.synth.moe/',
    'https://cobalt.ric2.me/',
    'https://cobalt-api.kwiatekmiki.com/',
    'https://cobalt.drgns.space/',
    'https://cbl.nl.tab.digital/',
    'https://cobalt.api.timelessnesses.me/',
    'https://cobalt.eeev.ee/',
    'https://cobalt.dr4goncraft.de/',
];

async function test() {
    for (const instance of COBALT_INSTANCES) {
        try {
            console.log(`Trying ${instance}...`);
            const res = await fetch(instance, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                body: JSON.stringify({
                    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                    videoQuality: "1080"
                })
            });
            console.log(`Status: ${res.status}`);
            const text = await res.text();
            console.log(`Response: ${text.slice(0, 100)}`);
        } catch (e) {
            console.error(`Error with ${instance}: ${e.message}`);
        }
    }
}
test();
