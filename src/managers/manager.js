// Manager base class that is extended by manager implementations (e.g. erc20, 0x, ...)

export class Manager {
  constructor(eventName, emitter, web3) {
    this.eventName = eventName
    this.emitter = emitter
    this.web3 = web3
    this.filteredFields = []
  }

  emitEvents (logs) {
    logs.map(event => this.emitter.emit(
      this.eventName,
      this._applyFilter(event)
    ))
  }

  filterFields (fields) {
    this.filteredFields = fields
  }

  _applyFilter (obj) {
    if (!this.filteredFields.length) return obj

    return this.filteredFields
      .map(field => field in obj ? {[field]: obj[field]} : {})
      .reduce((result, tmp) => Object.assign(result, tmp), {})
  }
}
