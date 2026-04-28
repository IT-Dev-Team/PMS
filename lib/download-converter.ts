/**
 * lib/download-converter.ts
 *
 * Fetches a Manus CDN attachment and converts client-side to PDF / DOCX / PPTX.
 */
import pptxgen from 'pptxgenjs';

export interface SlideFile {
  id: string;
  path: string;
  changed: boolean;
  content: string;
  note: string;
  width: number;
  height: number;
}

export interface SlideOutlineItem {
  id: string;
  title: string;
  summary: string;
}

export interface ManusApiResponse {
  directory: string;
  slide_ids: string[];
  files: SlideFile[];
  outline: SlideOutlineItem[];
  isImageSlides: boolean;
  title: string;
  images: {
    quote_slide?: string;
    [key: string]: string | undefined;
  };
}

interface Attachment { 
  filename: string; 
  url: string; 
  content_type: string; 
  type: string;
  apiResponse?: ManusApiResponse;
}

export type ExportFormat = 'pdf' | 'docx' | 'pptx'

// ── CDN loader with fallbacks ─────────────────────────────────────────────────────────────────
function loadScript(src: string, globalKey?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing && globalKey && (window as any)[globalKey]) { 
      resolve((window as any)[globalKey]); 
      return 
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve(globalKey ? (window as any)[globalKey] : true)
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function getJsPDF() { 
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); 
  return (window as any).jspdf.jsPDF 
}

async function getDocx() { 
  const cdnUrls = [
    'https://cdn.skypack.dev/docx@8.5.0',
    'https://unpkg.com/docx@8.5.0/build/index.js',
    'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js'
  ]
  
  for (const url of cdnUrls) {
    try {
      await loadScript(url, 'docx')
      if ((window as any).docx) return (window as any).docx
    } catch (e) {
      console.warn(`Failed to load docx from ${url}`, e)
      continue
    }
  }
  throw new Error('Failed to load docx library from all CDNs')
}

async function getPptxgen() { 
  await loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', 'PptxGenJS')
  return (window as any).PptxGenJS 
}

async function getPdfJs() {
  if (!(window as any).pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
    ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
  return (window as any).pdfjsLib
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url); 
  if (!res.ok) throw new Error(`HTTP ${res.status}`); 
  return res.text()
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url); 
  if (!res.ok) throw new Error(`HTTP ${res.status}`); 
  return res.arrayBuffer()
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url); 
  if (!res.ok) throw new Error(`HTTP ${res.status}`); 
  return res.json()
}

function urlExt(url: string) { 
  return url.split('?')[0].split('.').pop()?.toLowerCase() ?? '' 
}

function baseName(fn: string) { 
  return fn.replace(/\.[^.]+$/, '') 
}

function triggerBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ── PDF text extraction ────────────────────────────────────────────────────────
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const lib = await getPdfJs()
  const pdf = await lib.getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it: any) => it.str).join(' ') + '\n\n'
  }
  return text.trim()
}

// ── Markdown section parser ────────────────────────────────────────────────────
interface Section { heading: string | null; level: number; lines: string[] }

function parseSections(md: string): Section[] {
  const result: Section[] = []
  let cur: Section = { heading: null, level: 0, lines: [] }
  for (const raw of md.split('\n')) {
    const hm = raw.match(/^(#{1,6})\s+(.+)/)
    if (hm) { 
      if (cur.lines.length || cur.heading) result.push(cur); 
      cur = { heading: hm[2].trim(), level: hm[1].length, lines: [] } 
    }
    else cur.lines.push(raw)
  }
  if (cur.lines.length || cur.heading) result.push(cur)
  return result
}

function stripMd(t: string) {
  return t.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1')
    .replace(/__(.+?)__/g,'$1').replace(/_(.+?)_/g,'$1')
    .replace(/`(.+?)`/g,'$1').replace(/\[(.+?)\]\(.+?\)/g,'$1')
    .replace(/^[-*+]\s+/gm,'• ').replace(/^\d+\.\s+/gm,'').trim()
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
async function exportPdf(text: string, filename: string) {
  const jsPDF = await getJsPDF()
  const sections = parseSections(text)

  const W = 210, H = 297, M = 18, TW = W - M * 2
  const VIOLET: [number, number, number] = [108, 58, 226]
  const INK: [number, number, number] = [22, 22, 30]
  const LIGHT: [number, number, number] = [243, 240, 255]

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = M

  const newPage = () => { doc.addPage(); y = M }
  const guard = (n: number) => { if (y + n > H - M) newPage() }

  doc.setFillColor(...VIOLET); doc.rect(0, 0, W, 12, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
  doc.text('MANUS', M, 8)
  doc.setFont('helvetica', 'normal')
  doc.text(baseName(filename), W - M, 8, { align: 'right' })
  y = 22

  for (const sec of sections) {
    if (sec.heading) {
      const fs = sec.level <= 1 ? 17 : sec.level <= 2 ? 13 : 11
      guard(fs * 0.6 + 8)
      if (sec.level === 1) { 
        doc.setFillColor(...LIGHT); doc.rect(M - 3, y - 5, TW + 6, fs * 0.6 + 8, 'F'); 
        doc.setFillColor(...VIOLET); doc.rect(M - 3, y - 5, 2.5, fs * 0.6 + 8, 'F') 
      }
      doc.setFontSize(fs); doc.setFont('helvetica', 'bold'); doc.setTextColor(...(sec.level <= 1 ? VIOLET : INK))
      doc.text(sec.heading, M + (sec.level === 1 ? 3 : 0), y)
      y += fs * 0.6 + (sec.level === 1 ? 7 : 5)
    }
    const body = sec.lines.join('\n').trim()
    if (body) {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK)
      const lines = doc.splitTextToSize(stripMd(body), TW) as string[]
      for (const ln of lines) {
        guard(6)
        if (ln.startsWith('• ')) { 
          doc.setFillColor(...VIOLET); doc.circle(M + 1.2, y - 1.2, 0.8, 'F'); 
          doc.text(ln.slice(2), M + 4, y) 
        } else {
          doc.text(ln, M, y)
        }
        y += 5.5
      }
      y += 3
    }
  }

  const total = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setFillColor(...VIOLET); doc.rect(0, H - 9, W, 9, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255)
    doc.text(`Page ${p} / ${total}`, W - M, H - 3.5, { align: 'right' })
  }

  doc.save(baseName(filename) + '.pdf')
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCX EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
async function exportDocx(text: string, filename: string) {
  const docx = await getDocx()
  const sections = parseSections(text)
  const V = '6C3AE2'
  const children: any[] = []

  const hl = (n: number) => {
    const levels = [docx.HeadingLevel.HEADING_1, docx.HeadingLevel.HEADING_2, docx.HeadingLevel.HEADING_3]
    return levels[Math.min(n - 1, 2)]
  }

  for (const sec of sections) {
    if (sec.heading) {
      children.push(new docx.Paragraph({
        text: sec.heading, heading: hl(sec.level), spacing: { before: 280, after: 120 },
        ...(sec.level === 1 ? { border: { bottom: { color: V, size: 8, style: docx.BorderStyle.SINGLE } } } : {})
      }))
    }
    for (const raw of sec.lines) {
      const t = stripMd(raw)
      if (!t) { 
        children.push(new docx.Paragraph({ text: '', spacing: { before: 40 } })); 
        continue 
      }
      children.push(new docx.Paragraph({
        ...(/^[-*+•]\s/.test(raw) ? { bullet: { level: 0 } } : {}),
        children: [new docx.TextRun({ text: t, size: 22, font: 'Calibri' })],
        spacing: { before: 40, after: 40 },
      }))
    }
  }

  const doc = new docx.Document({
    styles: { paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { color: V, bold: true, size: 32, font: 'Calibri' } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { color: '2D2D3A', bold: true, size: 26, font: 'Calibri' } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { color: '4C1D95', bold: true, size: 22, font: 'Calibri' } },
    ] },
    sections: [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  })

  const blob = await docx.Packer.toBlob(doc)
  triggerBlob(blob, baseName(filename) + '.docx')
}

// ═══════════════════════════════════════════════════════════════════════════════
// PPTX EXPORT (from markdown text)
// ═══════════════════════════════════════════════════════════════════════════════
async function exportPptxFromText(text: string, filename: string) {
  const PptxGenJS = await getPptxgen()
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const sections = parseSections(text)

  const VIOLET = '6C3AE2', LAVENDER = 'A78BFA', WHITE = 'FFFFFF', DARK = '1E1E2A', PURPLE3 = '4C1D95'

  const cover = pptx.addSlide()
  cover.background = { fill: VIOLET }
  cover.addText(baseName(filename), { x: 0.5, y: 2.2, w: 12, h: 1.6, fontSize: 38, bold: true, color: WHITE, fontFace: 'Calibri', align: 'center' })
  cover.addText('Generated by Manus', { x: 0.5, y: 4.0, w: 12, h: 0.5, fontSize: 13, color: LAVENDER, fontFace: 'Calibri', align: 'center' })

  let slide: any = null, bulletY = 1.5

  const newSlide = (title: string) => {
    slide = pptx.addSlide(); slide.background = { fill: 'FAFAFA' }
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.25, fill: { color: VIOLET }, line: { type: 'none' } })
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: '100%', h: 0.05, fill: { color: LAVENDER }, line: { type: 'none' } })
    slide.addText(title, { x: 0.4, y: 0.1, w: 12, h: 1.1, fontSize: 26, bold: true, color: WHITE, fontFace: 'Calibri', valign: 'middle' })
    bulletY = 1.55
  }

  for (const sec of sections) {
    if (sec.level <= 2 && sec.heading) { 
      newSlide(sec.heading); 
      continue 
    }
    if (sec.level >= 3 && sec.heading && slide) {
      slide.addText(sec.heading, { x: 0.4, y: bulletY, w: 12.5, h: 0.4, fontSize: 14, bold: true, color: PURPLE3, fontFace: 'Calibri' })
      bulletY += 0.45
    }
    if (!slide) newSlide(baseName(filename))
    const bullets: any[] = []
    for (const raw of sec.lines) { 
      const t = stripMd(raw); 
      if (!t) continue; 
      bullets.push({ text: t, options: { bullet: /^[-*+•]/.test(raw) ? { type: 'bullet' } : false } }) 
    }
    if (bullets.length) { 
      const h = Math.min(bullets.length * 0.38 + 0.1, 7.0 - bulletY); 
      slide.addText(bullets, { x: 0.5, y: bulletY, w: 12.5, h, fontSize: 13, color: DARK, fontFace: 'Calibri', valign: 'top', wrap: true }); 
      bulletY += h + 0.1 
    }
  }

  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  triggerBlob(blob, baseName(filename) + '.pptx')
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUS SLIDE JSON → PPTX
// ═══════════════════════════════════════════════════════════════════════════════
interface ManusSlide {
  title?: string
  subtitle?: string
  heading?: string
  content?: string | string[]
  body?: string | string[]
  bullets?: string[]
  points?: string[]
  notes?: string
  layout?: string
  background?: string
  image?: string
  sections?: Array<{ heading: string; body: string | string[] }>
}

function normaliseSlides(json: any): { docTitle: string; slides: ManusSlide[] } {
  if (Array.isArray(json)) {
    return { docTitle: 'Presentation', slides: json }
  }
  const docTitle = json.title || json.name || 'Presentation'
  const slides = json.slides || json.sections || json.pages || []
  return { docTitle, slides }
}

async function exportPptxFromJson(json: any, filename: string) {
  const PptxGenJS = await getPptxgen()
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Manus'

  const { docTitle, slides } = normaliseSlides(json)
  pptx.title = docTitle

  const VIOLET = '6C3AE2'
  const LAVENDER = 'A78BFA'
  const WHITE = 'FFFFFF'
  const DARK = '1E1E2A'
  const PURPLE3 = '4C1D95'

  // Title slide
  const cover = pptx.addSlide()
  cover.background = { fill: VIOLET }
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 3.6, w: '100%', h: 0.05, fill: { color: LAVENDER }, line: { type: 'none' } })
  cover.addText(docTitle, {
    x: 0.6, y: 1.8, w: 12, h: 1.5,
    fontSize: 40, bold: true, color: WHITE, fontFace: 'Calibri', align: 'center', valign: 'middle'
  })
  if (json.subtitle) {
    cover.addText(json.subtitle, { x: 0.6, y: 3.5, w: 12, h: 0.6, fontSize: 18, color: 'C4B5FD', fontFace: 'Calibri', align: 'center' })
  }
  cover.addText('Generated by Manus', { x: 0.6, y: 6.8, w: 12, h: 0.4, fontSize: 11, color: LAVENDER, fontFace: 'Calibri', align: 'center' })

  // Content slides
  for (const slide of slides) {
    const s = pptx.addSlide()
    s.background = { fill: 'FAFAFA' }

    // Header bar
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1.2, fill: { color: VIOLET }, line: { type: 'none' } })
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.2, w: '100%', h: 0.04, fill: { color: LAVENDER }, line: { type: 'none' } })

    const title = slide.title || slide.heading || ''
    if (title) {
      s.addText(title, { x: 0.4, y: 0.1, w: 12.5, h: 1.0, fontSize: 26, bold: true, color: WHITE, fontFace: 'Calibri', valign: 'middle' })
    }

    let yPos = 1.45

    // Subtitle
    if (slide.subtitle) {
      s.addText(slide.subtitle, { x: 0.5, y: yPos, w: 12.5, h: 0.45, fontSize: 15, bold: true, color: PURPLE3, fontFace: 'Calibri' })
      yPos += 0.5
    }

    // Collect bullet lines
    const bulletLines: { text: string; isBullet: boolean; bold?: boolean }[] = []

    const rawContent = slide.content || slide.body || ''
    const contentArr: string[] = Array.isArray(rawContent)
      ? rawContent
      : typeof rawContent === 'string' ? rawContent.split('\n') : []

    for (const ln of contentArr) {
      const t = ln.trim(); if (!t) continue
      const isBullet = /^[-*•]/.test(t)
      const isHeading = /^#+\s/.test(t) || (t.length < 60 && t.endsWith(':'))
      bulletLines.push({ text: stripMd(t), isBullet: isBullet && !isHeading, bold: isHeading })
    }

    const extras = slide.bullets || slide.points || []
    for (const b of extras) bulletLines.push({ text: stripMd(b), isBullet: true })

    if (slide.sections) {
      for (const sec of slide.sections) {
        if (sec.heading) bulletLines.push({ text: sec.heading, isBullet: false, bold: true })
        const secBody = Array.isArray(sec.body) ? sec.body : (sec.body || '').split('\n')
        for (const l of secBody) { const t = l.trim(); if (t) bulletLines.push({ text: stripMd(t), isBullet: true }) }
      }
    }

    if (bulletLines.length > 0) {
      const textOpts: any[] = bulletLines.map(bl => ({
        text: bl.text,
        options: {
          bullet: bl.isBullet ? { type: 'bullet', indent: 15 } : false,
          bold: bl.bold || false,
          fontSize: bl.bold ? 14 : 13,
          color: bl.bold ? PURPLE3 : DARK,
          fontFace: 'Calibri',
          breakLine: true,
          paraSpaceAfter: bl.bold ? 4 : 2,
        }
      }))

      const maxH = 7.6 - yPos
      s.addText(textOpts, { x: 0.5, y: yPos, w: 12.5, h: maxH, valign: 'top', wrap: true, fontFace: 'Calibri' })
    }

    if (slide.notes) s.addNotes(slide.notes)
  }

  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  triggerBlob(blob, baseName(filename) + '.pptx')
}
async function convertPdfToWord(pdfFile) {
  // 1. Get access token
  const tokenRes = await fetch('https://api-server.compdf.com/server/v1/oauth/token', {
    method: 'POST',
    body: JSON.stringify({ publicKey: 'YOUR_KEY', secretKey: 'YOUR_SECRET' })
  });
  
  // 2. Create task
  const taskRes = await fetch('https://api-server.compdf.com/server/v1/task/pdf/docx');
  
  // 3. Upload file
  // 4. Execute conversion
  // 5. Download result
}
function slideJsonToMarkdown(json: any): string {
  const { docTitle, slides } = normaliseSlides(json)
  let md = `# ${docTitle}\n\n`
  for (const slide of slides) {
    const title = slide.title || slide.heading || ''
    if (title) md += `## ${title}\n\n`
    if (slide.subtitle) md += `**${slide.subtitle}**\n\n`
    const rawContent = slide.content || slide.body || ''
    const lines = Array.isArray(rawContent) ? rawContent : (rawContent as string).split('\n')
    for (const ln of lines) { if (ln.trim()) md += ln + '\n' }
    const extras = slide.bullets || slide.points || []
    for (const b of extras) md += `- ${b}\n`
    md += '\n'
  }
  return md
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT MANUS TO PPTX (from API response)
// ═══════════════════════════════════════════════════════════════════════════════
export async function convertManusToPptx(apiResponse: ManusApiResponse, filename: string) {
  const PptxGenJS = await getPptxgen()
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Manus AI'
  pptx.title = apiResponse.title || 'Manus Presentation'

  const COLORS = {
    PRIMARY: '2C3E50',
    ACCENT: 'C0A080',
    TEXT: '596E79',
    BG: 'FAFAFA'
  }

  // Create a title slide
  const titleSlide = pptx.addSlide()
  titleSlide.background = { fill: COLORS.PRIMARY }
  titleSlide.addText(apiResponse.title || 'Presentation', {
    x: '10%', y: '40%', w: '80%', h: '20%',
    fontSize: 44,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
    align: 'center',
    valign: 'middle'
  })
  titleSlide.addText(`Generated by Manus • ${new Date().toLocaleDateString()}`, {
    x: '10%', y: '70%', w: '80%', h: '10%',
    fontSize: 14,
    color: 'CCCCCC',
    fontFace: 'Arial',
    align: 'center'
  })

  // Process each slide file
  for (const file of apiResponse.files) {
    const slide = pptx.addSlide()
    slide.background = { fill: COLORS.BG }

    const html = file.content
    
    // Extract title
    let title = ''
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || 
                       html.match(/<title[^>]*>(.*?)<\/title>/i) ||
                       html.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/div>/i)
    if (titleMatch) title = stripHtml(titleMatch[1])
    
    if (title) {
      slide.addText(title, {
        x: '10%', y: '10%', w: '80%', h: '15%',
        fontSize: 28,
        bold: true,
        color: COLORS.PRIMARY,
        fontFace: 'Arial',
        valign: 'middle'
      })
    }

    // Extract content paragraphs
    const paragraphs: string[] = []
    const pMatches = html.matchAll(/<p[^>]*>(.*?)<\/p>/gi)
    for (const match of pMatches) {
      const text = stripHtml(match[1])
      if (text && !text.includes('footer') && text.length > 10) {
        paragraphs.push(text)
      }
    }

    // Extract list items
    const listItems: string[] = []
    const liMatches = html.matchAll(/<li[^>]*>(.*?)<\/li>/gi)
    for (const match of liMatches) {
      const text = stripHtml(match[1])
      if (text) listItems.push(text)
    }

    // Add content to slide
    let yPos = title ? 30 : 15
    const contentItems = [...paragraphs, ...listItems.map(li => `• ${li}`)]
    
    if (contentItems.length > 0) {
      slide.addText(contentItems.join('\n\n'), {
        x: '10%', y: `${yPos}%`, w: '80%', h: '60%',
        fontSize: 16,
        color: COLORS.TEXT,
        fontFace: 'Arial',
        valign: 'top',
        bullet: true
      })
    }

    // Add footer if present
    const footerMatch = html.match(/<div[^>]*class="[^"]*footer[^"]*"[^>]*>(.*?)<\/div>/i)
    if (footerMatch) {
      slide.addText(stripHtml(footerMatch[1]), {
        x: '10%', y: '85%', w: '80%', h: '8%',
        fontSize: 10,
        color: COLORS.ACCENT,
        fontFace: 'Arial',
        align: 'center'
      })
    }

    // Add speaker notes
    if (file.note) {
      slide.addNotes(file.note)
    }
  }

  await pptx.writeFile({ fileName: filename })
  return true
}

function stripHtml(html: string) {
  if (typeof window === 'undefined') return html.replace(/<[^>]*>?/gm, '');
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════
export async function downloadAttachment(
  url: string, filename: string, format: ExportFormat,
  onProgress?: (msg: string) => void
): Promise<void> {
  const ext = urlExt(url)

  // Same format → direct download
  if (
    (format === 'pdf' && ext === 'pdf') ||
    (format === 'docx' && (ext === 'docx' || ext === 'doc')) ||
    (format === 'pptx' && (ext === 'pptx' || filename?.endsWith('.pptx')))
  ) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return
  }

  onProgress?.(`Fetching ${filename}…`)

  // ── JSON (Manus slide format) ──────────────────────────────────────────────
  if (ext === 'json') {
    let json: any
    try { json = await fetchJson(url) }
    catch { json = null }

    if (json) {
      if (format === 'pptx') {
        onProgress?.('Building PowerPoint from slide data…')
        await exportPptxFromJson(json, filename)
        onProgress?.('Done ✓')
        return
      }
      // Convert JSON to markdown then to PDF/DOCX
      const md = slideJsonToMarkdown(json)
      onProgress?.(`Converting to ${format.toUpperCase()}…`)
      if (format === 'pdf') await exportPdf(md, filename)
      if (format === 'docx') await exportDocx(md, filename)
      onProgress?.('Done ✓')
      return
    }
  }

  // ── PDF source ─────────────────────────────────────────────────────────────
  let text: string
  if (ext === 'pdf') {
    onProgress?.('Extracting PDF text…')
    const buf = await fetchBuffer(url)
    text = await extractTextFromPdf(buf)
  } else {
    text = await fetchText(url)
    if (ext === 'html' || ext === 'htm') text = text.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
  }

  onProgress?.(`Converting to ${format.toUpperCase()}…`)
  if (format === 'pdf') await exportPdf(text, filename)
  if (format === 'docx') await exportDocx(text, filename)
  if (format === 'pptx') await exportPptxFromText(text, filename)
  onProgress?.('Done ✓')
}