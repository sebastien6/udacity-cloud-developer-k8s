import { Router, Request, Response } from 'express';
import { FilteredImage } from './filteredimage/filteredimage.router';

const router: Router = Router();

router.use('/filteredimage', FilteredImage);

router.get('/', async (req: Request, res: Response) => {    
    res.send(`V0`);
});

export const IndexRouter: Router = router;