import * as TimeUtil from '../../utils/time'
import * as LogUtil from '../../utils/logs'
import { Manager } from '../manager'
import { EVENT_CANCEL } from '../../constants'

export class ZeroExCancelManager extends Manager {
  constructor(emitter, web3) {
    super(
      'cancelled',
      emitter,
      web3
    )
  }

  emitEvents(logs) {
    super.emitEvents(
      logs
        .filter(log => log.topics[0] === EVENT_CANCEL)
        .map(log => {
          const dataChunks = LogUtil.getChunksFromData(log.data)

          const cancelledMakerTokenAmount = LogUtil.getAmountFromChunk(this.web3, dataChunks[2])
          const cancelledTakerTokenAmount = LogUtil.getAmountFromChunk(this.web3, dataChunks[3])

          let priceAdjustment
          if (!cancelledMakerTokenAmount && cancelledTakerTokenAmount) {
            priceAdjustment = 'down'
          } else if (cancelledMakerTokenAmount && !cancelledTakerTokenAmount) {
            priceAdjustment = 'up'
          }

          return {
            transactionHash: log.transactionHash,
            timestamp: TimeUtil.getNow(),
            tradingPairHash: LogUtil.getAddressFromChunk(log.topics[3]),
            maker: LogUtil.getAddressFromChunk(log.topics[1]),
            makerToken: LogUtil.getAddressFromChunk(dataChunks[0]),
            takerToken: LogUtil.getAddressFromChunk(dataChunks[1]),
            cancelledMakerTokenAmount: cancelledMakerTokenAmount,
            cancelledTakerTokenAmount: cancelledTakerTokenAmount,
            priceAdjustment: priceAdjustment
          }
        })
    )
  }
}
