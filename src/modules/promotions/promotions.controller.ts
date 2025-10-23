import { Request, Response } from 'express';
import env from '../../config/env';
import axios from 'axios';


export const promotionsController = {
  /**
   * GET /api/promotions/active
   * Get list of active promotions
   */
  getActivePromotions: async (req: Request, res: Response): Promise<void> => {
    // Placeholder logic for fetching active promotions
    const easy_promo_promotion_fetching_url = env.EASY_PROMO_PROMOTION_FETCH_URL;
    const easy_promo_api_key = env.EASY_PROMO_API_KEY;

    // fetching the promotions from EasyPromo API
    try {
      const response = await axios.get(easy_promo_promotion_fetching_url, {
        headers: { Authorization: `Bearer ${easy_promo_api_key}` },
      });

      if (response.status !== 200) {
        throw new Error('Failed to fetch promotions');
      }

      const promotions = response.data;
      res.json(promotions);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};
