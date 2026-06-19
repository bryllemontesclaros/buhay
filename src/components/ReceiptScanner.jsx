import { useEffect, useRef, useState } from 'react'
import {
  findPresetByLabel,
  getDefaultTransactionDraft,
  getTransactionCategories,
  sanitizeTransactionCategory,
  sanitizeTransactionSubcategory,
} from '../lib/transactionOptions'
import { preprocessReceiptImage } from '../lib/receiptUtils'
import { formatDisplayDate, today } from '../lib/utils'
import rStyles from './ReceiptScanner.module.css'

const EXPENSE_CATS = getTransactionCategories('expense')
const INCOME_CATS = getTransactionCategories('income')

const EMPTY_FORM = {
  type: 'expense',
  amount: '',
  date: '',
  desc: '',
  cat: 'Other',
  reference: '',
}

function getCameraErrorMessage(error) {
  const name = String(error?.name || '')

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow camera permission, or use quick photo or gallery upload instead.'
  }

  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'We could not find the preferred rear camera. Try switching cameras or use gallery upload instead.'
  }

  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is busy in another app or tab. Close it there, then try again.'
  }

  return 'Could not start the live camera preview. Use quick photo or gallery upload instead.'
}

function buildCapturedImageFile(blob, fileName = 'receipt.jpg') {
  if (typeof File === 'function') {
    return new File([blob], fileName, { type: blob.type || 'image/jpeg' })
  }

  const fallbackBlob = blob
  fallbackBlob.name = fileName
  return fallbackBlob
}

function getCategoryOptions(type) {
  return type === 'income' ? INCOME_CATS : EXPENSE_CATS
}

function getManualDraft(mode, fileName = '', context = 'transaction') {
  const cleanedName = String(fileName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()

  if (context === 'grocery') {
    return {
      ...EMPTY_FORM,
      type: 'expense',
      amount: '',
      date: '',
      desc: cleanedName || 'Grocery item',
      cat: 'Other',
      reference: '',
    }
  }

  const baseDesc = mode === 'wallet' ? 'Imported wallet transaction' : 'Imported receipt'
  return {
    ...EMPTY_FORM,
    type: 'expense',
    amount: '',
    date: today(),
    desc: cleanedName || baseDesc,
    cat: 'Other',
    reference: '',
  }
}

function getBlankDraft(context = 'transaction') {
  if (context === 'grocery') {
    return {
      ...EMPTY_FORM,
      type: 'expense',
      date: '',
    }
  }

  return {
    ...EMPTY_FORM,
    type: 'expense',
    date: today(),
  }
}

export default function ReceiptScanner({
  onResult,
  onClose,
  defaultMode = 'wallet',
  context = 'transaction',
  embedded = false,
  receiptOnly = false,
  walletOnly = false,
  submitLabel = '',
}) {
  const isGrocery = context === 'grocery'
  const [mode, setMode] = useState(isGrocery || receiptOnly ? 'receipt' : walletOnly ? 'wallet' : defaultMode)
  const [status, setStatus] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showDetails, setShowDetails] = useState(false)
  const [notice, setNotice] = useState({ text: '', tone: 'info' })
  const [rawText, setRawText] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [scanCurrency, setScanCurrency] = useState('')
  const [parsedMeta, setParsedMeta] = useState(null)
  const [captureArtifacts, setCaptureArtifacts] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStatus, setCameraStatus] = useState('idle')
  const [cameraError, setCameraError] = useState('')
  const [cameraFacing, setCameraFacing] = useState('environment')
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const liveCameraSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const canCapturePhoto = !walletOnly && (mode !== 'wallet' || receiptOnly || isGrocery)

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function stopLiveCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => {
      stopLiveCamera()
    }
  }, [])

  useEffect(() => {
    if (!cameraOpen) {
      stopLiveCamera()
      return undefined
    }

    if (!canCapturePhoto || !liveCameraSupported) {
      setCameraStatus('error')
      setCameraError('Live camera preview is not available here. Use quick photo or gallery upload instead.')
      return undefined
    }

    let cancelled = false

    async function startLiveCamera() {
      setCameraStatus('starting')
      setCameraError('')
      stopLiveCamera()

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1600 },
            height: { ideal: 2200 },
            aspectRatio: { ideal: 0.72 },
          },
        })

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.muted = true
          videoRef.current.setAttribute('playsinline', 'true')
          await videoRef.current.play().catch(() => {})
        }

        setCameraStatus('ready')
      } catch (error) {
        if (cancelled) return
        stopLiveCamera()
        setCameraStatus('error')
        setCameraError(getCameraErrorMessage(error))
      }
    }

    startLiveCamera()

    return () => {
      cancelled = true
      stopLiveCamera()
    }
  }, [cameraFacing, cameraOpen, canCapturePhoto, liveCameraSupported])

  function setField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function resetState(nextMode = mode) {
    setCameraOpen(false)
    setCameraStatus('idle')
    setCameraError('')
    setCameraFacing('environment')
    setStatus('idle')
    setNotice({ text: '', tone: 'info' })
    setRawText('')
    setSourceLabel('')
    setScanCurrency('')
    setParsedMeta(null)
    setCaptureArtifacts(null)
    setForm(getBlankDraft(context))
    setShowDetails(false)
    setMode(isGrocery || receiptOnly ? 'receipt' : walletOnly ? 'wallet' : nextMode)
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  function openGuidedCamera() {
    setNotice({ text: '', tone: 'info' })
    setCameraError('')
    setCameraOpen(true)
  }

  function closeGuidedCamera() {
    setCameraOpen(false)
    setCameraStatus('idle')
    setCameraError('')
  }

  function applyParsed(parsed) {
    if (isGrocery) {
      setForm({
        type: 'expense',
        amount: parsed.amount ? String(parsed.amount) : '',
        date: '',
        desc: parsed.desc || '',
        cat: 'Other',
        reference: parsed.reference || '',
      })
      setShowDetails(false)
      return
    }

    const nextType = parsed.type === 'income' ? 'income' : parsed.type === 'transfer' ? 'transfer' : 'expense'
    const categoryOptions = getCategoryOptions(nextType === 'income' ? 'income' : 'expense')
    const nextCategory = categoryOptions.includes(parsed.cat) ? parsed.cat : categoryOptions[categoryOptions.length - 1]

    setForm({
      type: nextType,
      amount: parsed.amount ? String(parsed.amount) : '',
      date: parsed.date || '',
      desc: parsed.desc || '',
      cat: nextCategory,
      reference: parsed.reference || '',
    })
    setShowDetails(Boolean(parsed.reference))
  }

  async function processImage(file) {
    if (!file) return

    setStatus('loading')
    setNotice({ text: '', tone: 'info' })
    setSourceLabel(isGrocery ? 'Imported price tag' : mode === 'wallet' ? 'Imported wallet screenshot' : 'Imported receipt image')
    setScanCurrency('')

    let prepared = null

    try {
      prepared = await preprocessReceiptImage(file)
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
      setPreview(prepared.cleanedDataUrl || prepared.originalDataUrl || null)
      setCaptureArtifacts(prepared)
    } catch {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(file))
      setCaptureArtifacts(null)
    }

    setRawText('')
    setForm(getManualDraft(mode, file.name, context))
    setShowDetails(false)
    setParsedMeta(null)
    setScanCurrency('')
    setStatus('done')
    setNotice({
      text: isGrocery
        ? 'Image cleanup stayed on this device. Enter the item name and price manually before adding it.'
        : mode === 'wallet'
          ? 'Image cleanup stayed on this device. Review the screenshot and fill in the transaction details manually.'
          : 'Receipt cleanup stayed on this device. Enter the merchant, total, and date manually before saving.',
      tone: 'info',
    })
  }

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (cameraOpen) closeGuidedCamera()
    if (file) processImage(file)
    event.target.value = ''
  }

  async function handleGuidedCapture() {
    const video = videoRef.current

    if (!video || cameraStatus !== 'ready' || !video.videoWidth || !video.videoHeight) {
      setCameraError('The camera is still getting ready. Wait a moment, then try again.')
      return
    }

    setCameraStatus('capturing')
    setCameraError('')

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context2d = canvas.getContext('2d')
      if (!context2d) {
        throw new Error('Canvas capture is unavailable.')
      }
      context2d.drawImage(video, 0, 0, canvas.width, canvas.height)

      const capturedBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob)
          else reject(new Error('Could not capture the current frame.'))
        }, 'image/jpeg', 0.92)
      })

      const sourceName = isGrocery ? 'grocery' : mode === 'wallet' ? 'wallet' : 'receipt'
      const capturedFile = buildCapturedImageFile(capturedBlob, `buhay-${sourceName}-${Date.now()}.jpg`)

      closeGuidedCamera()
      await processImage(capturedFile)
    } catch {
      setCameraStatus('ready')
      setCameraError('Could not capture the current frame. Try again, or use quick photo instead.')
    }
  }

  function handleConfirm() {
    const amountValue = Number(form.amount)
    if (isGrocery) {
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setNotice({ text: 'Enter a price greater than zero before adding this item.', tone: 'warning' })
        return
      }
      onResult?.({
        amount: amountValue,
        desc: form.desc || 'Grocery item',
        reference: form.reference,
        source: 'grocery',
        rawText,
      })
      return
    }

    if (!form.amount || !form.date || !form.desc) {
      setNotice({ text: 'Add amount, date, and merchant or description before continuing.', tone: 'warning' })
      return
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setNotice({ text: 'Amount must be greater than zero before continuing.', tone: 'warning' })
      return
    }
    if (form.type === 'transfer') {
      setNotice({ text: 'Transfers are not supported from scanner review yet. Choose income or expense.', tone: 'warning' })
      return
    }

    const nextType = form.type === 'income' ? 'income' : 'expense'
    const nextDraft = getDefaultTransactionDraft(nextType)
    const nextCat = sanitizeTransactionCategory(nextType, form.cat || nextDraft.cat)
    const matchedPreset = findPresetByLabel(nextType, form.desc || '')
    const nextPreset = matchedPreset && !matchedPreset.isCustom && matchedPreset.cat === nextCat ? matchedPreset : null
    const nextSubcat = sanitizeTransactionSubcategory(nextType, nextCat, nextPreset?.subcat || nextDraft.subcat)

    onResult?.({
      type: nextType,
      amount: amountValue,
      date: form.date,
      desc: form.desc,
      cat: nextCat,
      subcat: nextSubcat,
      presetKey: nextPreset?.key || '',
      reference: form.reference,
      source: mode,
      currency: parsedMeta?.currency || scanCurrency,
      confidence: mode === 'receipt'
        ? {
            overall: parsedMeta?.overallConfidence || 'low',
            amount: parsedMeta?.amountConfidence || 'none',
            merchant: parsedMeta?.merchantConfidence || 'none',
            date: parsedMeta?.dateConfidence || 'none',
            lineItems: parsedMeta?.lineItemsConfidence || 'none',
          }
        : '',
      amountConfidence: parsedMeta?.amountConfidence || 'none',
      merchantConfidence: parsedMeta?.merchantConfidence || 'none',
      dateConfidence: parsedMeta?.dateConfidence || 'none',
      lineItemsConfidence: parsedMeta?.lineItemsConfidence || 'none',
      lineItems: parsedMeta?.lineItems || [],
      rawText,
      originalBlob: captureArtifacts?.originalBlob || null,
      cleanedBlob: captureArtifacts?.cleanedBlob || null,
      originalImageDataUrl: captureArtifacts?.originalDataUrl || preview || '',
      cleanedImageDataUrl: captureArtifacts?.cleanedDataUrl || preview || '',
      cleanupSummary: captureArtifacts?.cleanupSummary || '',
      imageWidth: captureArtifacts?.width || 0,
      imageHeight: captureArtifacts?.height || 0,
      cleanedWidth: captureArtifacts?.cleanedWidth || 0,
      cleanedHeight: captureArtifacts?.cleanedHeight || 0,
    })
  }

  const categoryOptions = getCategoryOptions((receiptOnly ? 'expense' : form.type) === 'income' ? 'income' : 'expense')
  const isWalletImport = walletOnly || mode === 'wallet'
  const headerTitle = isGrocery ? 'Import grocery item' : receiptOnly ? 'Scan receipt' : isWalletImport ? 'Import screenshot' : 'Import transaction'
  const headerSub = isGrocery
    ? 'Import a photo of a price tag or shelf label, then confirm the item before adding it to this trip.'
    : receiptOnly
      ? 'Capture or upload a receipt, review the details, then save it to your receipt box.'
      : isWalletImport
        ? 'Import a wallet screenshot, then review before saving.'
        : 'Import from a screenshot or receipt photo, then review before saving.'
  const uploadTitle = isGrocery
    ? 'Import a grocery price tag photo'
    : receiptOnly
      ? 'Capture a receipt'
      : isWalletImport
      ? 'Import a GCash or Maya screenshot'
      : 'Import a receipt photo or image'
  const uploadSub = isGrocery
    ? 'We clean the image on this device first, then you confirm the item and price yourself before adding it.'
    : receiptOnly
      ? 'We clean the image on this device first, then you review and enter the merchant, date, and total before saving.'
      : isWalletImport
      ? 'We clean the image on this device first, then you review the screenshot and enter the transaction details manually.'
      : 'We clean the image on this device first, then you review and enter the receipt details manually.'
  const resultTitle = isGrocery ? 'Grocery item review' : receiptOnly ? 'Receipt review' : sourceLabel || (isWalletImport ? 'Imported wallet screenshot' : 'Imported transaction')
  const resultNote = isGrocery
    ? 'This stays local until you save it, so confirm the name and price before adding the item.'
    : receiptOnly
      ? 'We cleaned the image on this device. Confirm the total, date, and merchant before saving.'
      : isWalletImport
      ? 'We cleaned the screenshot on this device. Confirm the type and amount before saving.'
    : 'We cleaned the receipt on this device. Review the details before saving.'
  const actionLabel = submitLabel || (isGrocery ? 'Add item →' : receiptOnly ? 'Use receipt details →' : 'Continue with these details →')
  const confidenceLabel = parsedMeta?.overallConfidence
    ? `${parsedMeta.overallConfidence.charAt(0).toUpperCase()}${parsedMeta.overallConfidence.slice(1)} confidence`
    : ''
  const cameraTitle = isGrocery ? 'Center the price tag inside the frame' : 'Align the receipt inside the frame'
  const cameraHint = isGrocery
    ? 'Keep the full label visible, avoid reflections, and hold steady before capture.'
    : 'Keep all four edges visible, fill most of the frame, and avoid glare for the cleanest scan.'
  const cameraLiveLabel = cameraFacing === 'environment' ? 'Rear camera preferred' : 'Front camera active'
  const loadingVerb = 'Preparing'

  return (
    <div className={`${rStyles.wrap} ${embedded ? rStyles.embedded : ''}`}>
      {!embedded && (
        <div className={rStyles.header}>
          <div>
            <div className={rStyles.title}>{headerTitle}</div>
            <div className={rStyles.uploadSub}>
              {headerSub}
            </div>
          </div>
          <button className={rStyles.closeBtn} onClick={() => onClose?.()}>✕</button>
        </div>
      )}

      {!isGrocery && !receiptOnly && !walletOnly && (
        <div className={rStyles.modeRow}>
          <button
            type="button"
            className={`${rStyles.modeBtn} ${mode === 'wallet' ? rStyles.modeBtnActive : ''}`}
            onClick={() => resetState('wallet')}
          >
            GCash / Maya screenshot
          </button>
          <button
            type="button"
            className={`${rStyles.modeBtn} ${mode === 'receipt' ? rStyles.modeBtnActive : ''}`}
            onClick={() => resetState('receipt')}
          >
            Receipt image
          </button>
        </div>
      )}

      {status === 'idle' && (
        <div className={rStyles.idleStack}>
          {!cameraOpen ? (
            <div className={rStyles.uploadArea}>
              <div className={rStyles.uploadVisual}>
                <div className={rStyles.guideCard}>
                  <div className={rStyles.guidePill}>Guided capture</div>
                  <div className={rStyles.guideScreen}>
                    <div className={rStyles.guideGlow} />
                    <div className={rStyles.guideFrame}>
                      <div className={rStyles.guideCorners} />
                      <div className={rStyles.guideReceipt} />
                    </div>
                  </div>
                  <div className={rStyles.guideCaption}>{cameraHint}</div>
                </div>
              </div>

              <div className={rStyles.uploadBody}>
                <div className={rStyles.uploadIcon}>{isGrocery ? '🛒' : mode === 'wallet' ? '📲' : '🧾'}</div>
                <div className={rStyles.uploadTitle}>{uploadTitle}</div>
                <div className={rStyles.uploadSub}>{uploadSub}</div>
                <div className={rStyles.privacyCard}>
                  <div>
                    <div className={rStyles.privacyTitle}>Local-only scan</div>
                    <div className={rStyles.privacyText}>
                      Buhay cleans the image on this device and keeps the scan manual until you review and save it.
                    </div>
                  </div>
                </div>
                {notice.text && (
                  <div className={`${rStyles.noticeMsg} ${notice.tone === 'warning' ? rStyles.noticeWarn : rStyles.noticeInfo}`}>
                    {notice.tone === 'warning' ? '⚠ ' : 'ℹ '}
                    {notice.text}
                  </div>
                )}
                {!!captureArtifacts?.cleanupSummary && (
                  <div className={rStyles.captureMeta}>
                    {captureArtifacts.cleanupSummary}
                  </div>
                )}
                <div className={rStyles.tipRow}>
                  {canCapturePhoto && <span className={rStyles.tipPill}>Rear camera preferred</span>}
                  <span className={rStyles.tipPill}>{isGrocery ? 'Keep the whole label visible' : isWalletImport ? 'Keep the full screenshot visible' : 'Fill the frame with the receipt'}</span>
                  <span className={rStyles.tipPill}>{isWalletImport ? 'Crop extra UI before upload if possible' : 'Darker background helps auto-trim'}</span>
                </div>
                <div className={rStyles.btnRow}>
                  {canCapturePhoto && liveCameraSupported && (
                    <button className={rStyles.btnUse} onClick={openGuidedCamera}>
                      Open guided camera
                    </button>
                  )}
                  {canCapturePhoto && (
                    <button className={rStyles.btnCamera} onClick={() => cameraRef.current?.click()}>
                      📷 {liveCameraSupported ? 'Quick photo' : 'Take photo'}
                    </button>
                  )}
                  <button className={rStyles.btnUpload} onClick={() => fileRef.current?.click()}>
                    📂 {isGrocery ? 'Upload photo' : mode === 'wallet' ? 'Upload screenshot' : 'Upload image'}
                  </button>
                </div>
                {canCapturePhoto && !liveCameraSupported && (
                  <div className={rStyles.resultNote}>
                    Live preview is not available in this browser, but quick camera capture and gallery upload still work.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={rStyles.cameraStage}>
              <div className={rStyles.cameraTopRow}>
                <span className={rStyles.liveBadge}>{cameraLiveLabel}</span>
                <button type="button" className={rStyles.inlineBtn} onClick={closeGuidedCamera}>
                  Close camera
                </button>
              </div>

              <div className={rStyles.cameraViewport}>
                <video ref={videoRef} className={rStyles.cameraVideo} autoPlay muted playsInline />
                <div className={rStyles.cameraOverlay}>
                  <div className={rStyles.cameraOverlayTop}>{cameraTitle}</div>
                  <div className={rStyles.cameraGuideFrame}>
                    <div className={rStyles.cameraGuideCorners} />
                  </div>
                  <div className={rStyles.cameraOverlayBottom}>{cameraHint}</div>
                </div>

                {cameraStatus !== 'ready' && (
                  <div className={rStyles.cameraStateCard}>
                    {cameraStatus === 'starting' || cameraStatus === 'capturing' ? <div className={rStyles.spinner} /> : null}
                    <div>
                      <div className={rStyles.cameraStateTitle}>
                        {cameraStatus === 'capturing'
                          ? 'Capturing photo...'
                          : cameraStatus === 'starting'
                            ? 'Starting camera...'
                            : 'Camera preview unavailable'}
                      </div>
                      <div className={rStyles.cameraStateText}>
                        {cameraStatus === 'error' ? cameraError : 'Hold steady while Buhay gets the camera ready.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={rStyles.cameraActionRow}>
                <button
                  type="button"
                  className={rStyles.btnRetry}
                  onClick={() => setCameraFacing(current => current === 'environment' ? 'user' : 'environment')}
                  disabled={cameraStatus === 'starting' || cameraStatus === 'capturing'}
                >
                  Switch camera
                </button>
                <button
                  type="button"
                  className={rStyles.btnUpload}
                  onClick={() => {
                    closeGuidedCamera()
                    fileRef.current?.click()
                  }}
                >
                  Use gallery
                </button>
                <button
                  type="button"
                  className={rStyles.btnUse}
                  onClick={handleGuidedCapture}
                  disabled={cameraStatus !== 'ready'}
                >
                  Take photo
                </button>
              </div>
            </div>
          )}

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </div>
      )}

      {status === 'loading' && (
        <div className={rStyles.loadingArea}>
          {preview && <img src={preview} className={rStyles.preview} alt="Imported transaction" />}
          <div className={rStyles.loadingText}>
            <div className={rStyles.spinner} />
            {loadingVerb} {isGrocery ? 'price tag' : mode === 'wallet' ? 'wallet screenshot' : 'receipt'}...
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className={rStyles.resultArea}>
          {preview && <img src={preview} className={rStyles.preview} alt="Imported transaction" />}
          <div className={rStyles.resultTitle}>{resultTitle}</div>
          {notice.text && (
            <div className={`${rStyles.noticeMsg} ${notice.tone === 'warning' ? rStyles.noticeWarn : rStyles.noticeInfo}`}>
              {notice.tone === 'warning' ? '⚠ ' : 'ℹ '}
              {notice.text}
            </div>
          )}
          <div className={rStyles.resultNote}>{resultNote}</div>
          {!!captureArtifacts?.cleanupSummary && (
            <div className={rStyles.captureMeta}>
              {captureArtifacts.cleanupSummary}
              {scanCurrency ? ` · ${scanCurrency} detected` : ''}
              {confidenceLabel ? ` · ${confidenceLabel}` : ''}
              {parsedMeta?.lineItems?.length ? ` · ${parsedMeta.lineItems.length} items found` : ''}
            </div>
          )}

          {isGrocery ? (
            <div className={rStyles.formGrid}>
              <label className={rStyles.formField}>
                <span>Price</span>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={event => setField('amount', event.target.value)} />
              </label>
              <label className={`${rStyles.formField} ${rStyles.fullWidth}`}>
                <span>Item name</span>
                <input value={form.desc} onChange={event => setField('desc', event.target.value)} placeholder="e.g. Eggs, rice, coffee" />
              </label>
            </div>
          ) : (
            <div className={rStyles.formGrid}>
              {!receiptOnly && (
                <label className={rStyles.formField}>
                  <span>Type</span>
                  <select value={form.type} onChange={event => setField('type', event.target.value)}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer / other</option>
                  </select>
                </label>
              )}
              <label className={rStyles.formField}>
                <span>{receiptOnly ? 'Total' : 'Amount'}</span>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={event => setField('amount', event.target.value)} />
              </label>
              <label className={rStyles.formField}>
                <span>Date</span>
                <div className={rStyles.dateFieldWrap}>
                  <div className={`${rStyles.dateFieldDisplay} ${rStyles.formFieldControl}`}>
                    {formatDisplayDate(form.date)}
                  </div>
                  <input
                    type="date"
                    className={`${rStyles.formFieldControl} ${rStyles.dateFieldNative}`}
                    value={form.date}
                    aria-label="Date"
                    onChange={event => setField('date', event.target.value)}
                  />
                </div>
              </label>
              <label className={rStyles.formField}>
                <span>Category</span>
                <select value={form.cat} onChange={event => setField('cat', event.target.value)}>
                  {categoryOptions.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className={`${rStyles.formField} ${rStyles.fullWidth}`}>
                <span>{receiptOnly ? 'Merchant' : 'Merchant / description'}</span>
                <input value={form.desc} onChange={event => setField('desc', event.target.value)} placeholder={receiptOnly ? 'Store or merchant name' : 'Describe this transaction'} />
              </label>
              {(mode === 'wallet' || receiptOnly) && (
                <div className={`${rStyles.detailSection} ${rStyles.fullWidth}`}>
                  <button type="button" className={rStyles.detailToggle} onClick={() => setShowDetails(current => !current)}>
                    <span>{showDetails ? 'Hide more details' : receiptOnly ? 'Receipt details' : 'More details'}</span>
                    {!showDetails && form.reference && <span className={rStyles.detailMeta}>Reference captured</span>}
                  </button>
                  {showDetails && (
                    <label className={`${rStyles.formField} ${rStyles.fullWidth}`}>
                      <span>{receiptOnly ? 'Reference / note' : 'Reference'}</span>
                      <input value={form.reference} onChange={event => setField('reference', event.target.value)} placeholder={receiptOnly ? 'Optional receipt or invoice number' : 'Optional reference number'} />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {!isGrocery && !receiptOnly && form.type === 'transfer' && (
            <div className={rStyles.transferNote}>
              Transfers are not stored separately yet. Pick Income or Expense before adding this entry.
            </div>
          )}

          <div className={rStyles.btnRow}>
            <button className={rStyles.btnRetry} onClick={() => resetState(mode)}>
              Import another
            </button>
            <button
              className={rStyles.btnUse}
              onClick={handleConfirm}
              disabled={isGrocery ? !form.amount : !form.amount || !form.date || !form.desc || (!receiptOnly && form.type === 'transfer')}
            >
              {actionLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
