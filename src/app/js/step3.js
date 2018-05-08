(function ($, window) {
  let xhrPool
  const iota = new window.IOTA({ host: 'https://field.carriota.com', port: 443 })

  $('#step3InputForm').on('input', function (e) {
    xhrPool = xhrPool || window.createXhrPool()
    cancel()
  })

  $('#textAreaStep3SignedTransaction').keypress(function (e) {
    if (e.which === 13 && !e.shiftKey) {
      $('#step3InputForm').form('submit')
      e.preventDefault()
      return false
    }
  })

  $('#step3InputForm').form({
    inline: true,
    on: 'blur'
  })

  $('#textAreaStep3SignedTransaction').blur(function () {
    const trytes = $('#step3InputForm').form('get value', 'textAreaStep3SignedTransaction')

    if (!trytes) {
      showInputError(true)
      return
    }

    $('#step3InputForm').find('.error').removeClass('error').find('.prompt').remove()
  })

  $('#step3InputForm').submit(function (event) {
    event.preventDefault()

    if ($('#btnSendTransaction').hasClass('disabled') ||
      $('#btnSendTransaction').hasClass('loading') ||
      $('#step3Input').hasClass('error')) {
      return
    }

    hideErrorMessage()
    $('#btnSendTransaction').addClass('loading disabled')
    setTimeout(validateSignedTransaction, 50)
  })

  $('#textAreaStep3SignedTransaction').focus(e => $(e.target).select())
  $('#bundleHashSuccess').click(e => $(e.target).select())
  $('#bundleHashDuplicate').click(e => $(e.target).select())
  $('#confirmFromAddress').focus(e => $(e.target).select())
  $('#confirmToAddress').focus(e => $(e.target).select())
  $('#confirmRemainderAddress').focus(e => $(e.target).select())

  $('.formLabel, .checksum').popup()
  $('.ui.accordion').accordion()

  function validateSignedTransaction () {
    const trytes = $('#step3InputForm').form('get value', 'textAreaStep3SignedTransaction')
    const bundle = getBundle(trytes)
    if (!bundle) {
      $('#btnSendTransaction').removeClass('loading disabled')
      showInputError()
      return
    }

    showConfirmationModal(trytes, bundle)
  }

  function getBundle (trytes) {
    try {
      trytes = JSON.parse(trytes)
      const bundle = []

      for (let i = 0; i < trytes.length; i++) {
        let txObject = iota.utils.transactionObject(trytes[i])
        bundle.push(txObject)
      }
      return iota.utils.isBundle(bundle) ? bundle : false
    } catch (err) {
      return false
    }
  }

  function showInputError (empty) {
    if (empty) {
      $('#step3InputForm').form('add prompt', 'textAreaStep3SignedTransaction', 'Paste Signed Transaction from Step 2 here.')
    } else {
      $('#step3InputForm').form('add prompt', 'textAreaStep3SignedTransaction', 'Invalid Transaction! Paste Signed Transaction from Step 2 here.')
    }
  }

  function cancel () {
    xhrPool.abortAll()
    hideErrorMessage()
    $('#btnSendTransaction').removeClass('loading disabled')
  }

  function hideErrorMessage () {
    $('#sendTxErr').addClass('hidden')
  }

  function resetConfirmModal () {
    $('#btnConfirmSubmit').removeClass('loading disabled')
    $('#btnConfirmCancel').removeClass('disabled')
  }

  function showError (errorMsg) {
    resetConfirmModal()
    $('#confirmModal').modal('hide')
    xhrPool.abortAll()

    $('#sendTxErr').removeClass('hidden')
    $('#btnSendTransaction').removeClass('loading disabled')
    $('#sendTxErrMsg').text(errorMsg)
  }

  function showSuccess (bundleHash) {
    resetConfirmModal()

    $('#bundleHashSuccess').val(bundleHash)
    $('#btnExploreBundleHashSuccess').attr('href', window.bundleUrl + bundleHash)
    $('#successModal').modal({
      closable: false,
      blurring: true
    }).modal('show')
  }

  function showDuplicate (bundleHash) {
    resetConfirmModal()

    $('#bundleHashDuplicate').val(bundleHash)
    $('#btnExploreBundleHashDuplicate').attr('href', window.bundleUrl + bundleHash)

    $('#duplicateModal').modal({
      closable: false,
      blurring: true
    }).modal('show')
  }

  function showConfirmationModal (trytes, bundle) {
    window.getPrice(xhrPool, function (_, price) {
      $('#btnSendTransaction').removeClass('loading disabled')

      for (let i = 0; i < bundle.length; i++) {
        if (bundle[i].tag.includes(window.workerTagPrefix)) {
          const fee = window.formatIota(bundle[i].value)
          const feeUsd = window.iotaToUSD(bundle[i].value, price)

          $('#confirmFee').val(fee)
          $('#confirmFeeTag').text(feeUsd)
        } else if (bundle[i].tag.includes(window.remainderTag)) {
          // $('#confirmRemainderAddressDiv').removeClass('hidden')

          const address = iota.utils.addChecksum(bundle[i].address)
          $('#confirmRemainderAddress').val(address)
          $('#btnExploreConfirmRemainderAddress').attr('href', window.addressUrl + address)
        } else if (bundle[i].value < 0) {
          const address = iota.utils.addChecksum(bundle[i].address)

          $('#confirmFromAddress').val(address)
          $('#btnExploreConfirmFromAddress').attr('href', window.addressUrl + address)
        } else if (bundle[i].value > 0) {
          const value = window.formatIota(bundle[i].value)
          const valueUsd = window.iotaToUSD(bundle[i].value, price)

          $('#confirmValue').val(value)
          $('#confirmValueTag').text(valueUsd)

          const address = iota.utils.addChecksum(bundle[i].address)
          $('#confirmToAddress').val(address)
          $('#btnExploreConfirmToAddress').attr('href', window.addressUrl + address)
        }
      }

      $('#confirmModal').modal({
        closable: false,
        blurring: true
      }).modal('show')

      $('#btnConfirmSubmit').unbind()
        .click(function (event) {
          $('#btnConfirmSubmit').addClass('loading disabled')
          $('#btnConfirmCancel').addClass('disabled')
          sendTransaction(trytes, bundle[0].bundle)
        })
    })
  }

  function sendTransaction (trytes, bundleHash) {
    $.ajax({
      type: 'post',
      url: window.twapi + '/v1/bundles',
      crossDomain: true,
      contentType: 'application/json',
      data: trytes,
      dataType: 'json',
      beforeSend: function (jqXHR) {
        xhrPool.push(jqXHR)
      },
      complete: function (jqXHR) {
        xhrPool.remove(jqXHR)
      },
      success: function (data) {
        if (data.status === 'success') {
          showSuccess(bundleHash)
        } else {
          showError('Failed to send transaction to proxy. Please try again later.')
        }
      },
      error: function (jqXHR, errorMsg) {
        if (jqXHR.status === 409) {
          showDuplicate(bundleHash)
        } else if (jqXHR.status === 400 || jqXHR.status === 401) {
          const response = JSON.parse(jqXHR.responseText)
          showError(response.data)
        } else {
          showError('Failed to send transaction to proxy. Please try again later.')
        }
      }
    })
  }
}(jQuery, window))
