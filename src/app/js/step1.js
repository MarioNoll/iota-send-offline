(function ($, window) {
  let xhrPool

  $('#step1InputForm').on('input', function (e) {
    xhrPool = xhrPool || window.createXhrPool()
    reset()
  })

  $('#step1InputForm').form({
    inline: true,
    on: 'blur',
    fields: {
      fromAddress: {
        identifier: 'inputStep1FromAddress',
        rules: [{
          type: 'isAddress',
          prompt: 'Please enter a valid address'
        }, {
          type: 'hasChecksum',
          prompt: 'Address checksum missing'
        }, {
          type: 'isValidChecksum',
          prompt: 'Invalid checksum'
        }]
      }
    },
    onSuccess: function (event) {
      event.preventDefault()
      if ($('#btnGenInfo').hasClass('disabled') ||
        $('#btnGenInfo').hasClass('loading')) {
        return
      }
      generateInformation()
    }
  })

  $('#textAreaStep1RawInformation').focus(e => $(e.target).select())

  function updateExploreAddressBtnState () {
    const address = $('#step1InputForm').form('get value', 'inputStep1FromAddress')
    if ($.fn.form.settings.rules.isAddress(address)) {
      $('#btnExploreFromAddress').removeClass('disabled')
      $('#btnExploreFromAddress').attr('href', window.addressUrl + address)
    } else {
      $('#btnExploreFromAddress').addClass('disabled')
      $('#btnExploreFromAddress').attr('href', '')
    }
  }

  function hideErrorMessage () {
    $('#generateInfoErr').addClass('hidden')
  }

  function reset () {
    xhrPool.abortAll()
    hideErrorMessage()
    updateExploreAddressBtnState()
    $('#btnGenInfo').removeClass('loading disabled')

    if ($('#infoContainer').transition('is visible') &&
      !$('#infoContainer').transition('is animating')) {
      $('#infoContainer').transition('fade up')
    } else {
      $('#infoContainer').transition('hide')
    }
  }

  function showInfoContainer () {
    $('#btnGenInfo').removeClass('loading')

    if ($('#infoContainer').transition('is animating') ||
      $('#infoContainer').transition('is visible')) {
      $('#infoContainer').transition('show')
    } else {
      $('#infoContainer').transition('fade down')
    }
  }

  function showError (errorMsg) {
    xhrPool.abortAll()
    $('#generateInfoErr').removeClass('hidden')
    $('#btnGenInfo').removeClass('loading disabled')
    $('#generateInfoErrMsg').html(errorMsg)
  }

  function generateInformation () {
    $('#btnGenInfo').addClass('loading disabled')
    hideErrorMessage()

    const fromAddress = $('#step1InputForm').form('get value', 'inputStep1FromAddress')
    const iota = new window.IOTA({ host: 'https://field.carriota.com', port: 443 })

    iota.api.wereAddressesSpentFrom([fromAddress], function (error, wereSpent) {
      if (error) {
        return showError(error)
      }

      if (wereSpent.some(spent => spent)) {
        return showError('Private Key Reuse Prohibited. <a href="https://iota.readme.io/docs/seeds-private-keys-and-accounts#section-private-keys-and-addresses" target="_blank">Read more.</a>')
      }

      getBalance()
    })

    function getBalance () {
      iota.api.getBalances([fromAddress], 100, function (err, result) {
        if (err) {
          showError('Failed to retrieve balance for given address.')
        } else {
          const balance = Number(result.balances[0])
          getProxySchema(balance)
        }
      })
    }

    function getProxySchema (balance) {
      $.ajax({
        type: 'post',
        url: window.twapi + '/v1/tx-schemas',
        crossDomain: true,
        dataType: 'json',
        beforeSend: function (jqXHR) {
          xhrPool.push(jqXHR)
        },
        complete: function (jqXHR) {
          xhrPool.remove(jqXHR)
        },
        success: function (data) {
          if (data.status === 'success') {
            showInformation(balance, data.data.schema)
          } else {
            showError('Failed to get proxy information. Please try again later.')
          }
        },
        error: function (jqXHR, errorMsg) {
          showError('Failed to get proxy information. Please try again later.')
        }
      })
    }

    function showInformation (balance, proxy) {
      window.getPrice(xhrPool, function (_, price) {
        const balanceUsd = window.iotaToUSD(balance, price)
        const feeUsd = window.iotaToUSD(proxy.iota, price)

        $('#inputGenBalanceTag').text(balanceUsd)
        $('#inputGenFeeTag').text(feeUsd)

        const balanceFormatted = window.formatIota(balance)
        $('#inputGenBalance').val(balanceFormatted)

        const feeFormatted = window.formatIota(proxy.iota)
        $('#inputGenFee').val(feeFormatted)

        const rawTxInfo = { fromAddress, security: 2, balance, proxy: { address: proxy.address, tag: proxy.tag, fee: proxy.iota } }
        $('#textAreaStep1RawInformation').text(JSON.stringify(rawTxInfo))

        showInfoContainer()
      })
    }
  }
}(jQuery, window))
