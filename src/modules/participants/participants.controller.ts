import { Request, Response } from 'express';
import { z } from 'zod';
import { participantsService } from './participants.service';
import { ResponseBuilder } from '../../utils/http';
import { asyncHandler } from '../../middleware/error';

// Validation schemas
const getParticipantsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  offset: z.coerce.number().min(0).optional().default(0),
  search: z.string().min(1).optional(),
  order: z.enum(['created_asc', 'created_desc']).optional().default('created_desc'),
  country: z.string().min(2).max(2).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
});

const participantIdParamsSchema = z.object({
  id: z.string().min(1),
});

const searchParticipantsQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  offset: z.coerce.number().min(0).optional().default(0),
  order: z.enum(['created_asc', 'created_desc']).optional().default('created_desc'),
  country: z.string().min(2).max(2).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export class ParticipantsController {
  /**
   * GET /api/participants
   * Get paginated list of participants with filtering and sorting
   */
  getParticipants = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = getParticipantsQuerySchema.parse(req.query);

    // Filter out undefined values to match strict optional types
    const options: any = {
      limit: query.limit,
      offset: query.offset,
      order: query.order,
    };
    
    if (query.search !== undefined) options.search = query.search;
    if (query.country !== undefined) options.country = query.country;
    if (query.dateFrom !== undefined) options.dateFrom = query.dateFrom;
    if (query.dateTo !== undefined) options.dateTo = query.dateTo;
    if (query.status !== undefined) options.status = query.status;

    console.log('Fetching participants with options:', options);

    const result = await participantsService.getParticipants(options);

    // Transform to match the expected paginated response format
    const response = {
      success: true,
      data: result.participants,
      message: 'Participants retrieved successfully',
      pagination: {
        hasNext: result.hasNext,
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
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
    
    const participant = await participantsService.getParticipantById(id);
    
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

    // Filter out undefined values to match strict optional types
    const options: any = {
      limit: query.limit,
      offset: query.offset,
      order: query.order,
    };
    
    if (query.country !== undefined) options.country = query.country;
    if (query.dateFrom !== undefined) options.dateFrom = query.dateFrom;
    if (query.dateTo !== undefined) options.dateTo = query.dateTo;

    const result = await participantsService.searchParticipants(query.q, options);

    const response = {
      success: true,
      data: result.participants,
      message: `Found ${result.participants.length} participants`,
      pagination: {
        hasNext: result.hasNext,
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      },
      query: query.q,
    };

    res.status(200).json(response);
  });

  /**
   * GET /api/participants/stats
   * Get participants statistics
   */
  getParticipantsStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await participantsService.getParticipantsStats();
    
    ResponseBuilder.success(res, stats, 'Participants statistics retrieved successfully');
  });

  /**
   * GET /api/participants/countries
   * Get list of unique countries from participants
   */
  getCountries = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const countries = await participantsService.getCountries();
    
    ResponseBuilder.success(res, countries, 'Countries retrieved successfully');
  });

  /**
   * GET /api/participants/filters
   * Get available filter options
   */
  getFilterOptions = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const countries = await participantsService.getCountries();
    
    const filterOptions = {
      countries: countries.map(country => ({
        value: country,
        label: country,
      })),
      orders: [
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
