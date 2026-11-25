import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseCartFromPdfItems } from './pdfTableParser.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export async function parseCartPDF(file) {
  try {
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const items = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0,
          page: pageNum,
        })
      }
    }

    return parseCartFromPdfItems(items)
  } catch (err) {
    return {
      data: [],
      errors: [`Could not read PDF: ${err.message || 'invalid or corrupted file'}`],
    }
  }
}

