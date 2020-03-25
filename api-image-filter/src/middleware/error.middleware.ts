import { NextFunction, Request, Response } from 'express';
import HttpException from '../exceptions/http.exception';

function errorMiddleware(error: HttpException, request: Request, response: Response, next: NextFunction) {
  const status = error.status || 500;
  const message = error.message || 'We are sorry. We were not able to process your request. Please try again later...';
  response
    .status(status)
    .send({
      message,
      status,
    });
}

export default errorMiddleware;