class EachPromise {
  constructor (body) {
    this.eachCb_ = null
    this.stopped_ = false
    this.body_ = body
  } // constructor

  each (eachCb) {
    this.eachCb_ = eachCb
    return this.makePromise()
  } // each

  then (thenCb) {
    return this.makePromise().then(thenCb)
  } // then

  catch (catchCb) {
    return this.makePromise().catch(catchCb)
  } // catchCb

  makePromise () {
    if (this.eachCb_ === null) {
      throw new Error('EachPromise without an each()')
    }
    this.promise_ = new Promise((resolve, reject) => {
      this.body_(
        each => this.eachIteration(each, reject),
        result => { this.stopped(); resolve(result) },
        err => { this.stopped(); reject(err) }
      )
    })
    return this.promise_
  } // makePromise

  eachIteration (each, reject) {
    if (this.stopped_) { return }

    try {
      this.eachCb_(each)
    } catch (err) {
      this.stopped()
      reject(err)
    }
  } // eachIteration

  stopped () {
    this.stopped_ = true
  } // stopped
} // class EachPromise

module.exports = EachPromise
