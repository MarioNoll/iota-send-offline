(function ($, window) {
  const iota = new window.IOTA()
  let abort = false

  $('#step2InputForm').on('input', function (e) {
    cancel()
  })

  $('#inputSeed').on('input', function (e) {
    const seed = $('#step2InputForm').form('get value', 'inputSeed')
    const checksum = $.fn.form.settings.rules.isSeed(seed)
      ? iota.utils.addChecksum(seed, 3, false).substr(-3)
      : '---'

    $('#seedChecksum').text(checksum)
  })

  $('#dropDownValueUnit').dropdown({
    action: function (value, newUnit) {
      $('#dropDownValueUnit').dropdown('set text', newUnit)
      $('#dropDownValueUnit').dropdown('set selected', newUnit)
      $('#dropDownValueUnit').dropdown('hide')
      $('#step2InputForm').form('validate field', 'value')
    },
    values: [
      {
        name: 'i',
        value: 'i'
      },
      {
        name: 'Ki',
        value: 'Ki'
      },
      {
        name: 'Mi',
        value: 'Mi',
        selected: true
      },
      {
        name: 'Gi',
        value: 'Gi'
      },
      {
        name: 'Ti',
        value: 'Ti'
      }
    ]
  })

  $('#step2InputForm').form({
    inline: true,
    on: 'blur',
    fields: {
      step1Info: {
        identifier: 'textAreaStep2RawInformation',
        rules: [{
          type: 'isRawInformationValid',
          prompt: 'Invalid Information! Paste Raw Information from Step 1 here.'
        }]
      },
      value: {
        identifier: 'inputValue',
        depends: 'textAreaStep2RawInformation',
        rules: [
          {
            type: 'empty',
            prompt: 'Value must not be empty'
          }, {
            type: 'number',
            prompt: 'Please enter a valid number'
          }, {
            type: 'isGreaterZero',
            prompt: 'Please enter a valid number'
          }, {
            type: 'isBalanceSufficient',
            prompt: 'Not enough balance on address'
          }
        ]
      },
      toAddress: {
        identifier: 'inputToAddress',
        rules: [{
          type: 'isAddress',
          prompt: 'Please enter a valid address'
        }, {
          type: 'hasChecksum',
          prompt: 'Address checksum is missing'
        }, {
          type: 'isValidChecksum',
          prompt: 'Invalid checksum'
        }]
      },
      seed: {
        identifier: 'inputSeed',
        rules: [{
          type: 'isSeed',
          prompt: 'Please enter a valid seed'
        }]
      }
    },
    onSuccess: function (event) {
      event.preventDefault()
      if ($('#btnCreateTx').hasClass('disabled') ||
        $('#btnCreateTx').hasClass('loading')) {
        return
      }
      createTransaction()
    }
  })

  $('#btnValueMax').click(function () {
    const schemaValid = $('#step2InputForm').form('is valid', 'step1Info')
    if (!schemaValid) {
      return
    }

    let schema = $('#step2InputForm').form('get value', 'textAreaStep2RawInformation')
    schema = JSON.parse(schema)

    const currentUnit = $('#dropDownValueUnit').dropdown('get value')
    let max = Math.max(schema.balance - schema.proxy.fee, 0)
    max = iota.utils.convertUnits(max, 'i', currentUnit)

    $('#inputValue').val(max)
    if (max !== 0) {
      $('#step2InputForm').form('validate field', 'value')
    }
  })

  $('#textAreaStep2RawInformation').focus(e => $(e.target).select())
  $('#textAreaSignedTransaction').focus(e => $(e.target).select())
  $('#textAreaSignedTransaction').dblclick(e => $(e.target).select())

  $('#createTxInfoBtnCancel').click(function (event) {
    cancel()
  })

  function cancel () {
    hideErrorMessage()
    hideTransactionContainer()
    $('#btnCreateTx').removeClass('loading disabled')
    $('#createTxWarning').transition('hide')
    abort = true
  }

  function hideErrorMessage () {
    $('#createTxErr').addClass('hidden')
  }

  function hideTransactionContainer () {
    if ($('#txContainer').transition('is animating') ||
      !$('#txContainer').transition('is visible')) {
      $('#txContainer').transition('hide')
    } else {
      $('#txContainer').transition('fade up')
    }
  }

  function showTransactionContainer () {
    $('#btnCreateTx').removeClass('loading')

    if ($('#txContainer').transition('is animating') ||
      $('#txContainer').transition('is visible')) {
      $('#txContainer').transition('show')
    } else {
      $('#txContainer').transition('fade down')
    }
  }

  function showError (errorMsg) {
    $('#createTxErr').removeClass('hidden')
    $('#btnCreateTx').removeClass('loading disabled')
    $('#createTxErrMsg').text(errorMsg)
  }

  function createTransaction () {
    $('#btnCreateTx').addClass('loading disabled')
    hideErrorMessage()
    abort = false

    let rawInfo = $('#step2InputForm').form('get value', 'textAreaStep2RawInformation')
    rawInfo = JSON.parse(rawInfo)

    const fromAddress = iota.utils.noChecksum(rawInfo.fromAddress)

    const currentUnit = $('#dropDownValueUnit').dropdown('get value')
    let value = $('#step2InputForm').form('get value', 'inputValue')
    value = iota.utils.convertUnits(value, currentUnit, 'i')

    const toAddress = $('#step2InputForm').form('get value', 'inputToAddress')
    const seed = $('#step2InputForm').form('get value', 'inputSeed')

    setTimeout(function () {
      findInputAddressIndex(0)
    }, 50)

    function findInputAddressIndex (index) {
      iota.api.getNewAddress(seed, { index, total: 1, security: rawInfo.security }, function (err, addresses) {
        if (err) {
          return showError(err)
        }

        if (addresses[0] !== fromAddress) {
          setTimeout(function () {
            if (!abort && updateRemainderInfo(index)) {
              findInputAddressIndex(++index)
            }
          }, 50)
        } else {
          setInputs(index)
        }
      })
    }

    function setInputs (keyIndex) {
      const inputs = [{
        address: fromAddress,
        balance: rawInfo.balance,
        security: rawInfo.security,
        keyIndex
      }]

      const transfers = [{
        // Fee
        address: iota.utils.noChecksum(rawInfo.proxy.address),
        value: rawInfo.proxy.fee,
        tag: rawInfo.proxy.tag
      }, {
        // Transaction
        address: iota.utils.noChecksum(toAddress),
        value,
        tag: window.defaultTag
      }]

      addRemainder(inputs, transfers)
    }

    function addRemainder (inputs, transfers) {
      const remainder = rawInfo.balance - rawInfo.proxy.fee - value

      if (remainder !== 0) {
        const index = inputs[0].keyIndex + 1
        iota.api.getNewAddress(seed, { index, total: 1, security: rawInfo.security }, function (err, addresses) {
          if (err) {
            return showError(err)
          }

          transfers.push({
            address: addresses[0],
            value: remainder,
            tag: window.remainderTag
          })

          signTransaction(inputs, transfers)
        })
      } else {
        signTransaction(inputs, transfers)
      }
    }

    function updateRemainderInfo (addressIndex) {
      if ((addressIndex + 1) % 16 === 0) {
        showWarning()

        $('#createTxInfoBtnContinue').unbind()
          .click(function (event) {
            hideWarning()
            setTimeout(function () {
              findInputAddressIndex(++addressIndex)
            }, 200)
          })

        return false
      }
      return true

      function showWarning () {
        if ($('#createTxWarning').transition('is visible')) {
          $('#createTxWarning').transition('show')
        } else {
          $('#createTxWarning').transition('fade')
        }

        $('#btnCreateTx').removeClass('loading')
        $('#createTxWarningMsg').html('Address calculation is taking longer then usual. Current index: ' + addressIndex + '<br>Consult the help page to see why this can happen.')
      }

      function hideWarning () {
        $('#createTxWarning').transition('hide')
        $('#btnCreateTx').addClass('loading')
      }
    }

    function signTransaction (inputs, transfers) {
      const bundle = new window.Bundle()
      const signatureFragment = getSignatureFragment()
      const signatureFragments = []

      for (let i = 0; i < transfers.length; i++) {
        signatureFragments.push(signatureFragment)
        const timestamp = Math.floor(Date.now() / 1000)

        bundle.addEntry(1, transfers[i].address, transfers[i].value, transfers[i].tag, timestamp)
      }

      for (let i = 0; i < inputs.length; i++) {
        const timestamp = Math.floor(Date.now() / 1000)
        bundle.addEntry(inputs[i].security, inputs[i].address, 0 - inputs[i].balance, window.defaultTag, timestamp)
      }

      // Signing corresponds to signInputsAndReturn from iota.lib.js api
      // https://github.com/iotaledger/iota.lib.js/blob/master/lib/api/api.js

      bundle.finalize()
      bundle.addTrytes(signatureFragments)

      for (let i = 0; i < bundle.bundle.length; i++) {
        if (bundle.bundle[i].value < 0) {
          const thisAddress = bundle.bundle[i].address

          // Get the corresponding keyIndex and security of the address
          let keyIndex
          let keySecurity
          for (let k = 0; k < inputs.length; k++) {
            if (inputs[k].address === thisAddress) {
              keyIndex = inputs[k].keyIndex
              keySecurity = inputs[k].security
              break
            }
          }

          const bundleHash = bundle.bundle[i].bundle

          // Get corresponding private key of address
          const key = window.Signing.key(window.Converter.trits(seed), keyIndex, keySecurity)

          //  Get the normalized bundle hash
          const normalizedBundleHash = bundle.normalizedBundle(bundleHash)
          const normalizedBundleFragments = []

          // Split hash into 3 fragments
          for (let l = 0; l < 3; l++) {
            normalizedBundleFragments[l] = normalizedBundleHash.slice(l * 27, (l + 1) * 27)
          }

          //  First 6561 trits for the firstFragment
          const firstFragment = key.slice(0, 6561)

          //  First bundle fragment uses the first 27 trytes
          const firstBundleFragment = normalizedBundleFragments[0]

          //  Calculate the new signatureFragment with the first bundle fragment
          const firstSignedFragment = window.Signing.signatureFragment(firstBundleFragment, firstFragment)

          //  Convert signature to trytes and assign the new signatureFragment
          bundle.bundle[i].signatureMessageFragment = window.Converter.trytes(firstSignedFragment)

          // if user chooses higher than 27-tryte security
          // for each security level, add an additional signature
          for (let j = 1; j < keySecurity; j++) {
            //  Because the signature is > 2187 trytes, we need to
            //  find the subsequent transaction to add the remainder of the signature
            //  Same address as well as value = 0 (as we already spent the input)
            if (bundle.bundle[i + j].address === thisAddress && bundle.bundle[i + j].value === 0) {
              // Use the next 6561 trits
              const nextFragment = key.slice(6561 * j, (j + 1) * 6561)

              const nextBundleFragment = normalizedBundleFragments[j]

              //  Calculate the new signature
              const nextSignedFragment = window.Signing.signatureFragment(nextBundleFragment, nextFragment)

              //  Convert signature to trytes and assign it again to this bundle entry
              bundle.bundle[i + j].signatureMessageFragment = window.Converter.trytes(nextSignedFragment)
            }
          }
        }
      }

      const bundleTrytes = []

      // Convert all bundle entries into trytes
      bundle.bundle.forEach(function (tx) {
        bundleTrytes.push(iota.utils.transactionTrytes(tx))
      })

      $('#textAreaRawTransaction').text(JSON.stringify({ inputs, transfers }))
      $('#textAreaSignedTransaction').text(JSON.stringify(bundleTrytes))
      showTransactionContainer()

      function getSignatureFragment () {
        let signatureFragment = ''
        for (let j = 0; signatureFragment.length < 2187; j++) {
          signatureFragment += '9'
        }
        return signatureFragment
      }
    }
  }
}(jQuery, window))
