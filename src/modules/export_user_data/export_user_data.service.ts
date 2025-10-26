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

// Define the exact columns to export with their mappings
interface ColumnMapping {
  displayName: string;
  path: string[];
  customExtractor?: (item: any) => any;
}

const EXPORT_COLUMNS: ColumnMapping[] = [
  { displayName: "Id", path: ["id"] },
  { displayName: "Name", path: ["name"] },
  { displayName: "Email", path: ["email"] },
  { displayName: "Phone No", path: ["phone_no"] },
  { displayName: "Access Code", path: ["access_code"] },
  { displayName: "Country", path: ["country"] },
  { displayName: "Created", path: ["created"] },
  { displayName: "Device", path: ["device"] },
  { displayName: "IP Address", path: ["full", "ip"] },
  { displayName: "Points", path: ["points"] },
  { displayName: "Prize", path: ["prize"] },
  { displayName: "Prize Code", path: ["reward_code"] },
  { displayName: "Promotion Id", path: ["promotion"] },
  { displayName: "Device Details", path: ["full", "user_agent"] },
  {
    displayName: "Participant Status",
    path: ["full", "user", "custom_properties"],
    customExtractor: (item: any) => {
      const customProps = item?.full?.user?.custom_properties;
      if (Array.isArray(customProps)) {
        const statusProp = customProps.find((prop: any) => prop.title === "Status");
        return statusProp?.value || "-";
      }
      return "-";
    },
  },
  { displayName: "First Name", path: ["full", "user", "first_name"] },
  { displayName: "Language", path: ["full", "user", "language"] },
  { displayName: "Last Name", path: ["full", "user", "last_name"] },
  { displayName: "Login Type", path: ["full", "user", "login_type"] },
  { displayName: "Nickname", path: ["full", "user", "nickname"] },
];

export class ExportService {
  /**
   * Extract value from nested path
   */
  private getNestedValue(obj: any, path: string[]): any {
    let value = obj;
    for (const key of path) {
      if (value == null) return "-";
      value = value[key];
    }
    return value != null && value !== "" ? value : "-";
  }

  /**
   * Extract data according to specified columns only
   */
  private extractColumnData(data: ExportData[]): ExportData[] {
    return data.map((item) => {
      const extracted: ExportData = {};

      EXPORT_COLUMNS.forEach((column) => {
        if (column.customExtractor) {
          extracted[column.displayName] = column.customExtractor(item);
        } else {
          extracted[column.displayName] = this.getNestedValue(item, column.path);
        }
      });

      return extracted;
    });
  }

  /**
   * Generate Excel file from user data
   */
  async generateExcelExport(data: ExportData[]): Promise<ExcelExportResult> {
    if (!data || data.length === 0) {
      throw new Error("No data provided for export");
    }

    // Extract only specified columns
    const extractedData = this.extractColumnData(data);

    // Get column headers
    const headers = EXPORT_COLUMNS.map((col) => col.displayName);

    // Create worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      headers,
      ...extractedData.map((row) =>
        headers.map((header) => row[header] ?? "-")
      ),
    ]);

    // Set dynamic column widths
    worksheet["!cols"] = headers.map((header) => {
      const headerLength = header.length;
      let maxContentLength = 15; // default minimum

      // Check content length in this column
      extractedData.forEach((row) => {
        const content = String(row[header] ?? "");
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

    // Extract only specified columns
    const extractedData = this.extractColumnData(data);

    // Get column headers
    const headers = EXPORT_COLUMNS.map((col) => col.displayName);

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

    // Create table header
    const tableHeader = headers.map((header) => ({
      text: header,
      style: "tableHeader",
      bold: true,
    }));

    // Create table body
    const tableBody: any[][] = [tableHeader];

    extractedData.forEach((row) => {
      const rowData = headers.map((header) => {
        const value = row[header];
        const displayValue =
          value !== null && value !== undefined ? String(value) : "-";

        // Cell styling configuration
        const styleConfig: any = {
          fontSize: 7, // Reduced from 8 to 7
          lineHeight: 1.1, // Reduced from 1.2
          alignment: "left",
          noWrap: false,
        };

        // Number alignment
        if (
          typeof value === "number" ||
          header === "Points" ||
          header === "Id"
        ) {
          styleConfig.alignment = "right";
        }

        // Center alignment for specific columns
        if (
          ["Access Code", "Prize Code", "Created", "Device", "Country"].includes(
            header
          )
        ) {
          styleConfig.alignment = "center";
        }

        // Status styling
        if (header === "Participant Status") {
          const isResident = displayValue.toLowerCase() === "resident";
          styleConfig.fillColor = isResident ? "#dcfce7" : "#fef3c7";
          styleConfig.color = isResident ? "#15803d" : "#d97706";
          styleConfig.alignment = "center";
        }

        // Prize styling
        if (header === "Prize") {
          styleConfig.bold = true;
          styleConfig.color = "#4338ca";
        }

        // Code styling
        if (header === "Access Code" || header === "Prize Code") {
          styleConfig.font = "Courier";
          styleConfig.color = "#1e40af";
        }

        // Date formatting
        if (header === "Created") {
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

    // Calculate column widths - optimized for A3 landscape to fit all columns
    const columnWidths = headers.map((header) => {
      // Assign compact widths to fit all columns on A3 landscape
      const widthMap: Record<string, number> = {
        "Id": 35,
        "Name": 55,
        "Email": 70,
        "Phone No": 55,
        "Access Code": 35,
        "Country": 30,
        "Created": 50,
        "Device": 35,
        "IP Address": 50,
        "Points": 25,
        "Prize": 60,
        "Prize Code": 45,
        "Promotion Id": 40,
        "Device Details": 65,
        "Participant Status": 45,
        "First Name": 45,
        "Language": 32,
        "Last Name": 45,
        "Login Type": 35,
        "Nickname": 55,
      };
      
      return widthMap[header] || 40;
    });

    // Calculate statistics
    const stats = {
      totalRecords: data.length,
      activeParticipants: extractedData.filter(
        (row) => String(row["Participant Status"]).toLowerCase() === "resident"
      ).length,
      uniquePrizes: new Set(extractedData.map((row) => row["Prize"])).size,
    };

    // Document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: "A2", // Increased from A3 to A2 for more width
      pageOrientation: "landscape",
      pageMargins: [8, 50, 8, 18], // Reduced margins further
      header: {
        columns: [
          {
            text: "Participation Export Report",
            style: "header",
            alignment: "center",
            margin: [0, 15, 0, 0],
          },
        ],
      },
      content: [
        {
          columns: [
            {
              width: "auto",
              stack: [
                {
                  text: "Report Summary",
                  style: "subheader",
                  margin: [0, 0, 0, 5],
                },
                {
                  text: `Generated: ${new Date().toLocaleString()}`,
                  style: "meta",
                },
              ],
            },
            {
              width: "auto",
              stack: [
                {
                  text: "Statistics",
                  style: "subheader",
                  margin: [0, 0, 0, 5],
                },
                {
                  text: `Total Records: ${stats.totalRecords}`,
                  style: "meta",
                },
                {
                  text: `Residents: ${stats.activeParticipants}`,
                  style: "meta",
                },
                {
                  text: `Unique Prizes: ${stats.uniquePrizes}`,
                  style: "meta",
                },
              ],
            },
          ],
          columnGap: 40,
          margin: [0, 0, 0, 20],
        },
        {
          table: {
            headerRows: 1,
            widths: columnWidths,
            body: tableBody,
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
            hLineWidth: () => 0.3, // Thinner lines
            vLineWidth: () => 0.3,
            hLineColor: () => "#e2e8f0",
            vLineColor: () => "#e2e8f0",
            paddingLeft: () => 2, // Reduced padding
            paddingRight: () => 2,
            paddingTop: () => 2,
            paddingBottom: () => 2,
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
          fontSize: 18, // Reduced from 22
          bold: true,
          color: "#4f46e5",
          marginBottom: 8,
          alignment: "center",
        },
        subheader: {
          fontSize: 10, // Reduced from 12
          bold: true,
          color: "#1f2937",
          marginTop: 3,
        },
        meta: {
          fontSize: 8, // Reduced from 9
          color: "#4b5563",
          lineHeight: 1.3,
        },
        tableHeader: {
          bold: true,
          fontSize: 7, // Reduced from 9
          color: "white",
          fillColor: "#4f46e5",
          margin: [2, 5, 2, 5], // Reduced padding
          alignment: "center",
        },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 7, // Reduced from 8
        lineHeight: 1.2,
        alignment: "left",
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