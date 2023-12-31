<script>
import { loadCoinList, subscribeToTicker, unsubscribeFromTicker } from './api.js';

export default {
  name: "App",
  async created() {
    const tickerList = JSON.parse(sessionStorage.getItem("cryptonomicon-list"));
    this.tickers = tickerList || [];

    this.tickers.forEach(ticker => {
      this.graph[ticker.name] = []
      subscribeToTicker(ticker.name, this.updateTicker)
    })

    const currentUrl = new URL(window.location.href)
    this.filter = currentUrl.searchParams.get("filter") || ''
    this.page = +currentUrl.searchParams.get("page") || 1


    this.coinList = await loadCoinList()
  },
  mounted() {
    window.addEventListener('resize', this.calculateMaxGraphElements)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.calculateMaxGraphElements)
  },
  computed: {
    startIndex() {
      return (this.page - 1) * this.perPage
    },
    endIndex() {
      return this.page * this.perPage
    },
    filteredTickers() {
      return this.tickers.filter(ticker => new RegExp(`.*${this.filter.toUpperCase()}.*`).test(ticker.name))
    },
    paginatedTickers() {
      return this.filteredTickers.slice(this.startIndex, this.endIndex)
    },
    similarCoins() {
      return this.coinList.filter(coin => new RegExp(`.*${this.ticker.toUpperCase()}.*`).test(coin))
                 .slice(0, this.numOfSimilar);
    },
    displayedGraph() {
      return this.graph[this.selectedTicker.name].slice(-this.maxGraphElements);
    },
    normalizedGraph() {
      const graph = this.displayedGraph;
      const maxValue = Math.max(...graph);
      const minValue = Math.min(...graph);

      if (minValue === maxValue) return graph.map(() => 50)

      return graph.map(price =>
          (price - minValue) * 90 / (maxValue - minValue + Number.EPSILON) + 5
      );
    },
    isFirstPage() {
      return this.page <= 1
    },
    isLastPage() {
      return this.page >= this.filteredTickers.length / this.perPage
    },
    currentUrl() {
      return new URL(window.location.href)
    },
  },
  watch: {
    filter() {
      this.page = 1

      if (this.filter) {
        this.currentUrl.searchParams.set('filter', this.filter)
      } else {
        this.currentUrl.searchParams.delete('filter')
      }

      history.replaceState({}, null, this.currentUrl)
    },
    page() {
      if (this.page > 1) {
        this.currentUrl.searchParams.set('page', this.page)
      } else {
        this.currentUrl.searchParams.delete('page')
      }

      history.replaceState({}, null, this.currentUrl)
    },
    tickers() {
      sessionStorage.setItem('cryptonomicon-list', JSON.stringify(this.tickers))
    },
    paginatedTickers() {
      if (!this.paginatedTickers.length && this.page > 1) {
        this.page--
      }
    }
  },
  data() {
    return {
      ticker: '',
      tickers: [],

      selectedTicker: null,

      graph: {},
      maxGraphElements: 1,
      widthBar: null,

      coinList: [],
      numOfSimilar: 4,

      error: null,
      errorTime: 3000,

      page: 1,
      perPage: 6,

      filter: '',
    }
  },
  methods: {
    add(tickerName) {
      const newTicker = {
        name: tickerName.toUpperCase(),
        price: '-'
      }

      const isTickerAlreadyExist = this.tickers.some(ticker => ticker.name === newTicker.name)

      if (isTickerAlreadyExist) {
        this.error = true
        setTimeout(() => this.error = null, this.errorTime);
        return;
      }

      this.tickers = [newTicker, ...this.tickers];

      this.ticker = '';
      this.filter = '';
      this.graph[newTicker.name] = [];

      subscribeToTicker(newTicker.name, this.updateTicker)

    },
    handleDelete(tickerName) {
      if (this.selectedTicker?.name === tickerName) this.selectedTicker = null

      delete this.graph[tickerName]

      this.tickers = this.tickers.filter(ticker => ticker.name !== tickerName)
      unsubscribeFromTicker(tickerName)
    },
    updateTicker(tickerName, price) {
      this.tickers.find(({name}) => name === tickerName).price = price;
      this.graph[tickerName].push(price);
    },
    formatPrice(price) {
      if (price === '-') return '-'
      return price > 1 ? price.toFixed(2) : price.toPrecision(3)
    },
    calculateMaxGraphElements() {
      if (!this.$refs.barsWrapper) return;
      if (!this.widthBar) this.widthBar = this.$refs.bars[0].offsetWidth
      this.maxGraphElements = this.$refs.barsWrapper.clientWidth / this.widthBar
    }
  },
}
</script>

<template>
  <div class="container mx-auto flex flex-col items-center bg-gray-100 p-4">
    <div v-if="false" class="fixed w-100 h-100 opacity-80 bg-purple-800 inset-0 z-50 flex items-center justify-center">
      <svg class="animate-spin -ml-1 mr-3 h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
           viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
    <div class="container">
      <section>
        <div class="flex">
          <div class="max-w-xs">
            <label for="wallet" class="block text-sm font-medium text-gray-700"
            >Тикер</label
            >
            <div class="mt-1 relative rounded-md shadow-md">
              <input
                  v-model="ticker"
                  @keydown.enter="add(ticker)"
                  type="text"
                  name="wallet"
                  id="wallet"
                  class="block w-full pr-10 border-gray-300 text-gray-900 focus:outline-none focus:ring-gray-500 focus:border-gray-500 sm:text-sm rounded-md"
                  placeholder="Например DOGE"
              />
            </div>
            <div v-show="similarCoins.length" class="flex bg-white shadow-md p-1 rounded-md shadow-md flex-wrap">
              <span
                  @click="add(coin)"
                  v-for="coin in similarCoins"
                  :key="coin"
                  class="inline-flex items-center px-2 m-1 rounded-md text-xs font-medium bg-gray-300 text-gray-800 cursor-pointer">
                {{ coin }}
              </span>
            </div>
            <div v-if="error" class="text-sm text-red-600">Такой тикер уже добавлен</div>
          </div>
        </div>
        <button
            @click="add"
            type="button"
            class="my-4 inline-flex items-center py-2 px-4 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-full text-white bg-gray-600 hover:bg-gray-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          <!-- Heroicon name: solid/mail -->
          <svg
              class="-ml-0.5 mr-2 h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="#ffffff"
          >
            <path
                d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
            ></path>
          </svg>
          Добавить
        </button>
      </section>

      <template v-if="tickers.length">
        <hr class="w-full border-t border-gray-600 my-4"/>
        <div>
          <button
              @click="page--"
              :disabled="isFirstPage"
              class="me-3 my-4 disabled:bg-gray-300 inline-flex items-center py-2 px-4 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-full text-white bg-gray-600 hover:bg-gray-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            Назад
          </button>
          <button
              @click="page++"
              :disabled="isLastPage"
              class="my-4 disabled:bg-gray-300 inline-flex items-center py-2 px-4 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-full text-white bg-gray-600 hover:bg-gray-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            Вперед
          </button>
        </div>
        <div>
          Фильтр: <input v-model="filter" class="form-input me-10" type="text">
        </div>
        <hr class="w-full border-t border-gray-600 my-4"/>
        <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div
              v-for="t in paginatedTickers"
              :key="t.name"
              @click="selectedTicker = t"
              class="overflow-hidden shadow rounded-lg border-purple-800 border-solid cursor-pointer"
              :class="{
                'border-4': selectedTicker === t,
                'bg-red-200': t.price === '-',
                'bg-white': t.price !== '-',
              }"
          >
            <div class="px-4 py-5 sm:p-6 text-center">
              <dt class="text-sm font-medium text-gray-500 truncate">
                {{ t.name }} - USD
              </dt>
              <dd class="mt-1 text-3xl font-semibold text-gray-900">
                {{ formatPrice(t.price) }}
              </dd>
            </div>
            <div class="w-full border-t border-gray-200"></div>
            <button
                @click.stop="handleDelete(t.name)"
                class="flex items-center justify-center font-medium w-full bg-gray-100 px-4 py-4 sm:px-6 text-md text-gray-500 hover:text-gray-600 hover:bg-gray-200 hover:opacity-20 transition-all focus:outline-none"
            >
              <svg
                  class="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="#718096"
                  aria-hidden="true"
              >
                <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                ></path>
              </svg>
              Удалить
            </button>
          </div>
        </dl>
        <hr class="w-full border-t border-gray-600 my-4"/>
      </template>

      <section v-if="selectedTicker" class="relative">
        <h3 class="text-lg leading-6 font-medium text-gray-900 my-8">
          {{ selectedTicker.name }} - USD
        </h3>
        <div
            ref="barsWrapper"
            class="flex items-end border-gray-600 border-b border-l h-64">
          <div
              v-for="(bar, idx) in normalizedGraph"
              :key="idx"
              :style="{
                height: `${bar}%`
              }"
              class="bg-purple-800 border w-4 h-24"
              ref="bars"
          ></div>
        </div>
        <button
            @click="selectedTicker = null"
            type="button"
            class="absolute top-0 right-0"
        >
          <svg
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              xmlns:svgjs="http://svgjs.com/svgjs"
              version="1.1"
              width="30"
              height="30"
              x="0"
              y="0"
              viewBox="0 0 511.76 511.76"
              style="enable-background:new 0 0 512 512"
              xml:space="preserve"
          >
          <g>
            <path
                d="M436.896,74.869c-99.84-99.819-262.208-99.819-362.048,0c-99.797,99.819-99.797,262.229,0,362.048    c49.92,49.899,115.477,74.837,181.035,74.837s131.093-24.939,181.013-74.837C536.715,337.099,536.715,174.688,436.896,74.869z     M361.461,331.317c8.341,8.341,8.341,21.824,0,30.165c-4.16,4.16-9.621,6.251-15.083,6.251c-5.461,0-10.923-2.091-15.083-6.251    l-75.413-75.435l-75.392,75.413c-4.181,4.16-9.643,6.251-15.083,6.251c-5.461,0-10.923-2.091-15.083-6.251    c-8.341-8.341-8.341-21.845,0-30.165l75.392-75.413l-75.413-75.413c-8.341-8.341-8.341-21.845,0-30.165    c8.32-8.341,21.824-8.341,30.165,0l75.413,75.413l75.413-75.413c8.341-8.341,21.824-8.341,30.165,0    c8.341,8.32,8.341,21.824,0,30.165l-75.413,75.413L361.461,331.317z"
                fill="#718096"
                data-original="#000000"
            ></path>
          </g>
        </svg>
        </button>
      </section>
    </div>
  </div>
</template>

<style src="./app.css">
</style>
