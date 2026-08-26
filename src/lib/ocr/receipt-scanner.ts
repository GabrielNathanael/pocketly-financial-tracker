import { createWorker } from 'tesseract.js'

export interface ParsedReceiptItem {
  name: string
  price: string
}

export interface ParsedReceipt {
  amount: number
  description: string
  date?: string
  items: ParsedReceiptItem[]
  rawText: string
}

/**
 * Calculates Otsu's optimal threshold for grayscale image
 */
function getOtsuThreshold(grayData: Uint8ClampedArray, width: number, height: number): number {
  const histogram = new Array(256).fill(0)
  const totalPixels = width * height

  for (let i = 0; i < grayData.length; i += 4) {
    histogram[grayData[i]]++
  }

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]

  let sumB = 0
  let wB = 0
  let wF = 0
  let maxVariance = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (wB === 0) continue
    wF = totalPixels - wB
    if (wF === 0) break

    sumB += t * histogram[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const variance = wB * wF * (mB - mF) * (mB - mF)

    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }

  return threshold
}

/**
 * Pre-process image on a Canvas:
 * - Grayscale
 * - Otsu's Adaptive Binarization (Eliminates table/wood background, produces crisp black text on pure white paper)
 */
export async function preprocessImage(imageFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = URL.createObjectURL(imageFile)

    img.onload = () => {
      URL.revokeObjectURL(img.src)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(URL.createObjectURL(imageFile))
        return
      }

      // Keep crisp resolution (1600 - 2400px is sweet spot for OCR)
      const maxDim = 2000
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      const imgData = ctx.getImageData(0, 0, width, height)
      const d = imgData.data

      // 1. Convert to Luminance Grayscale
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
        d[i] = gray
        d[i + 1] = gray
        d[i + 2] = gray
      }

      // 2. Compute Otsu threshold
      const threshold = getOtsuThreshold(d, width, height)
      // Slight bias towards white paper (offset +10 to prevent noise)
      const tunedThreshold = Math.min(240, threshold + 8)

      for (let i = 0; i < d.length; i += 4) {
        const val = d[i] < tunedThreshold ? 0 : 255
        d[i] = val
        d[i + 1] = val
        d[i + 2] = val
      }

      ctx.putImageData(imgData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = () => {
      reject(new Error('Failed to load image file'))
    }
  })
}

/**
 * Parses raw OCR text into structured financial data:
 * - Merchant Name (description)
 * - Date (supports number format & month words e.g. 15 OCT 2023, 15 OKT 2023)
 * - Total Amount (TOTAL, BAYAR, GRAND TOTAL, CASH, etc.)
 * - Item breakdown (Item name + price)
 */
export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && !/^[=\-_*#.~:;]{2,}$/.test(l))

  let description = ''
  let detectedDate = ''
  let totalAmount = 0
  const items: ParsedReceiptItem[] = []

  // Month mapping
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
    jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10',
    oct: '10', nov: '11', des: '12', dec: '12',
  }

  // 1. Detect Boundaries (Header Zone, Body Zone, Summary Zone)
  let headerEndIdx = -1
  let summaryStartIdx = lines.length

  const addressKeywords = ['jl.', 'jl ', 'jalan', 'no.', 'no ', 'rt ', 'rw ', 'kel.', 'kec.', 'kota', 'kab.', 'bandung', 'jakarta', 'surabaya', 'semarang', 'medan', 'bali']
  const headerMetaKeywords = ['tanggal', 'date', 'jam', 'time', 'kasir', 'cashier', 'pos', 'struk:', 'receipt:']
  const totalKeywords = ['total bayar', 'grand total', 'total', 'jumlah', 'tot.', 'tagihan', 'netto', 'subtotal']
  const summaryKeywords = ['cash', 'tunai', 'debit', 'qris', 'bayar', 'kembali', 'change', 'kembalian', 'terima kasih', 'thank you', 'customer care']

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase()

    // Header ends around Date / Kasir / Struk line
    if (headerMetaKeywords.some((k) => lineLower.includes(k))) {
      headerEndIdx = Math.max(headerEndIdx, i)
    }

    // Summary starts at the first TOTAL / SUBTOTAL line
    if (totalKeywords.some((k) => lineLower.includes(k)) && summaryStartIdx === lines.length) {
      summaryStartIdx = i
    }
  }

  // Fallback: If no date/kasir found, header is first 3 lines
  if (headerEndIdx === -1) {
    headerEndIdx = Math.min(2, summaryStartIdx - 1)
  }

  // 2. Detect Merchant Name (First non-address, non-meta line in header)
  for (let i = 0; i <= Math.min(headerEndIdx, lines.length - 1); i++) {
    const lineLower = lines[i].toLowerCase()
    const isAddr = addressKeywords.some((k) => lineLower.includes(k))
    const isMeta = headerMetaKeywords.some((k) => lineLower.includes(k)) || /^[0-9\s.,\-_/:*#]+$/.test(lines[i])

    if (!isAddr && !isMeta && lines[i].length >= 3) {
      let cleanName = lines[i].replace(/[^\w\s&.'-]/gi, '').replace(/\s+/g, ' ').trim()
      // Remove stray 1-2 char edge artifact noise (e.g. "BE NUSANTARA MART" -> "NUSANTARA MART")
      cleanName = cleanName.replace(/^[a-zA-Z0-9]{1,2}\s+/g, '').trim()
      if (cleanName.length >= 3) {
        description = cleanName
        break
      }
    }
  }

  // 3. Detect Date (Look across all lines)
  const wordDateRegex = /\b(\d{1,2})\s+([a-zA-Z]{3,9})\s+(\d{2,4})\b/i
  const numDateRegex = /\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})\b|\b(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})\b/

  for (const line of lines) {
    const wordMatch = line.match(wordDateRegex)
    if (wordMatch) {
      const day = wordMatch[1].padStart(2, '0')
      const monStr = wordMatch[2].substring(0, 3).toLowerCase()
      let year = wordMatch[3]
      if (year.length === 2) year = `20${year}`
      const monthNum = monthMap[monStr]
      if (monthNum) {
        detectedDate = `${year}-${monthNum}-${day}`
        break
      }
    }

    const numMatch = line.match(numDateRegex)
    if (numMatch) {
      if (numMatch[1] && numMatch[2] && numMatch[3]) {
        let year = numMatch[3]
        if (year.length === 2) year = `20${year}`
        const month = numMatch[2].padStart(2, '0')
        const day = numMatch[1].padStart(2, '0')
        if (Number(month) <= 12 && Number(day) <= 31) {
          detectedDate = `${year}-${month}-${day}`
          break
        }
      } else if (numMatch[4] && numMatch[5] && numMatch[6]) {
        const year = numMatch[4]
        const month = numMatch[5].padStart(2, '0')
        const day = numMatch[6].padStart(2, '0')
        if (Number(month) <= 12 && Number(day) <= 31) {
          detectedDate = `${year}-${month}-${day}`
          break
        }
      }
    }
  }

  // Helper to extract clean numeric price
  const extractPrice = (str: string): number => {
    const clean = str.replace(/rp|idr|\$|s\$/gi, '').trim()
    const numbersOnly = clean.replace(/[^0-9.,]/g, '')
    if (!numbersOnly) return 0

    if (/^\d{1,3}(\.\d{3})+$/.test(numbersOnly)) {
      return parseFloat(numbersOnly.replace(/\./g, ''))
    }
    if (/^\d{1,3}(,\d{3})+$/.test(numbersOnly)) {
      return parseFloat(numbersOnly.replace(/,/g, ''))
    }

    const sanitized = numbersOnly.replace(/,/g, '.')
    const num = parseFloat(sanitized)
    return isNaN(num) ? 0 : num
  }

  // 4. Detect Total Amount (Search around summaryStartIdx)
  const candidates: { amount: number; priority: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase()

    for (const kw of totalKeywords) {
      if (lineLower.includes(kw)) {
        const priceMatches = lineLower.match(/(?:rp\.?|idr|\$)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+(?:[.,][0-9]{2})?|[0-9]{4,})/gi)
        if (priceMatches) {
          const amt = extractPrice(priceMatches[priceMatches.length - 1])
          if (amt > 0) {
            const isMainTotal = kw.includes('bayar') || kw.includes('grand') || kw === 'total'
            candidates.push({ amount: amt, priority: isMainTotal ? 3 : 2 })
          }
        }
      }
    }

    // Fallback search
    if (i >= summaryStartIdx) {
      if (lineLower.includes('cash') || lineLower.includes('tunai') || lineLower.includes('bayar')) {
        if (!lineLower.includes('kembali') && !lineLower.includes('change')) {
          const priceMatches = lineLower.match(/(?:rp\.?|idr|\$)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+(?:[.,][0-9]{2})?|[0-9]{4,})/gi)
          if (priceMatches) {
            const amt = extractPrice(priceMatches[priceMatches.length - 1])
            if (amt > 0) candidates.push({ amount: amt, priority: 1 })
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority)
    totalAmount = candidates[0].amount
  }

  // 5. Detect Items (STRICTLY between headerEndIdx and summaryStartIdx)
  const itemCandidateLines = lines.slice(headerEndIdx + 1, summaryStartIdx)

  for (const line of itemCandidateLines) {
    const lineLower = line.toLowerCase()

    // Skip if line contains any meta / address keywords
    if (
      addressKeywords.some((k) => lineLower.includes(k)) ||
      headerMetaKeywords.some((k) => lineLower.includes(k)) ||
      totalKeywords.some((k) => lineLower.includes(k)) ||
      summaryKeywords.some((k) => lineLower.includes(k))
    ) {
      continue
    }

    // Match: [Item Name] [Price]
    const itemMatch = line.match(/^(.+?)\s+((?:rp\.?|idr|\$)?\s*[0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+(?:[.,][0-9]{2})?|[0-9]{3,})$/i)
    if (itemMatch) {
      const itemName = itemMatch[1].replace(/[^\w\s&().'-]/gi, '').replace(/\s+/g, ' ').trim()
      const itemPriceNum = extractPrice(itemMatch[2])

      // Sanity: in IDR item price is at least Rp 100, not street number or single digits
      if (itemName.length >= 2 && itemPriceNum >= 100 && itemPriceNum <= (totalAmount || 100000000)) {
        items.push({
          name: itemName,
          price: String(Math.round(itemPriceNum)),
        })
      }
    }
  }

  // Fallback total from items sum if not detected
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
  }

  return {
    amount: totalAmount,
    description: description || 'Belanja',
    date: detectedDate || new Date().toISOString().split('T')[0],
    items,
    rawText: text,
  }
}

/**
 * Scan receipt from image File using Tesseract.js with optimized Otsu thresholding & PSM 6
 */
export async function scanReceipt(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<ParsedReceipt> {
  onProgress?.(10, 'Mengoptimalkan kontras & filter binarization...')
  const preprocessedDataUrl = await preprocessImage(file)

  onProgress?.(25, 'Memulai OCR WebAssembly Engine...')
  const worker = await createWorker('ind+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(30 + m.progress * 60)
        onProgress?.(pct, `Membaca karakter struk... ${Math.round(m.progress * 100)}%`)
      }
    },
  })

  // Set PSM to 6 (Assume a single uniform block of text - optimal for receipts & tabular data)
  await worker.setParameters({
    tessedit_pageseg_mode: '6' as any,
    preserve_interword_spaces: '1',
  })

  onProgress?.(40, 'Memindai teks struk...')
  const ret = await worker.recognize(preprocessedDataUrl)
  await worker.terminate()

  onProgress?.(95, 'Menganalisis nama toko, tanggal & rincian barang...')
  const parsed = parseReceiptText(ret.data.text)
  onProgress?.(100, 'Selesai!')

  return parsed
}

