import * as XLSX from 'xlsx';
import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// Flexible types - accepts any data structure
export type ExportData = Record<string, any>;

export interface ExcelExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface PDFExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export class ExportService {
  /**
   * Extract all unique column keys from data
   */
  private extractColumns(data: ExportData[]): string[] {
    if (!data || data.length === 0) return [];
    
    const columnSet = new Set<string>();
    
    // Collect all keys from all objects
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        // Exclude nested 'full' object if present
        if (key !== 'full') {
          columnSet.add(key);
        }
      });
    });
    
    return Array.from(columnSet);
  }

  /**
   * Flatten nested objects and format values
   */
  private flattenData(data: ExportData[]): ExportData[] {
    return data.map(item => {
      const flattened: ExportData = {};
      
      Object.keys(item).forEach(key => {
        if (key === 'full') {
          // Skip the 'full' nested object
          return;
        }
        
        const value = item[key];
        
        // Handle different value types
        if (value === null || value === undefined) {
          flattened[key] = '';
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          // Convert objects to JSON string
          flattened[key] = JSON.stringify(value);
        } else if (Array.isArray(value)) {
          // Convert arrays to comma-separated string
          flattened[key] = value.join(', ');
        } else {
          flattened[key] = value;
        }
      });
      
      return flattened;
    });
  }

  /**
   * Format column name for display (convert snake_case to Title Case)
   */
  private formatColumnName(columnName: string): string {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate Excel file from user data
   */
  async generateExcelExport(data: ExportData[]): Promise<ExcelExportResult> {
    if (!data || data.length === 0) {
      throw new Error('No data provided for export');
    }

    // Flatten the data
    const flattenedData = this.flattenData(data);
    
    // Extract columns
    const columns = this.extractColumns(flattenedData);
    
    // Create worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(flattenedData, { header: columns });
    
    // Set dynamic column widths based on content
    worksheet['!cols'] = columns.map(() => ({ wch: 20 }));

    // Add styling to headers
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "4F46E5" } },
        color: { rgb: "FFFFFF" }
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export Data');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return {
      buffer,
      filename: `data-export-${new Date().toISOString().split('T')[0]}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  /**
   * Generate PDF file from user data using pdfmake
   */
  async generatePDFExport(data: ExportData[]): Promise<PDFExportResult> {
    if (!data || data.length === 0) {
      throw new Error('No data provided for export');
    }

    // Flatten the data
    const flattenedData = this.flattenData(data);
    
    // Extract columns
    const columns = this.extractColumns(flattenedData);

    // Define fonts for pdfmake
    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const printer = new PdfPrinter(fonts);

    // Create table header
    const tableHeader = columns.map(col => ({
      text: this.formatColumnName(col),
      style: 'tableHeader',
      bold: true
    }));

    // Create table body
    const tableBody: any[][] = [tableHeader];
    
    flattenedData.forEach(row => {
      const rowData = columns.map(col => {
        const value = row[col];
        const displayValue = value !== null && value !== undefined ? String(value) : '';
        
        // Special styling for status columns
        if (col.toLowerCase().includes('status')) {
          const isActive = displayValue.toLowerCase() === 'active';
          return {
            text: displayValue,
            fillColor: isActive ? '#dcfce7' : '#fef3c7',
            color: isActive ? '#15803d' : '#d97706',
            fontSize: 8
          };
        }
        
        return { text: displayValue, fontSize: 8 };
      });
      
      tableBody.push(rowData);
    });

    // Calculate column widths dynamically
    const columnWidth = Math.floor(500 / columns.length);
    const columnWidths = columns.map(() => columnWidth);

    // Document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 60, 20, 40],
      header: {
        columns: [
          {
            text: 'Data Export Report',
            style: 'header',
            alignment: 'center',
            margin: [0, 20, 0, 0]
          }
        ]
      },
      content: [
        {
          text: `Generated on: ${new Date().toLocaleString()}`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        {
          text: `Total Records: ${data.length} | Total Columns: ${columns.length}`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 15]
        },
        {
          table: {
            headerRows: 1,
            widths: columnWidths,
            body: tableBody
          },
          layout: {
            fillColor: (rowIndex: number) => {
              return rowIndex === 0 ? '#4f46e5' : (rowIndex % 2 === 0 ? '#f8fafc' : null);
            },
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 4,
            paddingBottom: () => 4
          }
        }
      ],
      footer: (currentPage: number, pageCount: number) => {
        return {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          margin: [0, 10, 0, 0]
        };
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: '#4f46e5'
        },
        subheader: {
          fontSize: 10,
          color: '#666666'
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          color: 'white',
          fillColor: '#4f46e5'
        }
      },
      defaultStyle: {
        font: 'Roboto'
      }
    };

    // Generate PDF
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        pdfDoc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            filename: `data-export-${new Date().toISOString().split('T')[0]}.pdf`,
            contentType: 'application/pdf'
          });
        });

        pdfDoc.on('error', (error: Error) => {
          reject(error);
        });

        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const exportService = new ExportService();