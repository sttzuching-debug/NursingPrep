import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType,
  BorderStyle,
  AlignmentType
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Basic Markdown to DOCX converter
 * Handles Headings (# ## ###), Bold (**), Paragraphs, and Markdown Tables.
 */
export async function exportToDocx(markdown: string, filename: string = 'NursingPrep_Export.docx') {
  const lines = markdown.split('\n');
  const children: any[] = [];
  
  let currentTableRows: string[][] = [];
  let isInsideTable = false;

  const processText = (text: string) => {
    // Basic bold support
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({ text: part.slice(2, -2), bold: true });
      }
      return new TextRun(part);
    });
  };

  const flushTable = () => {
    if (currentTableRows.length > 0) {
      // Remove the separator row (|---|---|)
      const dataRows = currentTableRows.filter((_, idx) => idx !== 1);
      
      const docxTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: dataRows.map((row, rowIdx) => new TableRow({
          children: row.map(cell => new TableCell({
            children: [new Paragraph({ children: processText(cell.trim()), spacing: { before: 80, after: 80 } })],
            borders: {
              top: rowIdx === 0 ? { style: BorderStyle.SINGLE, size: 12, color: "000000" } : { style: BorderStyle.NIL },
              bottom: rowIdx === 0 || rowIdx === dataRows.length - 1 ? { style: BorderStyle.SINGLE, size: 12, color: "000000" } : { style: BorderStyle.NIL },
              left: { style: BorderStyle.NIL },
              right: { style: BorderStyle.NIL },
            },
          })),
        })),
      });
      children.push(docxTable);
      children.push(new Paragraph({ text: '' })); // Spacer
      currentTableRows = [];
      isInsideTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Table detection
    if (line.startsWith('|')) {
      isInsideTable = true;
      const cells = line.split('|').filter(c => c.length > 0 || line.indexOf('|' + c + '|') !== -1).map(c => c.trim());
      // Handle empty edges if necessary, but split already handles most basic markdown tables
      const actualCells = line.split('|').slice(1, -1).map(c => c.trim());
      currentTableRows.push(actualCells);
      continue;
    } else if (isInsideTable) {
      flushTable();
    }

    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        text: line.slice(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.slice(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.slice(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }));
    } else if (line.length > 0) {
      children.push(new Paragraph({
        children: processText(line),
        spacing: { after: 120 },
      }));
    } else {
      children.push(new Paragraph({ text: '' }));
    }
  }

  // Final flush if table was at the end
  if (isInsideTable) flushTable();

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
