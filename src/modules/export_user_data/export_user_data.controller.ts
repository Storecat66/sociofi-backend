import { Request, Response } from 'express';
import { ResponseBuilder } from "../../utils/http";
import { asyncHandler } from '../../middleware/error';
import { z } from 'zod';
import { exportService } from './export_user_data.service';

// Flexible validation schema - accepts any object structure
const exportRequestSchema = z.object({
  format: z.enum(['pdf', 'excel']),
  data: z.array(z.record(z.any())) // Accept any key-value pairs
});

export class ExportUserDataController {
  /**
   * Export user data as PDF or Excel
   */
  exportUserData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Get format from query parameter to match frontend request
    const format = req.query.format as string;
    const { data } = req.body;

    // Validate the request
    const validatedData = exportRequestSchema.parse({ format, data });

    try {
      if (validatedData.format === 'excel') {
        // Generate Excel using service
        const result = await exportService.generateExcelExport(validatedData.data);
        
        // Set response headers
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        
        // Send file
        res.send(result.buffer);
        
      } else if (validatedData.format === 'pdf') {
        // Generate PDF using service
        const result = await exportService.generatePDFExport(validatedData.data);
        
        // Set response headers
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        
        // Send PDF buffer
        res.send(result.buffer);
      }
      
    } catch (error) {
      console.error('Export error:', error);
      
      if (error instanceof z.ZodError) {
        ResponseBuilder.error(res, 'Invalid request data', 400);
        return;
      }
      
      ResponseBuilder.error(res, 'Failed to export data', 500);
    }
  });
}

export const exportUserDataController = new ExportUserDataController();