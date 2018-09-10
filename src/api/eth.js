const MAX_TOPICS = 4

export const subscribeToLogs = (web3, contractAddress, topics) => {
  if (!topics || !topics.length || topics.length > MAX_TOPICS) throw new Error('Invalid subscription topics')

  return web3.eth.subscribe('logs', {
    address: contractAddress,
    topics: topics
  }, (err, result) => {
    if (err) console.error('Log subscription failed: ', err)
  })
}

export const subscribeToPendingTx = (web3) => {
  return web3.eth.subscribe('pendingTransactions', (err, result) => {
    if (err) console.error('Log subscription failed: ', err)
  })
}

export const subscribeToNewBlocks = (web3) => {
  return web3.eth.subscribe('newBlockHeaders', (err, result) => {
    if (err) console.error('newBlockHeaders subscription failed: ', error)
  })
}

export const unsubscribe = (web3) => {
  return web3.eth.clearSubscriptions()
}

export const getTimestampForBlockNumber = async (web3, blockNumber) => {
  return (await web3.eth.getBlock(blockNumber)).timestamp
}
