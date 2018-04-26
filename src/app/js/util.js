(function ($, window) {
  window.onload = function () {
    setTimeout(function () {
      $('#step1Div').transition({
        animation: 'fade left',
        duration: '800ms'
      })
    }, 100)

    setTimeout(function () {
      $('#step2Div').transition({
        animation: 'fade left',
        duration: '800ms'
      })
    }, 200)

    setTimeout(function () {
      $('#step3Div').transition({
        animation: 'fade left',
        duration: '800ms'
      })
    }, 300)

    setTimeout(function () {
      $('#footer').transition({
        animation: 'fade left',
        duration: '800ms'
      })
    }, 400)
  }

  $('.close.icon').click(function () {
    $(this).parent().transition('fade')
  })

  $('#githubLink').click(function () {
    window.open('https://github.com/looploooop/iota-send-offline', '_blank')
  })

  $('#faqModal').modal({
    centered: false,
    blurring: true
  })

  $('#step1ribbon, #step2ribbon, #step3ribbon').click(() => $('#faqModal').modal('show'))
  $('#faq').click(() => $('#faqModal').modal('show'))
}(jQuery, window))

window.twapi = 'https://api.tangle-worker.net'
window.workerTagPrefix = 'TANGLEWORKER'
window.remainderTag = 'IOTAOFFLINEREMAINDER9999999'
window.defaultTag = 'IOTAOFFLINE9999999999999999'
window.bundleUrl = 'https://iotasear.ch/bundle/'
window.addressUrl = 'https://iotasear.ch/address/'

window.getPrice = function (xhrPool, callback) {
  $.ajax({
    type: 'get',
    url: 'https://api.bitfinex.com/v2/tickers?symbols=tIOTUSD',
    dataType: 'json',
    beforeSend: function (jqXHR) {
      xhrPool.push(jqXHR)
    },
    complete: function (jqXHR) {
      xhrPool.remove(jqXHR)
    },
    success: function (data) {
      let lastPriceIOTUSD = ''
      if (data.length > 0) {
        lastPriceIOTUSD = data[0][7] / 1000 / 1000
      }
      callback(null, lastPriceIOTUSD)
    },
    error: function (jqXHR, errorMsg) {
      callback(errorMsg)
    }
  })
}

window.iotaToUSD = function (iota, lastPriceIOTUSD) {
  if (lastPriceIOTUSD) {
    const usd = lastPriceIOTUSD * iota
    return usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }
  return '--'
}

window.formatIota = function (balance) {
  const iota = new window.IOTA()
  let unit = 'i'

  if (balance >= 1000) {
    balance = iota.utils.convertUnits(balance, unit, 'Ki')
    unit = 'Ki'
  }
  if (balance >= 1000) {
    balance = iota.utils.convertUnits(balance, unit, 'Mi')
    unit = 'Mi'
  }
  if (balance >= 1000) {
    balance = iota.utils.convertUnits(balance, 'Mi', 'Gi')
    unit = 'Gi'
  }
  if (balance >= 1000) {
    balance = iota.utils.convertUnits(balance, 'Gi', 'Ti')
    unit = 'Ti'
  }
  balance = Math.round(balance * 100) / 100
  return balance + ' ' + unit
}

window.createXhrPool = function () {
  let xhrPool = []

  xhrPool.abortAll = function () {
    $(this).each(function (idx, jqXHR) {
      jqXHR.abort()
    })
    xhrPool = []
  }

  xhrPool.remove = function (jqXHR) {
    var index = this.indexOf(jqXHR)
    if (index > -1) {
      this.splice(index, 1)
    }
  }

  return xhrPool
}
