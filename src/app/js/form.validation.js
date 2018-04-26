(function ($, window) {
  const iota = new window.IOTA()
  const seedLength = 81
  const addressLength = 90

  $.fn.form.settings.rules.isAddress = function (value) {
    return iota.valid.isAddress(value)
  }

  $.fn.form.settings.rules.hasChecksum = function (value) {
    return value.length === addressLength
  }

  $.fn.form.settings.rules.isValidChecksum = function (value) {
    return iota.valid.isAddress(value) && iota.utils.isValidChecksum(value)
  }

  $.fn.form.settings.rules.isSeed = function (value) {
    return iota.valid.isTrytes(value, seedLength)
  }

  $.fn.form.settings.rules.isGreaterZero = function (value) {
    return Number(value) > 0
  }

  $.fn.form.settings.rules.isBalanceSufficient = function (value) {
    let schema = $('#step2InputForm').form('get value', 'textAreaStep2RawInformation')
    schema = JSON.parse(schema)

    value = Number(value)
    const currentUnit = $('#dropDownValueUnit').dropdown('get value')
    value = iota.utils.convertUnits(value, currentUnit, 'i')
    return value <= schema.balance - schema.proxy.fee
  }

  $.fn.form.settings.rules.isRawInformationValid = function (value) {
    try {
      const rawInfo = JSON.parse(value)

      const addressValid = iota.valid.isAddress(rawInfo.fromAddress) && iota.utils.isValidChecksum(rawInfo.fromAddress)
      const securityValid = Number.isInteger(rawInfo.security) && rawInfo.security >= 1 && rawInfo.security <= 3
      const balanceValid = Number.isInteger(rawInfo.balance)

      const proxyAddressValid = iota.valid.isAddress(rawInfo.proxy.address) && iota.utils.isValidChecksum(rawInfo.proxy.address)
      const tagValid = iota.valid.isTrytes(rawInfo.proxy.tag, 27)
      const feeValid = Number.isInteger(rawInfo.proxy.fee)

      return addressValid && securityValid && balanceValid && proxyAddressValid && tagValid && feeValid
    } catch (err) {
      return false
    }
  }
}(jQuery, window))
