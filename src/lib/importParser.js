import { detectReceiptCurrency } from './receiptUtils'
import { normalizeDate, today } from './utils'
import { getPresetOptions } from './transactionOptions'

const RECEIPT_TOTAL_POSITIVE = /\bgrand total\b|\btotal amount\b|\bamount due\b|\btotal due\b|\bbalance due\b|\bnet total\b|\bamount payable\b|合計|總計|总计|總額|合共|お会計|ご請求|請求額|お買上/i
const RECEIPT_TOTAL_NEGATIVE = /\bchange\b|\bcash\b|\btendered\b|\bsubtotal\b|\bsub total\b|\bdiscount\b|\bsavings\b|\bpromo\b|\bvat\b|\btax\b|\bservice charge\b|小計|税|稅|釣錢|找續|おつり|お預り|現金|割引/i
const LINE_ITEM_SKIP = /\bsubtotal\b|\bsub total\b|\bdiscount\b|\bchange\b|\bcash\b|\btendered\b|\bbalance\b|\bamount due\b|\btotal\b|\bvat\b|\btax\b|\bservice charge\b|\bref\b|\breceipt\b|\bthank you\b|合計|總計|总计|總額|合共|小計|税|稅|釣錢|找續|おつり|お預り|現金|割引|預り|領収書/i
const NAME_CHAR_PATTERN = /[A-Za-z\u3040-\u30ff\u3400-\u9fff]/

function parseDateCandidate(raw) {
  if (!raw) return ''
  const cleaned = raw.replace(/\./g, '/').trim()

  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(cleaned)) {
    return normalizeDate(cleaned.replace(/\//g, '-'))
  }

  const japanese = cleaned.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
  if (japanese) {
    const [, year, month, day] = japanese
    return normalizeDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
  }

  const dmy = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (dmy) {
    const [, a, b, c] = dmy
    const year = c.length === 2 ? `20${c}` : c
    return normalizeDate(`${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`)
  }

  const parsed = new Date(cleaned)
  if (!Number.isNaN(parsed.getTime())) return normalizeDate(parsed.toISOString())
  return ''
}

function parseAmountValue(raw) {
  const value = parseFloat(String(raw || '').replace(/[,\s]/g, ''))
  if (Number.isNaN(value) || value <= 0) return null
  return value
}

function extractWalletAmount(lines) {
  const patterns = [
    /(?:amount|total|sent|paid|received|credited|debited)[^\d]{0,16}(?:php|₱|hk\$|hkd|jpy|¥)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:php|₱|hk\$|hkd|jpy|¥)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\b([\d,]+\.\d{2})\b/,
  ]

  let best = null

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern)
      if (!match) continue
      const value = parseAmountValue(match[1])
      if (!value) continue
      if (best === null || value > best) best = value
    }
  }

  return best
}

function extractLineAmounts(line) {
  const candidates = []
  const regex = /(?:HK\$|US\$|S\$|₱|php|hkd|usd|sgd|jpy|¥|￥|€|£)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)/gi

  for (const match of line.matchAll(regex)) {
    const amountText = match[1]
    const value = parseAmountValue(amountText)
    if (!value) continue

    const start = match.index ?? 0
    const full = match[0]
    const end = start + full.length
    const before = line[start - 1] || ''
    const after = line[end] || ''

    if (before === '/' || after === '/' || before === ':' || after === ':' || after === '%') continue

    candidates.push({
      value,
      raw: amountText,
      full,
      hasDecimal: amountText.includes('.'),
      hasCurrency: /HK\$|US\$|S\$|₱|php|hkd|usd|sgd|jpy|¥|￥|€|£/i.test(full),
    })
  }

  return candidates
}

function scoreReceiptAmountCandidate(line, candidate, lineIndex, totalLines, lineAmountCount) {
  const lower = line.toLowerCase()
  let score = 0

  if (RECEIPT_TOTAL_POSITIVE.test(line)) score += 118
  else if (/\btotal\b/.test(lower)) score += 82
  else if (/\bamount\b/.test(lower)) score += 18

  if (candidate.hasCurrency) score += 14
  if (candidate.hasDecimal) score += 12
  score += Math.round((lineIndex / Math.max(totalLines - 1, 1)) * 18)

  if (RECEIPT_TOTAL_NEGATIVE.test(line)) score -= 92
  if (/\bqty\b|\bquantity\b|\bunit price\b|\bprice\b|\bitem\b/.test(lower)) score -= 26
  if (lineAmountCount > 2 && !RECEIPT_TOTAL_POSITIVE.test(line)) score -= 20
  if (!candidate.hasDecimal && !candidate.hasCurrency && candidate.value >= 1900 && candidate.value <= 2100) score -= 80
  if (!candidate.hasDecimal && candidate.value < 20 && !RECEIPT_TOTAL_POSITIVE.test(line)) score -= 12

  return score
}

function extractReceiptAmount(lines) {
  let best = null

  lines.forEach((line, index) => {
    const amounts = extractLineAmounts(line)
    amounts.forEach(candidate => {
      const score = scoreReceiptAmountCandidate(line, candidate, index, lines.length, amounts.length)
      if (
        !best ||
        score > best.score ||
        (score === best.score && index > best.index) ||
        (score === best.score && index === best.index && candidate.value > best.value)
      ) {
        best = { ...candidate, score, index }
      }
    })
  })

  if (!best || best.score < 10) {
    return { value: null, confidence: 'none' }
  }

  return {
    value: best.value,
    confidence: best.score >= 110 ? 'high' : best.score >= 70 ? 'medium' : 'low',
  }
}

function extractReference(lines) {
  for (const line of lines) {
    const match = line.match(/(?:ref(?:erence)?(?: no\.?| #)?|transaction id|trace no\.?|invoice(?: no\.?| #)?|領収書番号|伝票番号)[\s:]*([A-Z0-9-]{4,})/i)
    if (match) return match[1]
  }
  return ''
}

function extractDate(lines) {
  for (const line of lines) {
    const match = line.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|\d{4}年\d{1,2}月\d{1,2}日)/)
    if (match) {
      const parsed = parseDateCandidate(match[1])
      if (parsed) return { value: parsed, confidence: 'high' }
    }
  }
  return { value: '', confidence: 'none' }
}

function guessCategory(text) {
  const lower = text.toLowerCase()
  if (/restaurant|food|meal|dining|coffee|cafe|jollibee|mcdonald|starbucks|milk tea|餐|食|ラーメン|カフェ|レストラン|寿司|弁当/.test(lower)) return 'Food & Dining'
  if (/grab|angkas|joyride|taxi|bus|train|lrt|mrt|transport|fuel|gas|parking|mtr|jr|電車|地下鉄|タクシー|バス/.test(lower)) return 'Transport'
  if (/shop|shopping|lazada|shopee|mall|store|market|supermarket|百貨店|便利店|ドラッグ|薬局|shoping/.test(lower)) return 'Shopping'
  if (/hospital|clinic|pharmacy|drugstore|medicine|health|医院|診療|薬/.test(lower)) return 'Health'
  if (/movie|cinema|netflix|spotify|game|entertainment|映画|ゲーム/.test(lower)) return 'Entertainment'
  if (/meralco|maynilad|water|internet|pldt|globe|smart|telco|bill|電気|ガス|水道|通信/.test(lower)) return 'Bills'
  if (/salon|barber|spa|beauty|personal|美容|サロン/.test(lower)) return 'Personal Care'
  return 'Other'
}

function detectPreset(type, text = '') {
  const lower = String(text || '').toLowerCase()
  if (!lower) return null
  return getPresetOptions(type).find(item => {
    if (!item || item.isCustom) return false
    const labels = [item.label, item.desc].filter(Boolean)
    return labels.some(label => lower.includes(String(label).toLowerCase()))
  }) || null
}

function guessSubcategory(type, cat, text = '') {
  const lower = String(text || '').toLowerCase()

  if (type === 'income') {
    if (cat === 'Salary') {
      if (/overtime|ot/.test(lower)) return 'Overtime'
      if (/commission/.test(lower)) return 'Commission'
      return 'Salary'
    }
    if (cat === 'Freelance') {
      if (/retainer/.test(lower)) return 'Retainer'
      if (/side hustle|sideline|gig/.test(lower)) return 'Side Hustle'
      return 'Client Project'
    }
    if (cat === 'Business') {
      if (/online/.test(lower)) return 'Online Selling'
      if (/service/.test(lower)) return 'Service Income'
      return 'Sales'
    }
    if (cat === 'Investment') {
      if (/dividend/.test(lower)) return 'Dividends'
      if (/gain/.test(lower)) return 'Investment Gain'
      return 'Interest'
    }
    if (cat === 'Bonus') {
      if (/incentive/.test(lower)) return 'Incentive'
      if (/performance/.test(lower)) return 'Performance Bonus'
      return 'Bonus'
    }
    if (cat === '13th Month') return '13th Month'
    if (/allowance/.test(lower)) return 'Allowance'
    if (/padala|remittance/.test(lower)) return 'Padala Received'
    if (/gift/.test(lower)) return 'Gift Received'
    if (/refund/.test(lower)) return 'Refund'
    if (/reimburse/.test(lower)) return 'Reimbursement'
    return 'Miscellaneous'
  }

  if (cat === 'Food & Dining') {
    if (/grocer|palengke|market|supermarket/.test(lower)) return 'Groceries / Palengke'
    if (/jollibee|mcdonald|mcdo|fast food/.test(lower)) return 'Fast Food'
    if (/coffee|milk tea|cafe|starbucks/.test(lower)) return 'Coffee / Milk Tea'
    if (/snack/.test(lower)) return 'Snacks'
    return 'Restaurants / Kainan'
  }

  if (cat === 'Transport') {
    if (/angkas|joyride|move it|motor/.test(lower)) return 'Motor Taxi'
    if (/grab|taxi/.test(lower)) return 'Taxi / Grab'
    if (/jeep|bus|mrt|lrt|train|mtr|jr|電車|地下鉄/.test(lower)) return 'Public Transport'
    if (/fuel|gas/.test(lower)) return 'Fuel'
    if (/parking/.test(lower)) return 'Parking'
    if (/toll/.test(lower)) return 'Toll'
    return 'Other'
  }

  if (cat === 'Shopping') {
    if (/shopee|lazada|online/.test(lower)) return 'Online Shopping'
    if (/household|grocery|home/.test(lower)) return 'Household'
    if (/electronic|gadget/.test(lower)) return 'Electronics'
    return 'Personal'
  }

  if (cat === 'Health') {
    if (/clinic/.test(lower)) return 'Clinic'
    if (/hospital/.test(lower)) return 'Hospital'
    if (/dental|dentist/.test(lower)) return 'Dental'
    if (/vitamin/.test(lower)) return 'Vitamins'
    return 'Medicine'
  }

  if (cat === 'Entertainment') {
    if (/movie|cinema/.test(lower)) return 'Movies'
    if (/game/.test(lower)) return 'Games'
    if (/event|concert/.test(lower)) return 'Events'
    return 'Hobbies'
  }

  if (cat === 'Personal Care') {
    if (/hair|barber|salon/.test(lower)) return 'Haircut / Salon'
    if (/skin|toiletr|watsons|beauty/.test(lower)) return 'Skincare / Toiletries'
    if (/laundry/.test(lower)) return 'Laundry'
    return 'Other'
  }

  if (cat === 'Education') {
    if (/tuition/.test(lower)) return 'Tuition'
    if (/suppl/.test(lower)) return 'School Supplies'
    if (/project|contribution/.test(lower)) return 'Projects / Contributions'
    if (/course/.test(lower)) return 'Online Course'
    return 'Other'
  }

  if (cat === 'Bills') {
    if (/electric|kuryente|meralco/.test(lower)) return 'Electricity'
    if (/water|maynilad|manila water/.test(lower)) return 'Water'
    if (/internet|fiber|wifi|pldt|converge/.test(lower)) return 'Internet'
    if (/globe|smart|dito|mobile|postpaid|load/.test(lower)) return 'Mobile'
    if (/rent/.test(lower)) return 'Rent'
    if (/association|assoc/.test(lower)) return 'Association Dues'
    if (/netflix|spotify|youtube|icloud|subscription/.test(lower)) return 'Subscriptions'
    if (/loan|installment|hulugan/.test(lower)) return 'Loan / Installment'
    if (/sss|pag-ibig|philhealth|bir|government/.test(lower)) return 'Government'
    if (/fee|charge/.test(lower)) return 'Fees'
    return 'Other'
  }

  if (/padala|support/.test(lower)) return 'Family Support / Padala'
  if (/saving|transfer/.test(lower)) return 'Transfer to Savings'
  if (/cash in|cash out|wallet/.test(lower)) return 'Cash In / Cash Out'
  return 'Miscellaneous'
}

function sanitizeEntity(value) {
  return String(value || '')
    .replace(/^[^A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyEntity(value) {
  const cleaned = sanitizeEntity(value)
  if (cleaned.length < 2 || cleaned.length > 60) return false
  if (!NAME_CHAR_PATTERN.test(cleaned)) return false
  if (/^(gcash|maya)$/i.test(cleaned)) return false
  if (/official receipt|thank you|reference|transaction|trace no|date|time|amount|total|領収書|合計|總計|小計/i.test(cleaned)) return false
  return true
}

function scoreEntityLine(line, index, totalLines) {
  const cleaned = sanitizeEntity(line)
  if (!isLikelyEntity(cleaned)) return -999

  let score = 20
  if (index <= 2) score += 24
  else score += Math.max(0, 16 - (index * 2))
  if (/^[A-Z0-9 .&'/-]{3,}$/.test(cleaned)) score += 14
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(cleaned)) score += 16
  if (/\d{3,}/.test(cleaned)) score -= 10
  if (cleaned.length > 34) score -= 6
  if (index > Math.max(totalLines * 0.45, 4)) score -= 12
  return score
}

function pickEntity(lines, lowerText, fallbackLabel = 'Imported transaction') {
  const labeledPatterns = [
    /(?:to|recipient|merchant|biller|sent to|store|shop)[\s:]+(.+)/i,
    /(?:from|sender|received from)[\s:]+(.+)/i,
  ]

  for (const line of lines) {
    for (const pattern of labeledPatterns) {
      const match = line.match(pattern)
      const cleaned = sanitizeEntity(match?.[1])
      if (isLikelyEntity(cleaned)) return { value: cleaned, confidence: 'high' }
    }
  }

  let best = null

  lines.forEach((line, index) => {
    const cleaned = sanitizeEntity(line)
    const score = scoreEntityLine(cleaned, index, lines.length)
    if (!best || score > best.score) {
      best = { value: cleaned, score }
    }
  })

  if (best && best.score > 12) {
    return {
      value: best.value,
      confidence: best.score >= 34 ? 'high' : best.score >= 22 ? 'medium' : 'low',
    }
  }

  if (lowerText.includes('gcash')) return { value: 'GCash transaction', confidence: 'medium' }
  if (lowerText.includes('maya')) return { value: 'Maya transaction', confidence: 'medium' }
  return { value: fallbackLabel, confidence: 'none' }
}

function extractQuantity(line) {
  const patterns = [
    /\bqty[:\s]*([0-9]+(?:\.[0-9]+)?)\b/i,
    /\b([0-9]+(?:\.[0-9]+)?)\s*(?:x|pcs|pc|items?)\b/i,
    /(?:x|×)\s*([0-9]+(?:\.[0-9]+)?)\b/i,
    /\b([0-9]+(?:\.[0-9]+)?)\s*(?:個|点)\b/i,
  ]

  for (const pattern of patterns) {
    const match = line.match(pattern)
    const quantity = parseFloat(match?.[1] || '')
    if (Number.isFinite(quantity) && quantity > 0) return quantity
  }

  return 1
}

function stripLastOccurrence(text, target) {
  if (!target) return text
  const index = text.lastIndexOf(target)
  if (index < 0) return text
  return `${text.slice(0, index)} ${text.slice(index + target.length)}`
}

function cleanLineItemName(line, amountCandidate) {
  let text = stripLastOccurrence(line, amountCandidate?.full || '')
  text = text.replace(/\bqty[:\s]*[0-9]+(?:\.[0-9]+)?\b/ig, ' ')
  text = text.replace(/\b[0-9]+(?:\.[0-9]+)?\s*(?:x|pcs|pc|items?)\b/ig, ' ')
  text = text.replace(/(?:x|×)\s*[0-9]+(?:\.[0-9]+)?\b/ig, ' ')
  text = text.replace(/\b[0-9]+(?:\.[0-9]+)?\s*(?:個|点)\b/ig, ' ')
  text = text.replace(/[•*]+/g, ' ')
  text = text.replace(/\s{2,}/g, ' ')
  text = text.replace(/^[\s:.-]+|[\s:.-]+$/g, '')
  return sanitizeEntity(text)
}

function extractLineItems(lines, totalAmount = null) {
  const items = []
  const seen = new Set()

  lines.forEach(line => {
    const lower = line.toLowerCase()
    if (!line || LINE_ITEM_SKIP.test(line) || line.length < 4 || line.length > 90) return

    const amounts = extractLineAmounts(line)
    if (!amounts.length) return

    const candidate = amounts[amounts.length - 1]
    if (totalAmount && Math.abs(candidate.value - totalAmount) < 0.009 && RECEIPT_TOTAL_POSITIVE.test(line)) return

    const name = cleanLineItemName(line, candidate)
    if (!name || name.length < 2 || LINE_ITEM_SKIP.test(name)) return
    if (!NAME_CHAR_PATTERN.test(name)) return

    const qty = extractQuantity(lower)
    const lineTotal = candidate.value
    const unitPrice = qty > 1 ? Number((lineTotal / qty).toFixed(2)) : lineTotal
    const dedupeKey = `${name.toLowerCase()}::${lineTotal}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)

    const confidence = qty > 1 || candidate.hasDecimal ? 'medium' : 'low'
    items.push({
      name,
      qty,
      price: unitPrice,
      lineTotal,
      confidence,
    })
  })

  return items.slice(0, 12)
}

function getBestConfidence(...levels) {
  const weights = { none: 0, low: 1, medium: 2, high: 3 }
  return levels.reduce((best, level) => (weights[level] || 0) > (weights[best] || 0) ? level : best, 'none')
}

function getOverallReceiptConfidence(amountConfidence, merchantConfidence, dateConfidence, lineItemsConfidence) {
  if (amountConfidence === 'high' && getBestConfidence(merchantConfidence, dateConfidence) === 'high') return 'high'
  if (amountConfidence === 'none') return 'low'
  if (getBestConfidence(amountConfidence, merchantConfidence, dateConfidence, lineItemsConfidence) === 'high') return 'medium'
  return getBestConfidence(amountConfidence, merchantConfidence, dateConfidence, lineItemsConfidence)
}

export function parseReceiptText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const lower = text.toLowerCase()
  const amountCandidate = extractReceiptAmount(lines)
  const dateCandidate = extractDate(lines)
  const merchantCandidate = pickEntity(lines, lower, 'Receipt')
  const preset = detectPreset('expense', `${text}\n${merchantCandidate.value}`)
  const cat = preset?.cat || guessCategory(text)
  const subcat = preset?.subcat || guessSubcategory('expense', cat, `${text}\n${merchantCandidate.value}`)
  const currency = detectReceiptCurrency(text, '')
  const lineItems = extractLineItems(lines, amountCandidate.value)
  const lineItemsConfidence = lineItems.length >= 3 ? 'medium' : lineItems.length ? 'low' : 'none'

  return {
    source: 'receipt',
    type: 'expense',
    amount: amountCandidate.value,
    amountConfidence: amountCandidate.confidence,
    date: dateCandidate.value || today(),
    dateConfidence: dateCandidate.value ? dateCandidate.confidence : 'none',
    desc: merchantCandidate.value,
    merchantConfidence: merchantCandidate.confidence,
    cat,
    subcat,
    currency,
    lineItems,
    lineItemsConfidence,
    overallConfidence: getOverallReceiptConfidence(amountCandidate.confidence, merchantCandidate.confidence, dateCandidate.confidence, lineItemsConfidence),
    presetKey: preset?.key || '',
    reference: extractReference(lines),
    needsReview: true,
  }
}

export function parseWalletText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const lower = text.toLowerCase()
  const wallet = lower.includes('gcash') ? 'GCash' : lower.includes('maya') ? 'Maya' : 'Wallet'
  const amount = extractWalletAmount(lines)
  const dateCandidate = extractDate(lines)
  const merchantCandidate = pickEntity(lines, lower)

  let type = 'expense'
  if (/cash in|transfer to bank|bank transfer|wallet transfer|load wallet|top up/.test(lower)) type = 'transfer'
  else if (/received|money received|incoming|credited|you got/.test(lower)) type = 'income'
  else if (/paid|payment|you sent|send money|merchant payment|purchase|debited/.test(lower)) type = 'expense'

  const fallbackDesc = type === 'income'
    ? `${wallet} income`
    : type === 'transfer'
      ? `${wallet} transfer`
      : `${wallet} payment`
  const resolvedType = type === 'income' ? 'income' : 'expense'
  const preset = detectPreset(resolvedType, `${text}\n${merchantCandidate.value}`)
  const cat = preset?.cat || guessCategory(text)
  const subcat = preset?.subcat || guessSubcategory(resolvedType, cat, `${text}\n${merchantCandidate.value}`)

  return {
    source: 'wallet',
    wallet,
    type,
    amount,
    amountConfidence: amount ? 'medium' : 'none',
    date: dateCandidate.value || today(),
    dateConfidence: dateCandidate.value ? dateCandidate.confidence : 'none',
    desc: merchantCandidate.value && !/^(GCash|Maya|Wallet) transaction$/i.test(merchantCandidate.value) ? merchantCandidate.value : fallbackDesc,
    merchantConfidence: merchantCandidate.confidence,
    cat,
    subcat,
    currency: detectReceiptCurrency(text, 'PHP'),
    presetKey: preset?.key || '',
    reference: extractReference(lines),
    needsReview: type === 'transfer' || !amount,
  }
}
