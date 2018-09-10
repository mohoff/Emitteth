export class LogConfirmationManager {
  constructor(emitter, includeReconfirms, numConfirmations = 0) {
    this.emitter = emitter
    this.numConfirmations = numConfirmations
    this.includeReconfirms = includeReconfirms
    this.logHistory = new Array(numConfirmations).fill([])
    this.currentBlockNumber = 0
    this.numNewBlocksCovered = 0
  }

  onUpdateBlock(blockNumber, blockHash, log = null) {
    if (blockNumber > this.currentBlockNumber) {
      this.numNewBlocksCovered++
      this.currentBlockNumber = blockNumber
      this.currentBlockHash = blockHash
      this.logHistory.push((log ? [log] : []))

      const confirmed = this.logHistory.shift()
      confirmed.map(log => this.emitter.emit('confirmed', log))

      return confirmed
    }
    return []
  }

  onUpdateLog(log) {
    const { blockNumber, blockHash, transactionHash } = log

    // immediately return log since no need to track confirmations.
    // what comes in, goes immediately out (no wait-for-confirmation delay)
    if (this.numConfirmations === 0) return [log]

    // If a new block is registered, store `log` and return confirmed logs.
    // No need to process further in case of the first log of a new block
    let isNewBlock = blockNumber > this.currentBlockNumber
    const confirmed = this.onUpdateBlock(blockNumber, blockHash, log)
    if (isNewBlock) return confirmed

    // If a log at the most recent block appears, add it to `logHistory`
    // TODO: check for blockHash needed or even harmful?
    if (blockNumber === this.currentBlockNumber && blockHash === this.currentBlockHash) {
      this.logHistory[this.logHistory.length-1].push(log)
      return confirmed
    }

    // At this point, we know a chain reorg occured. All the remaing lines are
    // handling the reorg
    console.log('reorg log: ', blockNumber, this.currentBlockNumber, blockHash, this.currentBlockHash, transactionHash)
    const depth = this.currentBlockNumber - blockNumber
    const historyIndex = this.numConfirmations - (depth + 1)

    // TODO: Verify reorg emits work this way that also blockNumbers < this.currentBlockNumber can occur
    if (historyIndex < 0) {
      console.log('latereconfirm: ' + historyIndex + ', ' + log.blockNumber + ', ' + log.transactionHash)
      this.emitter.emit('latereconfirm', log)
      return this.includeReconfirms
        ? [...confirmed, log]
        : confirmed
    }

    // We can simply push to the array at existing index `historyIndex`, since
    // each element represents an array
    this.logHistory[historyIndex].push(log)
    return confirmed
  }

  removeLog (removedLog) {
    console.log('LogManager: removedLog: ' + removedLog.blockNumber + ', ' + removedLog.blockHash + ', ' + removedLog.transactionHash + ', ' + removedLog.logIndex)
    const { transactionHash, blockHash, logIndex } = removedLog
    let isDeleted = false

    // Iterate backwards since odds to find a reorg in newer blocks are higher
    for (let i = this.logHistory.length - 1; i >= 0; i--) {
      const blockLogs = this.logHistory[i]
      for (let j = 0; j < blockLogs.length; j++) {
        if (transactionHash == blockLogs[j].transactionHash && blockHash === blockLogs[j].blockHash && logIndex === blockLogs[j].logIndex) {
          console.log('...deleting log: ' + blockLogs[j].blockNumber + ', ' + blockHash + ', ' + transactionHash + ', ' + blockLogs[j].logIndex)
          blockLogs.splice(j, 1)
          isDeleted = true
          break
        }
      }
      if (isDeleted) break
    }
    if (!isDeleted) this.emitter.emit('lateunconfirm', removedLog)
  }

  getLogsAtBlockNumber (blockNumber) {
    const depth = this.currentBlockNumber - blockNumber
    const historyIndex = this.numConfirmations - (depth + 1)

    return this.logHistory[historyIndex]
  }

  buildResponse (confirmed, reconfirmed) {
    return {
      confirmed: confirmed || [],
      reconfirmed: reconfirmed || []
    }
  }
}
