import { EventEmitter } from 'events'
import * as Managers from './managers'
import { LogConfirmationManager } from './logconfirmations'
import * as LogUtil from './utils/logs'
import * as Eth from './api/eth'
import {
  EVENT_FILL,
  EVENT_CANCEL,
  EVENT_TRANSFER,
  EVENT_APPROVAL,
  EXCHANGE_CONTRACT,
  EVENT_TYPES
} from './constants'

export class Emitteth extends EventEmitter {
  constructor(web3) {
    super()
    this.web3 = web3
    this.registeredManagers = []
    this.logConfirmationManager

    this.withLogs = false
    this.withLogFields
    this.withPendingTx = false
    this.withBlocks = false
    this.withBlockFields

    this.withTrades = false
    this.withCancels = false
    this.tradingPairHash

    this.contractAddress
    this.topics = [null, null, null, null]
    this.numConfirmations = 0
  }

  /**
   * General
   */
  emitForContract(contractAddress) {
    // TODO: address validation
    this.contractAddress = contractAddress.toLowerCase()
    this.withLogs = true
    return this
  }
  withTopics(topics) {
    if (!topics || topics.length > 4) throw new Error('Invalid topics')
    this.topics = topics
    return this
  }
  withConfirmations(numConfirmations) {
    if (numConfirmations < 1) throw new Error('Invalid number of confirmations')
    this.numConfirmations = numConfirmations
    return this
  }
  withNewBlocks(...fields) {
    this.withBlocks = true
    this.withBlockFields = fields
    return this
  }
  withPendingTransactions() {
    this.withPendingTx = true
    return this
  }
  filterFields(...fields) {
    if (!this.registeredManagers.length) throw new Error('No event manager specified to apply filters to')

    this.registeredManagers[this.registeredManagers.length - 1].filterFields(fields)
    return this
  }

  /**
   * ERC20
   */
  emitTransfersForToken(token) {
    this.registeredManagers.push(new Managers.ERC20TransferManager(this, this.web3))
    this.emitForContract(token)
    return this.withTopics([EVENT_TRANSFER, null, null])
  }
  emitApprovalsForToken(token) {
    this.registeredManagers.push(new Managers.ERC20ApprovalManager(this, this.web3))
    this.emitForContract(token)
    return this.withTopics([EVENT_APPROVAL, null, null])
  }
  includeApprovals() {
    this.registeredManagers.push(new Managers.ERC20ApprovalManager(this, this.web3))
    this.topics[0] = [this.topics[0], EVENT_APPROVAL]
    return this
  }

  /**
   * 0x
   */
  emitAllTrades() {
    this.registeredManagers.push(new Managers.ZeroExTradeManager(this, this.web3))
    this.emitForContract(EXCHANGE_CONTRACT)
    return this.withTopics([EVENT_FILL, null, null, null])
  }
  emitAllCancels() {
    this.registeredManagers.push(new Managers.ZeroExCancelManager(this, this.web3))
    this.emitForContract(EXCHANGE_CONTRACT)
    return this.withTopics([EVENT_CANCEL, null, null, null])
  }
  emitTradesForTokens(baseToken, quoteToken) {
    this.registeredManagers.push(new Managers.ZeroExTradeManager(this, this.web3))
    this.emitForContract(EXCHANGE_CONTRACT)
    this.withTopics([EVENT_FILL, null, null, LogUtil.getTradingPairHash(baseToken, quoteToken)])
    return this
  }
  emitCancelsForTokens(baseToken, quoteToken) {
    this.registeredManagers.push(new Managers.ZeroExCancelManager(this, this.web3))
    this.emitForContract(EXCHANGE_CONTRACT)
    this.withTopics([EVENT_CANCEL, null, null, LogUtil.getTradingPairHash(baseToken, quoteToken)])
    return this
  }
  includeCancels() {
    this.registeredManagers.push(new Managers.ZeroExCancelManager(this, this.web3))
    this.topics[0] = [this.topics[0], EVENT_CANCEL]
    return this
  }

  start() {
    // LogConfirmationManager needs prioritized treatment, because other
    // managers rely on the delaying of logs (= waiting for confirmations).
    // This is why it is always created first
    this.logConfirmationManager = new LogConfirmationManager(this, false, this.numConfirmations)

    this.subBlocks = Eth.subscribeToNewBlocks(this.web3)
      .on('data', (newBlock) => {
        if (this.withLogs) {
          const relevantLogs = this.logConfirmationManager.onUpdateBlock(newBlock.number, newBlock.hash)
          this.registeredManagers.forEach(manager => manager.emitEvents(relevantLogs))
        }

        if (this.withBlocks) {
          this.emit('newblock', newBlock)
        }
      })

    if (this.withLogs) {
      this.subLogs = Eth.subscribeToLogs(this.web3, this.contractAddress, this.topics)
        .on('data', async (log) => {
          this.emit('mined', log)
          const relevantLogs = this.logConfirmationManager.onUpdateLog(log)
          this.registeredManagers.forEach(manager => manager.emitEvents(relevantLogs))
        })
        .on('changed', (log) => this.logConfirmationManager.removeLog(log))
    }

    if (this.withPendingTx) {
      this.subPending = Eth.subscribeToPendingTx(this.web3)
        .on('data', (txHash) => this.emit('pending', txHash))
    }

    return this
  }

  stop() {
    try {
      Eth.unsubscribe(this.web3)
    } catch (err) {
      // The underlying web3 function errors sometimes. With try-catch, it
      // fails silently.
    }
  }
}
