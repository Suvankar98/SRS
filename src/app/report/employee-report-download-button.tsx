"use client";

type ReportPdfRow = {
  companyDocket: string;
  date: string;
  workSubmission: string;
  attendance: string;
  review: string;
  documentSubmission: string;
  materialHandover: string;
  dayTotal: string;
};

type EmployeeReportDownloadButtonProps = {
  employeeName: string;
  totalPoints: number;
  rows: ReportPdfRow[];
};

export function EmployeeReportDownloadButton({
  employeeName,
  totalPoints,
  rows,
}: EmployeeReportDownloadButtonProps) {
  async function downloadPdf() {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([842, 595]);
    const margin = 28;
    const rowHeight = 24;
    const columnWidths = [150, 72, 82, 82, 58, 108, 108, 64];
    const headers = ["Company / Docket", "Date", "Work", "Attendance", "Review", "Documents", "Material", "Day Total"];
    let y = 552;
    const drawPdfRow = (
      values: string[],
      rowY: number,
      font: typeof regularFont,
      isHeader: boolean,
    ) => {
      let currentX = margin;

      page.drawRectangle({
        x: margin,
        y: rowY - 7,
        width: columnWidths.reduce((total, width) => total + width, 0),
        height: rowHeight,
        color: isHeader ? rgb(0.91, 0.95, 1) : rgb(1, 1, 1),
        borderColor: rgb(0.75, 0.84, 0.98),
        borderWidth: 0.5,
      });

      for (let index = 0; index < values.length; index += 1) {
        const text = truncatePdfText(values[index] || "-", columnWidths[index]);
        page.drawText(text, {
          x: currentX + 4,
          y: rowY,
          size: isHeader ? 7.5 : 7,
          font,
          color: rgb(0.02, 0.16, 0.38),
        });
        currentX += columnWidths[index];
      }
    };

    const drawPageHeader = () => {
      page.drawText(`${employeeName} Report`, {
        x: margin,
        y,
        size: 16,
        font: boldFont,
        color: rgb(0.02, 0.16, 0.38),
      });
      page.drawText(`Total Points: ${totalPoints}`, {
        x: 690,
        y,
        size: 11,
        font: boldFont,
        color: rgb(0.02, 0.16, 0.38),
      });

      y -= 28;
      drawPdfRow(headers, y, boldFont, true);
      y -= rowHeight;
    };

    const addNextPage = () => {
      page = pdf.addPage([842, 595]);
      y = 552;
      drawPageHeader();
    };

    drawPageHeader();

    for (const row of rows) {
      if (y < 48) {
        addNextPage();
      }

      drawPdfRow(
        [
          row.companyDocket,
          row.date,
          row.workSubmission,
          row.attendance,
          row.review,
          row.documentSubmission,
          row.materialHandover,
          row.dayTotal,
        ],
        y,
        regularFont,
        false,
      );
      y -= rowHeight;
    }

    if (rows.length === 0) {
      page.drawText("No report entries available yet.", {
        x: margin,
        y,
        size: 10,
        font: regularFont,
        color: rgb(0.02, 0.16, 0.38),
      });
    }

    const bytes = await pdf.save();
    const pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${employeeName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "employee"}-report.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={downloadPdf}
      className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
    >
      Download PDF
    </button>
  );
}

function truncatePdfText(value: string, width: number) {
  const maxChars = Math.max(5, Math.floor(width / 4.2));
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}...` : value;
}
