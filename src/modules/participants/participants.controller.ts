import { Request, Response } from 'express';
import { z } from 'zod';
import { participantsService } from './participants.service';
import { ResponseBuilder } from '../../utils/http';
import { asyncHandler } from '../../middleware/error';

// Validation schemas
const getParticipantsQuerySchema = z.object({
  limit: z.coerce.number().min(1).optional().default(10),
  page: z.coerce.number().min(1).optional().default(1),
  search: z.string().min(1).optional(),
  sort: z.enum(['created_asc', 'created_desc']).optional().default('created_desc'),
  country: z.string().min(2).max(2).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const participantIdParamsSchema = z.object({
  id: z.string().min(1),
});

const searchParticipantsQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  page: z.coerce.number().min(1).optional().default(1),
  sort: z.enum(['created_asc', 'created_desc']).optional().default('created_desc'),
  country: z.string().min(2).max(2).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export class ParticipantsController {
  /**
   * GET /api/participants
   * Get paginated list of participants with filtering and sorting
   */
  getParticipants = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = getParticipantsQuerySchema.parse(req.query);
    const promo_id = req.params.promo_id;

    // Convert page to offset for internal service
    const offset = (query.page - 1) * query.limit;

    // Filter out undefined values to match strict optional types
    const options: any = {
      limit: query.limit,
      offset: offset,
      sort: query.sort,
    };
    
    if (query.search !== undefined) options.search = query.search;
    if (query.country !== undefined) options.country = query.country;
    if (query.dateFrom !== undefined) options.dateFrom = query.dateFrom;
    if (query.dateTo !== undefined) options.dateTo = query.dateTo;
    if (query.status !== undefined) options.status = query.status;

    console.log('Fetching participants with options:', options);
    console.log(`Date range filter: ${query.dateFrom || 'none'} to ${query.dateTo || 'none'}`);

    const result = await participantsService.getParticipants(options, promo_id);

    // Transform to match the expected paginated response format
    const response = {
      success: true,
      data: result.participants,
      message: 'Participants retrieved successfully',
      pagination: {
        hasNext: result.hasNext,
        page: query.page,
        totalPages: result.totalPages,
        total: result.total,
        totalParticipants: result.totalParticipants,
        limit: query.limit,
        offset: offset,
      },
    };

    res.status(200).json(response);
  });

  /**
   * GET /api/participants/:id
   * Get participant by ID
   */
  getParticipantById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = participantIdParamsSchema.parse(req.params);
    const promo_id = req.params.promo_id;
    
    const participant = await participantsService.getParticipantById(id, promo_id);
    
    if (!participant) {
      ResponseBuilder.error(res, 'Participant not found', 404);
      return;
    }
    
    ResponseBuilder.success(res, participant, 'Participant retrieved successfully');
  });

  /**
   * GET /api/participants/search
   * Search participants by email, name, or phone
   */
  searchParticipants = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = searchParticipantsQuerySchema.parse(req.query);
    const promo_id = req.params.promo_id;

    // Convert page to offset for internal service
    const offset = (query.page - 1) * query.limit;

    // Filter out undefined values to match strict optional types
    const options: any = {
      limit: query.limit,
      offset: offset,
      sort: query.sort,
    };
    
    if (query.country !== undefined) options.country = query.country;
    if (query.dateFrom !== undefined) options.dateFrom = query.dateFrom;
    if (query.dateTo !== undefined) options.dateTo = query.dateTo;
    if (query.status !== undefined) options.status = query.status;

    const result = await participantsService.searchParticipants(query.q, options, promo_id);

    const response = {
      success: true,
      data: result.participants,
      message: `Found ${result.participants.length} participants`,
      pagination: {
        hasNext: result.hasNext,
        page: query.page,
        totalPages: result.totalPages,
        total: result.total,
        totalParticipants: result.totalParticipants,
        limit: query.limit,
        offset: offset,
      },
      query: query.q,
    };

    res.status(200).json(response);
  });

  /**
   * GET /api/participants/stats
   * Get participants statistics
   */
  getParticipantsStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const promo_id = req.params.promo_id;
    const stats = await participantsService.getParticipantsStats(promo_id);
    
    ResponseBuilder.success(res, stats, 'Participants statistics retrieved successfully');
  });

  /**
   * GET /api/participants/countries
   * Get list of unique countries from participants
   */
  getCountries = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const promo_id = req.params.promo_id;
    const countries = await participantsService.getCountries(promo_id);
    
    ResponseBuilder.success(res, countries, 'Countries retrieved successfully');
  });

  /**
   * GET /api/participants/filters
   * Get available filter options
   */
  getFilterOptions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const promo_id = req.params.promo_id;
    const countries = await participantsService.getCountries(promo_id);
    
    const filterOptions = {
      countries: countries.map(country => ({
        value: country,
        label: country,
      })),
      sorts: [
        { value: 'created_desc', label: 'Newest First' },
        { value: 'created_asc', label: 'Oldest First' },
      ],
      statuses: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    };
    
    ResponseBuilder.success(res, filterOptions, 'Filter options retrieved successfully');
  });
}

export const participantsController = new ParticipantsController();
