// Global error handler - catches any unhandled errors passed via next(err)
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message,
    // Show stack trace only in development
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export default errorHandler;
