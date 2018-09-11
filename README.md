# Emitteth

Emitteth is an event emitter for the Ethereum blockchain. Besides web3-supported events, it provides convenience APIs for subscribing to ERC20-events (`Transfer`, `Approval`) as well as 0x-related events (`LogFill`, `LogCancel`). For 0x, an event abstraction is built-in which collects bursts of `LogFill` events an aggregates those into `traded` events of the form `{ amount: X, price: Y, timestamp: Z }`. Currently, it supports 0x v1.

## Events

Supported events, which can be subscribed to via Node's `EventEmitter` interface:

- `mined`: Same as web3's `logs`.
- `confirmed`: Like `mined` but only emitted after a defined number of block confirmations passed.
- `latereconfirm`: A log that is part of a chain reorganization (reorg) but is old enough so that it fell out the block confirmation buffer. Example: If you configured emitteth in a way that it emits events after 2 block confirmations, a `lateconfirm` means that a log was recaptured at block depth n-3 or older. The higher the block confirmation number, the less frequent this event is emitted.
- `lateunconfirm`: Similar to `latereconfirm`, however, this event type states that a log was removed (`log.removed==true`) from the part of the chain effected by the reorg.
- `transferred`: An ERC20 `Transfer` event was emitted by an observed contract.
- `approved`: An ERC20 `Approve` event was emitted by an observed contract.
- `traded`: One or more 0x `LogFill`(s) were emitted that collectively represent a settled trade.
- `cancelled`: A 0x `LogCancel` was emitted that represents a hard-cancelled order.
- `newblock`: Same as web3's `newBlockHeaders`
- `pending`: Same as web3's `pendingTransactions`

## Installation

```
npm install emitteth
```

## Import

```javascript
import { Emitteth } from 'emitteth'
```

## How to register event subscriptions

To build event subscriptions, a `web3` object has to be passed to *Emitteth*. For example, you can use Infura with a WebSocket provider:

```javascript
import Web3 from 'web3'
import ProviderEngine from 'web3-provider-engine'
import WebsocketSubprovider from 'web3-provider-engine/subproviders/websocket'

const getInfuraWebsocketSubprovider = (networkAsString) => {
  const engine = new ProviderEngine()
  const subprovider = new WebsocketSubprovider({ rpcUrl: 'wss://' + networkAsString + '.infura.io/ws' })

  subprovider.on('data', (err, notification) => {
    engine.emit('data', err, notification)
  })

  engine.addProvider(subprovider)
  engine.start()
  return engine
}

const web3 = new Web3(getInfuraWebsocketSubprovider('mainnet'))
// pass `web3` to Emitteth
```

Now you can build Ethereum subscriptions. Some examples:

### Example 1
Firstly, *Emitteth* allows you to setup event subscriptions in a generic way by specifying the contract address and the event topics you are interested in. `withFields(...)` limits the fields in the event object. You can specify a number of confirmation blocks after which the events should be emitted by using `withConfirmation(...)`.

```javascript
const emitteth = new Emitteth(web3)
  .forContract('0x12459c951127e0c374ff9105dda097662a027093')
  .withTopics(['0x0d0b9391970d9a25552f37d436d2aae2925e2bfe1b2a923754bada030c498cb3', null, null, null])
  .withFields('blockNumber', 'transactionHash')
  .withConfirmations(3)
  .start()
```

### Example 2

You can subscribe to all `traded` and `cancelled` events without filtering for a specific traded token pair. `withNewBlocks(...)` subscribes additionally to `newblock` events and returns the fields that are passed as argument (in the snippet: field `number`).

```javascript
const emitteth = new Emitteth(web3)
  .emitAllTrades()
  .filterFields('amount', 'price')
  .includeCancels()
  .filterFields('cancelledMakerTokenAmount', 'cancelledTakerTokenAmount', 'priceAdjustment')
  .withNewBlocks('number')
  .withConfirmations(3)
  .start()
```

Alternatively, you can subscribe to `traded` events for a specific token pair by using:

```javascript
const emitteth = new Emitteth(web3)
  .emitTradesForTokens('0xe41d2489571d322189246dafa5ebde1f4699f498', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
  .start()
```

### Example 3
You might be interested in all ERC20 `Transfer` event of a specific token contract. In this case, you can do:

```javascript
const emitteth3 = new Emitteth(web3)
  .emitTransfersForToken('0xe41d2489571d322189246dafa5ebde1f4699f498')
  .start()
```

### Example 4
Subscription for pending transactions (careful, flood of events):

```javascript
const emitteth = new Emitteth(web3)
  .withPendingTransactions()
  .start()
```

## How to consume subscriptions

The object `emitteth`, which was built in the previous section, exposes Node's `EventEmitter` interface. Thus, we can consume events with:

```javascript
// Generic events
emitteth.on('newblock', (block) => {
  ...
})
emitteth.on('pending', (txHash) => {
  ...
})
emitteth.on('mined', (log) => {
  ...
})
// `mined` events confirmed with X blocks
emitteth.on('confirmed', (log) => {
  ...
})
emitteth.on('latereconfirm', (log) => {
  ...
})
emitteth.on('lateunconfirm', (log) => {
  ...
})
// ERC20 events
emitteth.on('transferred', (transfer) => {
  ...
})
emitteth.on('approved', (approval) => {
 ...
})
// 0x events
emitteth.on('traded', (trade) => {
  ...
})
emitteth.on('cancelled', (cancelledOrder) => {
  ...
})
```
