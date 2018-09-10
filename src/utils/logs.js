import EthereumJsUtil from 'ethereumjs-util'

const ERC20_DECIMALS_DEFAULT = 18
const ADDRESS_LENGTH = 40 // in hex notation
const WORD_LENGTH = 64 // in hex notation

export const sortTimestampAsc = (trades) => {
  trades.sort((a, b) => {
    return (a.timestamp < b.timestamp) ? -1 : 1
  })
}

export const groupByTransactionHash = (logs) => {
  return groupBy(logs, 'transactionHash')
}

// Groups array of objects by a certain object key
// Example: [{a: 1}, {a: 2}, {a: 2}] => [[{a: 1}], [{a: 2}, {a: 2}]]
export const groupBy = (array, key) => {
  return array.reduce((result, element, index) => {
    const prevGroupIndex = result.length - 1

    // If it's the first element (index === 1), create a new array ('group')
    // and add `element` to it. Otherwise, check if `key` is already present
    // in the previous group.
    //  - If yes, push the object to the previous group
    //  - Otherwise, create a new group with object as a single element
    if (index !== 0 && result[prevGroupIndex][0][key] === element[key]) {
      result[prevGroupIndex].push(element)
      return result
    } else {
      return [...result, [element]]
    }
  }, [])
}

export const getChunksFromData = (data) => {
  let dataChunks = []
  const dataHex = data.substr(2) // removes '0x' in '0x1234abc...'

  for (let i = 0; i < dataHex.length; i += WORD_LENGTH) {
    dataChunks.push(dataHex.substr(i, WORD_LENGTH))
  }
  return dataChunks
}

export const getAddressFromChunk = (chunkHex) => {
  return '0x' + chunkHex.substring(chunkHex.length - ADDRESS_LENGTH)
}

export const getAmountFromChunk = (web3, chunkHex, decimals = ERC20_DECIMALS_DEFAULT) => {
  // Prepend '0x' so that input in hex format is enforced. This is required,
  // because if `chunkHex` happens to have no letters, it is interpreted as
  // number string (not hex string).
  return web3.utils.toBN('0x' + chunkHex) / (10 ** decimals)
}

// Reconstructs indexed log field `tradingPairHash` that is included in 0x's LogFill events
export const getTradingPairHash = (baseTokenAddress, quoteTokenAddress) => {
  const buffer = EthereumJsUtil.sha3(
    Buffer.concat([
      Buffer.from(baseTokenAddress.substr(2), 'hex'),
      Buffer.from(quoteTokenAddress.substr(2), 'hex')
    ])
  )
  return '0x' + buffer.toString('hex')
}
