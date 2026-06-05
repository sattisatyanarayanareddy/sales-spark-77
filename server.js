import http from "http";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";

dotenv.config();

const PORT = Number(process.env.EMAIL_API_PORT || 3000);

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function buildQuotationPdfBuffer(quotation) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const createdAtValue = quotation.createdAt?.seconds
      ? new Date(quotation.createdAt.seconds * 1000)
      : new Date(quotation.createdAt || Date.now());

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

    doc.fontSize(10).text("Product", 40, doc.y);
    doc.text("Model", 220, doc.y);
    doc.text("Part No", 330, doc.y);
    doc.text("Value", 460, doc.y, { width: 90, align: "right" });
    doc.moveDown(0.5);

    (quotation.products || []).forEach((product) => {
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

function parseJsonRequest(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function sendEmail(payload) {
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

  const pdfBuffer = await buildQuotationPdfBuffer(payload.quotation);

  return transporter.sendMail({
    from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
    to: payload.to,
    cc: payload.cc || undefined,
    subject: payload.subject,
    text: payload.body,
    attachments: [
      {
        filename: `${payload.quotation.quotationNumber || "quotation"}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/send-quotation-email") {
    try {
      const payload = await parseJsonRequest(req);
      if (!payload.quotation || !payload.to || !payload.subject || !payload.body) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Missing required email payload" }));
        return;
      }

      await sendEmail(payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Email sent successfully" }));
    } catch (error) {
      console.error("Email API error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: error?.message || "Failed to send email" }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Email API server listening on http://localhost:${PORT}`);
});
