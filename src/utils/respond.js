const creator = process.env.APP_CREATOR || 'Lhuciver';

function ok(result, message = 'success') {
  return {
    status: true,
    creator,
    message,
    result
  };
}

function fail(message, code = 400, extra = {}) {
  return {
    status: false,
    creator,
    code,
    message,
    ...extra
  };
}

module.exports = { ok, fail };
