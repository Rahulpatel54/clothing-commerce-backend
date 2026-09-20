'use strict';

function success(res, { data = null, message = 'OK', statusCode = 200, meta } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
    requestId: res.req.id,
  });
}

function paginated(res, { rows, count, page, limit, message = 'OK' }) {
  return success(res, {
    data: rows,
    message,
    meta: {
      total: count,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(count / limit) : 0,
      hasNextPage: page * limit < count,
    },
  });
}

module.exports = { success, paginated };
