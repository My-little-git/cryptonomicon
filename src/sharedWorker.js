
const apiKey = '69b89d8e16ec34adbcc9593365f1084965038cd849e5764bcdfacb2117738eb2'
const url = new URL('wss://streamer.cryptocompare.com/v2')
url.searchParams.set('api_key', apiKey)

const AGGREGATE_INDEX = '5';
const CURRENCY = 'USD';

const currencySubscribers = {}
// eslint-disable-next-line no-unused-vars
let retryConnectInterval = null

let ws = new WebSocket(url)

ws.onclose = () => {
    retryConnectInterval = setInterval(() => {
        console.log('try to reconnect')
        ws = new WebSocket(url)
    }, 60000)

    ws.onopen = () => {
        retryConnectInterval = null
    }
}


self.onconnect = (e) => {

    e.source.onmessage = (message) => {
        const obj = message.data

        const subscribers = currencySubscribers[obj.ticker] || []

        if (obj.action === "SubAdd") {
            currencySubscribers[obj.ticker] = [...subscribers, e.source]

            if (subscribers.length) {
                return
            }
        }

        if (obj.action === "SubRemove") {
            currencySubscribers[obj.ticker] = subscribers.filter(sub => sub !== e.source)

            if (currencySubscribers[obj.ticker].length) {
                return
            }
        }

        const messageObj = {
            action: obj.action,
            subs: [`${AGGREGATE_INDEX}~CCCAGG~${obj.ticker}~${CURRENCY}`]
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(messageObj))
            return
        }

        ws.addEventListener('open', () => {
            ws.send(JSON.stringify(messageObj))
        }, { once: true })
    }

    ws.onmessage = (message) => {
        const { TYPE: type, MESSAGE: queryMessage, PARAMETER: parameter, FROMSYMBOL: ticker, PRICE: price } = JSON.parse(message.data)

        if (type === '500' && queryMessage === 'INVALID_SUB') {
            const sub = parameter.replace('USD', 'BTC')
            ws.send(JSON.stringify({
                action: "SubAdd",
                subs: [sub]
            }))
        }

        if (type !== AGGREGATE_INDEX || !price) {
            return
        }

        const subscribers = currencySubscribers[ticker]
        subscribers.forEach(sub => sub.postMessage({ ticker, price }))
    }
}

self.onbeforeunload = () => {
    ws.close()
}