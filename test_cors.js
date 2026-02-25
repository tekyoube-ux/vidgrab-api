// test

async function test(url) {
    try {
        console.log("Testing POST as text/plain to bypass OPTIONS...");
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=M9EJguHq8DI' })
        });
        console.log(res.status);
        console.log(await res.text());
    } catch (e) {
        console.error(e.message);
    }
}
test("https://cobalt.meowing.de/");
