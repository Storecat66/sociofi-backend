import * as XLSX from "xlsx";
import PdfPrinter from "pdfmake";
import { TDocumentDefinitions } from "pdfmake/interfaces";

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
   * Extract all unique column keys from data including nested fields from 'full' object
   */
  private extractColumns(data: ExportData[]): string[] {
    if (!data || data.length === 0) return [];

    const columnSet = new Set<string>();
    
    const addNestedKeys = (obj: any, prefix: string = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        // Handle arrays of objects specially (like custom_properties)
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          // For arrays of objects, create columns for each field
          Object.keys(value[0]).forEach(arrayKey => {
            if (arrayKey !== 'id' && arrayKey !== 'ref') { // Skip technical fields
              columnSet.add(`${fullKey}.${arrayKey}`);
            }
          });
        }
        // Handle nested objects
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
          addNestedKeys(value, fullKey);
        }
        // Add the key itself for primitive values
        else if (!prefix.includes('meta_data')) { // Skip meta_data details
          columnSet.add(fullKey);
        }
      });
    };

    // First add top-level keys
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'full') {
          columnSet.add(key);
        }
      });
      
      // Then process the full object if present
      if (item.full) {
        // Add important nested paths explicitly
        const nestedPaths = ['user.custom_properties', 'prize.prize_type', 'requirement'];
        nestedPaths.forEach(path => {
          let obj = item.full;
          const parts = path.split('.');
          for (const part of parts) {
            obj = obj?.[part];
            if (!obj) break;
          }
          if (obj) {
            addNestedKeys(obj, path);
          }
        });

        // Add other important fields from full
        addNestedKeys(item.full);
      }
    });

    // Sort columns logically
    const sortedColumns = Array.from(columnSet).sort((a, b) => {
      // Keep primary fields first
      const primaryFields = ['id', 'name', 'email', 'phone_no', 'status'];
      const aPrimary = primaryFields.indexOf(a);
      const bPrimary = primaryFields.indexOf(b);
      
      if (aPrimary !== -1 || bPrimary !== -1) {
        return (aPrimary === -1 ? 999 : aPrimary) - (bPrimary === -1 ? 999 : bPrimary);
      }
      
      // Then sort alphabetically
      return a.localeCompare(b);
    });

    return sortedColumns;
  }

  /**
   * Flatten nested objects and format values with improved nested object handling
   */
  private flattenData(data: ExportData[]): ExportData[] {
    return data.map((item) => {
      const flattened: ExportData = {};
      
      const flattenObject = (obj: any, prefix: string = '') => {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          const fullKey = prefix ? `${prefix}.${key}` : key;
          
          // Handle null/undefined
          if (value === null || value === undefined) {
            if (!prefix.includes('meta_data')) { // Skip meta_data details
              flattened[fullKey] = '-';
            }
          }
          // Handle arrays
          else if (Array.isArray(value)) {
            if (value.length > 0 && typeof value[0] === 'object') {
              // For arrays of objects (like custom_properties)
              value.forEach(item => {
                if (item.title && item.value) {
                  flattened[`${fullKey}.${item.title}`] = item.value;
                }
              });
            } else {
              flattened[fullKey] = value.join(', ');
            }
          }
          // Handle nested objects
          else if (typeof value === 'object') {
            flattenObject(value, fullKey);
          }
          // Handle primitive values
          else if (!prefix.includes('meta_data')) { // Skip meta_data details
            flattened[fullKey] = value;
          }
        });
      };

      // First flatten top-level keys
      Object.keys(item).forEach(key => {
        if (key !== 'full') {
          flattened[key] = item[key];
        }
      });

      // Then process the full object if present
      if (item.full) {
        flattenObject(item.full);
      }

      return flattened;
    });
  }

  /**
   * Format column name for display (handle nested paths and convert to Title Case)
   */
  private formatColumnName(columnName: string): string {
    // Special cases for specific columns
    const specialCases: Record<string, string> = {
      'prize.prize_type.name': 'Prize Name',
      'prize.code': 'Prize Code',
      'user.custom_properties.Status': 'Participant Status',
      'requirement.code': 'Access Code',
      'ip': 'IP Address',
      'user_agent': 'Device Details',
    };

    if (specialCases[columnName]) {
      return specialCases[columnName];
    }

    // Handle nested paths
    const parts = columnName.split('.');
    const lastPart = parts[parts.length - 1];
    
    // Convert snake_case to Title Case
    return lastPart
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate Excel file from user data
   */
  async generateExcelExport(data: ExportData[]): Promise<ExcelExportResult> {
    if (!data || data.length === 0) {
      throw new Error("No data provided for export");
    }

    // Flatten the data
    const flattenedData = this.flattenData(data);

    // Extract columns
    const columns = this.extractColumns(flattenedData);

    // Create worksheet with formatted headers
    const formattedHeaders = columns.map(col => this.formatColumnName(col));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      formattedHeaders,
      ...flattenedData.map(row => 
        columns.map(col => row[col] ?? '-')
      )
    ]);

    // Set dynamic column widths based on content and headers
    worksheet["!cols"] = columns.map((col) => {
      const headerLength = this.formatColumnName(col).length;
      let maxContentLength = 20; // default minimum
      
      // Check content length in this column
      flattenedData.forEach(row => {
        const content = String(row[col] ?? '');
        if (content.length > maxContentLength) {
          maxContentLength = Math.min(content.length, 50); // cap at 50 chars
        }
      });

      return { wch: Math.max(headerLength, maxContentLength, 15) };
    });

    // Add styling to headers
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
      };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Export Data");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return {
      buffer,
      filename: `data-export-${new Date().toISOString().split("T")[0]}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  /**
   * Generate PDF file from user data using pdfmake
   */
  async generatePDFExport(data: ExportData[]): Promise<PDFExportResult> {
    if (!data || data.length === 0) {
      throw new Error("No data provided for export");
    }

    // Flatten the data
    const flattenedData = this.flattenData(data);

    // Extract columns
    const columns = this.extractColumns(flattenedData);

    // Define fonts for pdfmake
    const fonts = {
      Roboto: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
      Courier: {
        normal: "Courier",
        bold: "Courier-Bold",
        italics: "Courier-Oblique",
        bolditalics: "Courier-BoldOblique",
      },
    };

    const printer = new PdfPrinter(fonts);

    // Create table header with formatted column names
    const tableHeader = columns.map((col) => ({
      text: this.formatColumnName(col),
      style: "tableHeader",
      bold: true,
    }));

    // Create table body with improved formatting
    const tableBody: any[][] = [tableHeader];

    flattenedData.forEach((row) => {
      const rowData = columns.map((col) => {
        const value = row[col];
        const displayValue = value !== null && value !== undefined ? String(value) : "-";

        // Special styling cases
        const styleConfig: any = {
          fontSize: 8,
          lineHeight: 1.2,
        };

        // Cell alignment based on content type
        styleConfig.alignment = 'left';
        if (typeof value === 'number' || col.includes('points') || col.includes('qty')) {
          styleConfig.alignment = 'right';
        }

        // Word wrapping for all cells
        styleConfig.noWrap = false;
        
        // Special styling for status columns
        if (col.toLowerCase().includes("status")) {
          const isActive = displayValue.toLowerCase() === "active";
          styleConfig.fillColor = isActive ? "#dcfce7" : "#fef3c7";
          styleConfig.color = isActive ? "#15803d" : "#d97706";
          styleConfig.alignment = 'center';
        }

        // Prize styling
        if (col === "prize.prize_type.name") {
          styleConfig.bold = true;
          styleConfig.color = "#4338ca";
        }

        // Access code styling
        if (col === "requirement.code" || col === "prize.code") {
          styleConfig.font = "Courier";
          styleConfig.color = "#1e40af";
          styleConfig.alignment = 'center';
        }

        // Date formatting and alignment
        if (col.includes("created") || col.includes("date")) {
          styleConfig.alignment = 'center';
        }

        // Date formatting
        if (col.includes("created")) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              styleConfig.text = date.toLocaleString();
              return styleConfig;
            }
          } catch (e) {
            // Use original value if date parsing fails
          }
        }

        styleConfig.text = displayValue;
        return styleConfig;
      });

      tableBody.push(rowData);
    });

    // Group columns by importance/category for better layout
    const columnGroups = {
      primary: ['id', 'name', 'email', 'phone_no', 'status'],
      prize: columns.filter(col => col.includes('prize')),
      user: columns.filter(col => col.includes('user') || col.includes('custom_properties')),
      other: columns.filter(col => {
        const isOther = !['id', 'name', 'email', 'phone_no', 'status'].includes(col) &&
          !col.includes('prize') && !col.includes('user') && !col.includes('custom_properties');
        return isOther;
      })
    };

    // Reorder columns to ensure most important data is visible first
    const orderedColumns = [
      ...columnGroups.primary,
      ...columnGroups.prize,
      ...columnGroups.user,
      ...columnGroups.other
    ];

    // Calculate optimal widths based on content and importance
    const columnWidths = orderedColumns.map((col) => {
      const headerLength = this.formatColumnName(col).length;
      let maxContentLength = 8; // minimum width
      
      // Check content length
      flattenedData.forEach(row => {
        const content = String(row[col] ?? '');
        if (content.length > maxContentLength) {
          maxContentLength = Math.min(content.length, 30); // cap at 30 chars
        }
      });

      // Assign widths based on column type and content
      if (columnGroups.primary.includes(col)) {
        // Primary columns get more space
        return Math.min(Math.max(headerLength, maxContentLength) * 4, 80);
      } else if (col.includes('prize') || col === 'status') {
        // Prize info and status get medium space
        return Math.min(Math.max(headerLength, maxContentLength) * 3, 60);
      } else {
        // Other columns get compressed
        return Math.min(Math.max(headerLength, maxContentLength) * 2.5, 50);
      }
    });

    // Calculate some statistics
    const stats = {
      totalRecords: data.length,
      totalColumns: columns.length,
      uniquePrizes: new Set(flattenedData.map(row => row['prize.prize_type.name'])).size,
      activeParticipants: flattenedData.filter(row => String(row['status']).toLowerCase() === 'active').length,
      dateRange: {
        start: new Date(Math.min(...flattenedData.map(row => new Date(row['created']).getTime()))).toLocaleDateString(),
        end: new Date(Math.max(...flattenedData.map(row => new Date(row['created']).getTime()))).toLocaleDateString(),
      }
    };

    // Document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: "A3", // Larger page size
      pageOrientation: "landscape",
      pageMargins: [10, 60, 10, 20], // Reduced margins
      header: {
        columns: [
          {
            text: "Participation Export Report",
            style: "header",
            alignment: "center",
            margin: [0, 20, 0, 0],
          },
        ],
      },
      content: [
        {
          columns: [
            {
              width: 'auto',
              stack: [
                { text: 'Report Summary', style: 'subheader', margin: [0, 0, 0, 5] },
                { text: `Generated: ${new Date().toLocaleString()}`, style: 'meta' },
                { text: `Date Range: ${stats.dateRange.start} to ${stats.dateRange.end}`, style: 'meta' },
              ]
            },
            {
              width: 'auto',
              stack: [
                { text: 'Statistics', style: 'subheader', margin: [0, 0, 0, 5] },
                { text: `Total Records: ${stats.totalRecords}`, style: 'meta' },
                { text: `Active Participants: ${stats.activeParticipants}`, style: 'meta' },
                { text: `Unique Prizes: ${stats.uniquePrizes}`, style: 'meta' },
              ]
            }
          ],
          columnGap: 40,
          margin: [0, 0, 0, 20]
        },
        {
          table: {
            headerRows: 1,
            widths: columnWidths,
            body: tableBody,
            // Enable table splitting across pages
            dontBreakRows: false,
            keepWithHeaderRows: 1,
          },
          layout: {
            fillColor: (rowIndex: number) => {
              return rowIndex === 0
                ? "#4f46e5"
                : rowIndex % 2 === 0
                ? "#f8fafc"
                : null;
            },
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#e2e8f0",
            vLineColor: () => "#e2e8f0",
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 3,
            paddingBottom: () => 3,
            // Enable word wrapping for all cells
            defaultBorder: true,
          },
        },
      ],
      footer: (currentPage: number, pageCount: number) => {
        return {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: "center",
          fontSize: 8,
          margin: [0, 10, 0, 0],
        };
      },
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          color: "#4f46e5",
          marginBottom: 10,
          alignment: 'center',
        },
        subheader: {
          fontSize: 12,
          bold: true,
          color: "#1f2937",
          marginTop: 5,
        },
        meta: {
          fontSize: 9,
          color: "#4b5563",
          lineHeight: 1.4,
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          color: "white",
          fillColor: "#4f46e5",
          margin: [3, 7, 3, 7],
          alignment: 'center',
        },
        link: {
          color: "#2563eb",
          decoration: "underline",
        },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 8,
        lineHeight: 1.3,
        alignment: 'left',
      },
    };

    // Generate PDF
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        pdfDoc.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            filename: `data-export-${
              new Date().toISOString().split("T")[0]
            }.pdf`,
            contentType: "application/pdf",
          });
        });

        pdfDoc.on("error", (error: Error) => {
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
