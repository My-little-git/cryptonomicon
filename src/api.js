const apiKey = '471cf128f99ae236881a0c5ccc4c91c80d03343fe96e1dc4622e38abfc87d046';

const tickersHandlers = {};

const url = new URL('wss://streamer.cryptocompare.com/v2')
url.searchParams.set('api_key', apiKey)

const socket = new WebSocket(url)
const bc = new BroadcastChannel('cryptonomicon')

const AGGREGATE_INDEX = '5';

socket.onmessage = (e) => {
    const { TYPE: type, FROMSYMBOL: ticker, PRICE: price} = JSON.parse(e.data)

    if (type !== AGGREGATE_INDEX){
        return;
    }

    const handlers = tickersHandlers[ticker] || null;

    bc.postMessage({ticker, price})

    handlers.forEach(fn => fn(ticker, price))
}

bc.onmessage = (e) => {
    
    const data = e.data

    if (Object.keys(data).toString() === ["ticker", "price"].toString()) {
        const {ticker, price} = data

        const handlers = tickersHandlers[ticker] ?? null;

        if (handlers) handlers.forEach(fn => fn(ticker, price))
    }

    if (Object.keys(data).toString() === ["action", "subs"].toString()) {
        if (socket.readyState !== WebSocket.OPEN) {
            return
        }

        socket.send(JSON.stringify(data))
    }
}


async function loadCoinList() {
    const url = new URL('https://min-api.cryptocompare.com/data/blockchain/list')
    url.searchParams.set('api_key', apiKey)

    const f = await fetch(url);
    const data = await f.json();

    return Object.keys(data.Data)
}

function sendToWebSocket(query) {

    const message = JSON.stringify(query)

    if (socket.readyState === WebSocket.OPEN) {
        socket.send(message)
        return
    }

    socket.addEventListener('open', () => socket.send(message), {once: true})

    if (socket.readyState === WebSocket.CLOSED) {
        bc.postMessage(query)
        return;
    }

    socket.addEventListener('close', () => bc.postMessage(query), {once: true})
}

function subscribeToTickerOnWs(tickerName) {
    sendToWebSocket({
        action: "SubAdd",
        subs: [`5~CCCAGG~${tickerName}~USD`]
    })
}

function unsubscribeToTickerOnWs(tickerName) {
    sendToWebSocket({
        action: "SubRemove",
        subs: [`5~CCCAGG~${tickerName}~USD`]
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