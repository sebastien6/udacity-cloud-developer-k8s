import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import errorMiddleware from './middleware/error.middleware';
import connect from 'connect-timeout';
import { IndexRouter } from './controllers/v0/index.router'

//var timeout = require('connect-timeout');

(async () => {

  // Init the Express application
  const app = express();

  // Set the network port
  const port = process.env.PORT || 8080;
  
  // Use the body parser middleware for post requests
  app.use(bodyParser.json());

  // logger middleware
  app.use(morgan('short'));

  // request timeout middleware
  app.use(connect('10s'));

  // error handler middleware
  app.use(errorMiddleware);

  //CORS Should be restricted
  app.use(function(req: Request, res: Response, next: NextFunction) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
  });

  // Root Endpoint
  // Displays a simple message to the user
  app.use('/api/v0/', IndexRouter)

  // Root URI call
  app.get( "/", async ( req: Request, res: Response ) => {
    res.send( "/api/v0/" );
  } );

  // Start the Server
  app.listen( port, () => {
      console.log( `server running http://localhost:${ port }` );
      console.log( `press CTRL+C to stop server` );
  } );
})();