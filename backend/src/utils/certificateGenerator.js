import fs from 'fs';
import path from 'path';
import { certificateStorageDir } from './documentUpload.js';

/**
 * Escapes characters for PDF literal strings
 */
function escapePdfText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates an authentic, standard PDF-1.4 landscape certificate.
 * Zero external dependencies required.
 */
export async function generateCertificatePDF({
  internName,
  certificateNumber,
  verificationCode,
  certificateTitle = 'INTERNSHIP COMPLETION CERTIFICATE',
  trackName = 'Technology Track',
  cohortName = 'Cohort',
  issueDate = new Date().toISOString().split('T')[0],
  completionDate = new Date().toISOString().split('T')[0],
  signatoryName = 'Dr. John O. Williams',
  signatoryTitle = 'Executive Director, Jowis Studio',
  outputPath
}) {
  const safeNum = certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetPath = outputPath || path.join(certificateStorageDir, `cert_${safeNum}.pdf`);

  // Landscape dimensions in points: 792 x 612 (Letter Landscape)
  const width = 792;
  const height = 612;

  // Build PDF content stream
  // Colors: Navy `#0f172a` (0.06, 0.09, 0.16), Gold `#d97706` (0.85, 0.47, 0.02), Indigo `#4f46e5` (0.31, 0.27, 0.90)
  const streamCommands = [
    // Outer border (Dark Slate / Navy)
    `0.06 0.09 0.16 rg`,
    `0 0 ${width} ${height} re f`,

    // Outer frame (Gold / Amber border)
    `0.85 0.55 0.10 RG`,
    `4 w`,
    `24 24 ${width - 48} ${height - 48} re S`,

    // Inner subtle frame (Thin Indigo border)
    `0.35 0.35 0.65 RG`,
    `1 w`,
    `32 32 ${width - 64} ${height - 64} re S`,

    // Background inner fill (Clean Off-White / Cream parchment for certificate body)
    `0.98 0.98 0.99 rg`,
    `34 34 ${width - 68} ${height - 68} re f`,

    // Header Institution Name
    `BT`,
    `/F1 18 Tf`,
    `0.10 0.15 0.28 rg`,
    `1 0 0 1 240 535 Tm`,
    `(JOWIS STUDIO TECHNOLOGY CENTER) Tj`,
    `ET`,

    // Institution Subtitle
    `BT`,
    `/F2 10 Tf`,
    `0.40 0.45 0.55 rg`,
    `1 0 0 1 290 515 Tm`,
    `(ENTERPRISE INTERNSHIP & TRAINING MANAGEMENT) Tj`,
    `ET`,

    // Certificate Title Banner
    `BT`,
    `/F1 22 Tf`,
    `0.75 0.45 0.05 rg`,
    `1 0 0 1 180 465 Tm`,
    `(${escapePdfText(certificateTitle.toUpperCase())}) Tj`,
    `ET`,

    // Decorative Separator Line
    `0.80 0.50 0.10 RG`,
    `2 w`,
    `200 448 m 592 448 l S`,

    // Awarded text
    `BT`,
    `/F2 12 Tf`,
    `0.30 0.35 0.45 rg`,
    `1 0 0 1 310 420 Tm`,
    `(This is to officially certify that) Tj`,
    `ET`,

    // Intern Recipient Name
    `BT`,
    `/F3 26 Tf`,
    `0.08 0.12 0.24 rg`,
    `1 0 0 1 200 370 Tm`,
    `(${escapePdfText(internName.toUpperCase())}) Tj`,
    `ET`,

    // Underline for Intern Name
    `0.60 0.65 0.75 RG`,
    `1 w`,
    `180 358 m 612 358 l S`,

    // Fulfillment statement
    `BT`,
    `/F2 11 Tf`,
    `0.25 0.30 0.40 rg`,
    `1 0 0 1 110 325 Tm`,
    `(has successfully satisfied all rigorous institutional standards, curriculum training milestones,) Tj`,
    `1 0 0 1 125 305 Tm`,
    `(practical project execution requirements, and formal mentor evaluations in the specialization:) Tj`,
    `ET`,

    // Specialization Program Track & Cohort
    `BT`,
    `/F1 16 Tf`,
    `0.25 0.20 0.70 rg`,
    `1 0 0 1 180 265 Tm`,
    `(${escapePdfText(trackName)}  |  ${escapePdfText(cohortName)}) Tj`,
    `ET`,

    // Dates & Completion Record
    `BT`,
    `/F2 10 Tf`,
    `0.35 0.40 0.50 rg`,
    `1 0 0 1 270 230 Tm`,
    `(Program Completed: ${escapePdfText(completionDate)}  |  Issued: ${escapePdfText(issueDate)}) Tj`,
    `ET`,

    // Bottom Signatory Section
    // Signature line left: Verification & Authority
    `0.60 0.65 0.75 RG`,
    `1 w`,
    `80 120 m 280 120 l S`,

    `BT`,
    `/F1 10 Tf`,
    `0.15 0.20 0.30 rg`,
    `1 0 0 1 80 102 Tm`,
    `(CERTIFICATE VERIFICATION) Tj`,
    `/F2 8 Tf`,
    `0.40 0.45 0.55 rg`,
    `1 0 0 1 80 88 Tm`,
    `(Cert No: ${escapePdfText(certificateNumber)}) Tj`,
    `1 0 0 1 80 74 Tm`,
    `(Code: ${escapePdfText(verificationCode.substring(0, 32))}...) Tj`,
    `ET`,

    // Signature line right: Executive Director Signatory
    `0.60 0.65 0.75 RG`,
    `1 w`,
    `512 120 m 712 120 l S`,

    `BT`,
    `/F1 11 Tf`,
    `0.10 0.15 0.25 rg`,
    `1 0 0 1 512 102 Tm`,
    `(${escapePdfText(signatoryName)}) Tj`,
    `/F2 9 Tf`,
    `0.40 0.45 0.55 rg`,
    `1 0 0 1 512 86 Tm`,
    `(${escapePdfText(signatoryTitle)}) Tj`,
    `1 0 0 1 512 72 Tm`,
    `(Authorized Institutional Signature) Tj`,
    `ET`,

    // Official Seal Emblem Center
    `0.85 0.55 0.10 RG`,
    `2 w`,
    `396 110 32 0 360 arc S`,
    `BT`,
    `/F1 8 Tf`,
    `0.75 0.45 0.05 rg`,
    `1 0 0 1 377 114 Tm`,
    `(OFFICIAL) Tj`,
    `1 0 0 1 385 98 Tm`,
    `(SEAL) Tj`,
    `ET`
  ];

  // Helper arc approximation via lines in PDF path
  // Since `arc` is PostScript and some minimal PDF viewers prefer simple lines, replace with elegant seal circle:
  const streamString = streamCommands.join('\n')
    .replace('396 110 32 0 360 arc S', '364 78 64 64 re S');

  const streamLength = Buffer.byteLength(streamString, 'utf-8');

  // Construct PDF Objects
  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>\nendobj`);
  objects.push(`7 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamString}\nendstream\nendobj`);

  // Build XREF table
  let currentOffset = 0;
  const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  currentOffset += Buffer.byteLength(header, 'binary');

  const xrefEntries = [`0000000000 65535 f `];
  let body = '';

  for (let i = 0; i < objects.length; i++) {
    const objStr = objects[i] + '\n';
    const offsetStr = String(currentOffset).padStart(10, '0') + ' 00000 n ';
    xrefEntries.push(offsetStr);
    currentOffset += Buffer.byteLength(objStr, 'binary');
    body += objStr;
  }

  const startxref = currentOffset;
  const xrefTable = `xref\n0 ${objects.length + 1}\n` + xrefEntries.join('\n') + '\n';
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  const fullPdfBuffer = Buffer.from(header + body + xrefTable + trailer, 'binary');

  fs.writeFileSync(targetPath, fullPdfBuffer);
  return targetPath;
}
