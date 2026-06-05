// @ts-nocheck
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

function buildQuotationPdfBuffer(quotation: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

    const createdAtValue = quotation.createdAt?.seconds ? new Date(quotation.createdAt.seconds * 1000) : new Date(quotation.createdAt);

    doc.fontSize(22).text("QUOTATION", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Quotation No: ${quotation.quotationNumber}`);
    doc.text(`Date: ${createdAtValue.toLocaleDateString()}`);
    doc.moveDown(1);

    doc.fontSize(14).text("From:", { underline: true });
    doc.fontSize(12).text(quotation.salesPersonCompany || "SalesERP");
    doc.text(`Name: ${quotation.salesPersonName}`);
    if (quotation.salesPersonDesignation) doc.text(`Designation: ${quotation.salesPersonDesignation}`);
    doc.moveDown(0.75);

    doc.fontSize(14).text("Bill To:", { underline: true });
    doc.fontSize(12).text(quotation.customerName);
    doc.text(quotation.companyName);
    if (quotation.customerEmail) doc.text(quotation.customerEmail);
    if (quotation.customerPhone) doc.text(quotation.customerPhone);
    doc.moveDown(1);

    if (quotation.subject) {
      doc.fontSize(14).text("Subject:", { underline: true });
      doc.fontSize(12).text(quotation.subject);
      doc.moveDown(1);
    }

    doc.fontSize(14).text("Products", { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const columnWidths = [180, 110, 110, 110];

    doc.fontSize(10).text("Product", 40, tableTop);
    doc.text("Model", 220, tableTop);
    doc.text("Part No", 330, tableTop);
    doc.text("Value", 460, tableTop, { width: 90, align: "right" });
    doc.moveDown(0.5);

    const startY = doc.y;
    quotation.products?.forEach((product: any) => {
      doc.fontSize(10).text(product.name || "-", 40, doc.y);
      doc.text(product.modelNumber || "-", 220, doc.y);
      doc.text(product.partNumber || "-", 330, doc.y);
      doc.text(formatCurrency(product.value || 0), 460, doc.y, { width: 90, align: "right" });
      doc.moveDown(0.75);
    });

    doc.moveDown(1);
    doc.fontSize(12).text(`Total: ${formatCurrency(quotation.totalValue || 0)}`, { align: "right" });
    doc.moveDown(1);

    if (quotation.followUpNotes) {
      doc.fontSize(12).text("Notes:", { underline: true });
      doc.fontSize(10).text(quotation.followUpNotes);
      doc.moveDown(1);
    }

    doc.end();
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const { quotation, to, cc, subject, body } = req.body;

  if (!quotation || !to || !subject || !body) {
    res.status(400).json({ message: "Missing required email payload" });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    const pdfBuffer = await buildQuotationPdfBuffer(quotation);

    await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      cc: cc || undefined,
      subject,
      text: body,
      attachments: [
        {
          filename: `${quotation.quotationNumber || "quotation"}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Email send failed:", error);
    res.status(500).json({ message: error?.message || "Failed to send email" });
  }
}
