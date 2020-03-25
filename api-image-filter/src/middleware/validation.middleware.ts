import { NextFunction, Request, Response } from 'express';
import isURL from 'validator/lib/isURL';
import urlExist from 'url-exist';

const validationImageURL = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const imageUrl = req.query.image_url;

    if (!imageUrl) {
      return res.status(400).send({ message: 'Image url is required' });
    }
    
    if (!isURL(imageUrl)) {
      return res.status(400).send({ message: 'Invalid url format passed as argument' });
    }

    const exists = await urlExist(imageUrl);
    if (!exists) {
      return res.status(404).send({ message: 'Invalid url, not found!' });
    } else {
      next();
    }
  }
};

export default validationImageURL;
