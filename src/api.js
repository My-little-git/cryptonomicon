
const tickersHandlers = {};
const apiKey = 'cd1a21c480d77550041c6136a22187170ceea7a13231043fe3478f0e2c2eeb3f'

const worker = new SharedWorker(new URL('./sharedWorker.js', import.meta.url))

worker.port.onmessage = (message) => {

    const data = message.data

    const handlers = tickersHandlers[data.ticker];

    handlers.forEach(fn => fn(data.ticker, data.price))

}

async function loadCoinList() {
    const url = new URL('https://min-api.cryptocompare.com/data/blockchain/list')
    url.searchParams.set('api_key', apiKey)

    const f = await fetch(url);
    const data = await f.json();

    return Object.keys(data.Data)
}

function subscribeToTickerOnWs(tickerName) {
    worker.port.postMessage({
        action: "SubAdd",
        ticker: tickerName
    })
}

function unsubscribeToTickerOnWs(tickerName) {
    worker.port.postMessage({
        action: "SubRemove",
        ticker: tickerName
    })
}

function subscribeToTicker(tickerName, cb) {
    const subscribers = tickersHandlers[tickerName] || [];
    tickersHandlers[tickerName] = [...subscribers, cb]
    subscribeToTickerOnWs(tickerName);
}

function unsubscribeFromTicker(tickerName) {
    delete tickersHandlers[tickerName]
    unsubscribeToTickerOnWs(tickerName)
}


export {loadCoinList, subscribeToTicker, unsubscribeFromTicker}