import { NextFunction, Router, Request, Response } from 'express';
import validationImageURL from '../../../middleware/validation.middleware';
import {filterImageFromURL, deleteLocalFiles} from '../../../util/util';

const router: Router = Router();

// filteredimage Endpoint
  // take an image url and return the filtered image
  router.get("/", validationImageURL(), async ( req: Request, res: Response, next: NextFunction ) => {
    const filteredImagePath: string = await filterImageFromURL(req.query.image_url);

    try {
      res.sendFile(filteredImagePath, async(err: Error) => {
        if(err) {
          res.status(500).end();
        }
        else {
          console.log('image %s filtered successfuly', filteredImagePath)
        }
      });
    } catch(err) {
      next(err);
    }

    res.on('finish', () => {
      deleteLocalFiles([filteredImagePath]);
      console.log('image %s deleted successfuly', filteredImagePath)
    })
  
 });

 export const FilteredImage: Router = router;