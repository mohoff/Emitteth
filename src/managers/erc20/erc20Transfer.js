import * as LogUtil from '../../utils/logs'
import * as TimeUtil from '../../utils/time'
import { Manager } from '../manager'
import { EVENT_TRANSFER } from '../../constants'

export class ERC20TransferManager extends Manager {
  constructor(emitter, web3) {
    super(
      'transferred',
      emitter,
      web3
    )
  }

  emitEvents (logs) {
    super.emitEvents(
      logs
        .filter(log => log.topics[0] === EVENT_TRANSFER)
        .map(log => {
          const dataChunks = LogUtil.getChunksFromData(log.data)

          return {
            from: log.topics[1],
            to: log.topics[2],
            value: LogUtil.getAmountFromChunk(this.web3, dataChunks[0]),
            transactionHash: log.transactionHash,
            timestamp: TimeUtil.getNow()
          }
        })
    )
  }

  transfromToApprovals (logs) {
    logs
      .filter(log => log.topics[0] === EVENT_APPROVAL)
      .map(log => {
      const dataChunks = LogUtil.getChunksFromData(log.data)

      console.log('approval', dataChunks)
      return {
        owner: log.topics[1],
        spender: log.topics[2],
        value: LogUtil.getAmountFromChunk(this.web3, dataChunks[0]),
        transactionHash: log.transactionHash,
        timestamp: TimeUtil.getNow()
      }
    })
  }
}
