import * as TimeUtil from '../../utils/time'
import * as LogUtil from '../../utils/logs'
import { Manager } from '../manager'
import {
  QUOTE_TOKEN_ADDRESSES,
  EVENT_FILL
} from '../../constants'

const DEBOUNCE_TIME = 500

export class ZeroExTradeManager extends Manager {
  constructor(emitter, web3) {
    super(
      'traded',
      emitter,
      web3
    )

    this.debounce = null
    this.collectedLogs = []
  }

  emitEvents(logs) {
    this.collectedLogs.push(...logs)

    clearTimeout(this.debounce)

    this.debounce = setTimeout(async () => {
      const enrichedLogs = await this._enrichLogs(this.web3, this.collectedLogs)
      const trades = this._convertToTrades(enrichedLogs)
      this.collectedLogs = []

      super.emitEvents(trades)
    }, DEBOUNCE_TIME)
  }

  _enrichLogs(web3, logs) {
    return Promise.all(
      logs
        .filter(log => log.topics[0] === EVENT_FILL)
        .map(async (log) => {
          const dataChunks = LogUtil.getChunksFromData(log.data)

          return {
            transactionHash: log.transactionHash,
            timestamp: TimeUtil.getNow(),
            tradingPairHash: LogUtil.getAddressFromChunk(log.topics[3]),
            maker: LogUtil.getAddressFromChunk(log.topics[1]),
            taker: LogUtil.getAddressFromChunk(dataChunks[0]),
            feeRecipient: LogUtil.getAddressFromChunk(dataChunks[2]),
            makerToken: LogUtil.getAddressFromChunk(dataChunks[1]),
            takerToken: LogUtil.getAddressFromChunk(dataChunks[2]),
            filledMakerTokenAmount: LogUtil.getAmountFromChunk(web3, dataChunks[3]),
            filledTakerTokenAmount: LogUtil.getAmountFromChunk(web3, dataChunks[4]),
            paidMakerFee: LogUtil.getAmountFromChunk(web3, dataChunks[5]),
            paidTakerFee: LogUtil.getAmountFromChunk(web3, dataChunks[6])
          }
        })
    )
  }

  _convertToTrades (enrichedLogs) {
    // A trade can consist of multiple filled orders, so multiple `LogFill` logs
    // That's why we group logs by transactionHash, which serves as unique identifier
    // for trades. Logs with the same transactionHash belong to the same trade.
    // grouped orders: [trade1, trade2, ...] => [[order1, order2], [order3], ...]
    const groupedLogs = LogUtil.groupByTransactionHash(enrichedLogs)

    // Every group of orders (== 1 trade) is processed to obtain the amount and
    // price of the traded BaseToken tokens. This implementation assumes that BaseToken tokens
    // can _only_ be traded against QuoteToken.
    return groupedLogs.map(logFills => {
      // Determine base and quote tokens
      let baseTokenAddress
      let quoteTokenAddress
      if(this._isQuoteTokenAddress(logFills[0].takerToken)) {
        baseTokenAddress = logFills[0].makerToken
        quoteTokenAddress = logFills[0].takerToken
      } else {
        baseTokenAddress = logFills[0].takerToken
        quoteTokenAddress = logFills[0].makerToken
      }

      // Determine base and quote token amounts
      let sumBaseTokenMade = 0
      let sumBaseTokenTaken = 0
      let sumQuoteTokenMade = 0
      let sumQuoteTokenTaken = 0
      logFills.forEach(lf => {
        if (this._isQuoteTokenAddress(lf.takerToken)) {
          sumBaseTokenMade += lf.filledMakerTokenAmount
          sumQuoteTokenTaken += lf.filledTakerTokenAmount
        } else {
          sumBaseTokenTaken += lf.filledTakerTokenAmount
          sumQuoteTokenMade += lf.filledMakerTokenAmount
        }
      })

      // Compute virtual amount/price traded, which is:
      // - for multiple matched orders: average of made and taken token amounts
      // - for single orders: simply the respecitve token amounts
      const baseTokenTraded = Math.max(sumBaseTokenMade, sumBaseTokenTaken)
      const quoteTokenTraded = Math.max(sumQuoteTokenMade, sumQuoteTokenTaken)

      // Use the data to determine amount and price of BaseToken/QuoteToken trade
      const amount = baseTokenTraded
      const price = quoteTokenTraded / baseTokenTraded
      const numOrders = logFills.length

      return {
        timestamp: logFills[0].timestamp,
        amount: amount,
        price: price,
        numOrders: numOrders,
        baseTokenAddress: baseTokenAddress,
        quoteTokenAddress: baseTokenAddress,
        sumBaseTokenMade: sumBaseTokenMade,
        sumBaseTokenTaken: sumBaseTokenTaken,
        sumQuoteTokenMade: sumQuoteTokenMade,
        sumQuoteTokenTaken: sumQuoteTokenTaken
      }
    })
  }

  _isQuoteTokenAddress (tokenAddress) {
    return QUOTE_TOKEN_ADDRESSES.includes(tokenAddress)
  }
}
