// Aletheia Extension Settings JavaScript
// Manages extension configuration, resume storage, and preferences

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
  await initializeSettings()
  setupEventListeners()
  await loadUserSettings()
  await checkConnectionStatus()
})

// Production default — used when no custom URL has been saved
const DEFAULT_API_URL = 'https://aletheia.vercel.app'

// Global state
let currentSettings = {
  apiUrl: DEFAULT_API_URL,
  resume: '',
  resumeFile: null,
  personalInfo: '',
  autoFillEnabled: true,
  showNotifications: true,
  maxDailyUsage: 50
}

async function initializeSettings() {
  // Read the API base URL from chrome.storage.sync (shared across devices)
  const { apiBaseUrl } = await chrome.storage.sync.get('apiBaseUrl')

  const stored = await chrome.storage.local.get([
    'apiUrl', 'resume', 'resumeFile', 'personalInfo',
    'settings'
  ])

  currentSettings = {
    ...currentSettings,
    ...stored,
    ...stored.settings,
    // Prefer sync storage, then local, then default
    apiUrl: apiBaseUrl || stored.apiUrl || DEFAULT_API_URL
  }

  updateStatusIndicators()
}

function setupEventListeners() {
  // API URL — select dropdown + custom text input + hidden legacy input
  document.getElementById('apiUrlSelect').addEventListener('change', handleApiUrlSelectChange)
  document.getElementById('apiUrlCustom').addEventListener('input', handleApiUrlCustomChange)
  document.getElementById('apiUrlInput').addEventListener('input', handleApiUrlChange)
  document.getElementById('testConnectionBtn').addEventListener('click', testConnection)

  // Auth actions
  document.getElementById('connectBtn')?.addEventListener('click', handleConnect)
  document.getElementById('disconnectBtn')?.addEventListener('click', handleDisconnect)

  // Resume Upload
  const uploadArea = document.getElementById('uploadArea')
  const fileInput = document.getElementById('resumeUpload')
  const browseBtn = document.getElementById('browseBtn')

  uploadArea.addEventListener('click', () => fileInput.click())
  uploadArea.addEventListener('dragover', handleDragOver)
  uploadArea.addEventListener('drop', handleFileDrop)
  uploadArea.addEventListener('dragleave', handleDragLeave)

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    fileInput.click()
  })

  fileInput.addEventListener('change', handleFileSelect)
  document.getElementById('removeResume')?.addEventListener('click', removeResume)

  // Personal Info
  document.getElementById('personalInfo').addEventListener('input', handlePersonalInfoChange)

  // Usage Preferences
  document.getElementById('autoFillEnabled').addEventListener('change', handleAutoFillToggle)
  document.getElementById('showNotifications').addEventListener('change', handleNotificationsToggle)
  document.getElementById('maxDailyUsage').addEventListener('input', handleDailyUsageChange)

  // Data Management
  document.getElementById('clearDataBtn').addEventListener('click', clearAllData)
  document.getElementById('exportDataBtn').addEventListener('click', exportUsageData)

  // Save Actions
  document.getElementById('saveSettingsBtn').addEventListener('click', saveAllSettings)
  document.getElementById('resetSettingsBtn').addEventListener('click', resetToDefaults)

  // Status Message
  document.getElementById('closeStatus').addEventListener('click', hideStatusMessage)
}

async function loadUserSettings() {
  // Populate the API URL select / custom input
  const apiSelect = document.getElementById('apiUrlSelect')
  const apiCustomInput = document.getElementById('apiUrlCustom')
  const currentUrl = currentSettings.apiUrl || DEFAULT_API_URL

  // Check if the current URL matches one of the preset options
  const presetValues = Array.from(apiSelect.options).map(o => o.value)
  if (presetValues.includes(currentUrl)) {
    apiSelect.value = currentUrl
    apiCustomInput.classList.add('hidden')
  } else {
    apiSelect.value = 'custom'
    apiCustomInput.value = currentUrl
    apiCustomInput.classList.remove('hidden')
  }

  document.getElementById('apiUrlInput').value = currentUrl
  document.getElementById('personalInfo').value = currentSettings.personalInfo || ''

  // Checkboxes
  document.getElementById('autoFillEnabled').checked = currentSettings.autoFillEnabled !== false
  document.getElementById('showNotifications').checked = currentSettings.showNotifications !== false

  // Range slider
  const dailyUsageSlider = document.getElementById('maxDailyUsage')
  const dailyUsageValue = document.getElementById('dailyUsageValue')
  dailyUsageSlider.value = currentSettings.maxDailyUsage || 50
  dailyUsageValue.textContent = dailyUsageSlider.value

  // Resume preview
  if (currentSettings.resume || currentSettings.resumeFile) {
    showResumePreview(currentSettings.resumeFile, currentSettings.resume)
  }

  updatePersonalInfoCharCount()
}

async function updateStatusIndicators() {
  // Auth Status
  const authStatus = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAuthStatus' }, resolve)
  })

  const authStatusCard = document.getElementById('authStatus')
  const authStatusText = document.getElementById('authStatusText')
  const connectBtn = document.getElementById('connectBtn')
  const disconnectBtn = document.getElementById('disconnectBtn')

  if (authStatus && authStatus.authenticated) {
    authStatusCard.classList.add('success')
    authStatusCard.classList.remove('error')
    authStatusText.textContent = authStatus.user?.email || 'Connected'
    authStatusText.classList.add('success')
    authStatusText.classList.remove('error')
    if (connectBtn) connectBtn.classList.add('hidden')
    if (disconnectBtn) disconnectBtn.classList.remove('hidden')
  } else {
    authStatusCard.classList.add('error')
    authStatusCard.classList.remove('success')
    authStatusText.textContent = 'Not connected'
    authStatusText.classList.add('error')
    authStatusText.classList.remove('success')
    if (connectBtn) connectBtn.classList.remove('hidden')
    if (disconnectBtn) disconnectBtn.classList.add('hidden')
  }

  // Resume Status
  const resumeStatus = document.getElementById('resumeStatus')
  const resumeStatusText = document.getElementById('resumeStatusText')

  if (currentSettings.resume || currentSettings.resumeFile) {
    resumeStatus.classList.add('success')
    resumeStatus.classList.remove('error')
    resumeStatusText.textContent = 'Uploaded'
    resumeStatusText.classList.add('success')
  } else {
    resumeStatus.classList.add('warning')
    resumeStatus.classList.remove('success')
    resumeStatusText.textContent = 'Not uploaded'
    resumeStatusText.classList.add('warning')
  }
}

async function checkConnectionStatus() {
  const connectionStatus = document.getElementById('connectionStatus')
  const connectionStatusText = document.getElementById('connectionStatusText')

  // Check auth first
  const authStatus = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAuthStatus' }, resolve)
  })

  if (!authStatus || !authStatus.authenticated) {
    connectionStatus.classList.add('error')
    connectionStatusText.textContent = 'Not connected'
    connectionStatusText.classList.add('error')
    return
  }

  try {
    connectionStatusText.textContent = 'Testing...'

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'healthCheck' }, resolve)
    })

    if (result && result.success) {
      connectionStatus.classList.add('success')
      connectionStatus.classList.remove('error', 'warning')
      connectionStatusText.textContent = 'Connected'
      connectionStatusText.classList.add('success')
      connectionStatusText.classList.remove('error', 'warning')
    } else {
      throw new Error(result?.error || 'Connection failed')
    }

  } catch (error) {
    console.error('Connection test error:', error)

    connectionStatus.classList.add('error')
    connectionStatus.classList.remove('success', 'warning')
    connectionStatusText.classList.add('error')
    connectionStatusText.classList.remove('success', 'warning')
    connectionStatusText.textContent = error.message || 'Connection failed'
  }
}

async function handleConnect() {
  const btn = document.getElementById('connectBtn')
  const originalText = btn.textContent
  btn.textContent = 'Connecting...'
  btn.disabled = true
  console.log('[SETTINGS] Connect clicked, sending authenticate message...')

  try {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
        console.log('[SETTINGS] authenticate response:', JSON.stringify(response))
        resolve(response)
      })
    })

    if (result && result.success) {
      console.log('[SETTINGS] ✓ Connected:', result.user?.email)
      showStatusMessage('Connected to Aletheia!', 'success')
      await updateStatusIndicators()
      await checkConnectionStatus()
    } else {
      console.error('[SETTINGS] ✗ Failed:', result?.error)
      showStatusMessage(result?.error || 'Connection failed. Make sure you are logged in to the Aletheia web app.', 'error')
    }
  } catch (error) {
    console.error('[SETTINGS] ✗ authenticate threw:', error)
    showStatusMessage('Connection failed: ' + error.message, 'error')
  } finally {
    btn.textContent = originalText
    btn.disabled = false
  }
}

async function handleDisconnect() {
  const confirmed = confirm('Disconnect from Aletheia? You will need to reconnect to use the extension.')
  if (!confirmed) return

  try {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'logout' }, resolve)
    })

    if (result && result.success) {
      showStatusMessage('Disconnected from Aletheia', 'success')
      await updateStatusIndicators()
      await checkConnectionStatus()
    }
  } catch (error) {
    showStatusMessage('Disconnect failed: ' + error.message, 'error')
  }
}

// Event Handlers
function handleApiUrlSelectChange(e) {
  const value = e.target.value
  const customInput = document.getElementById('apiUrlCustom')

  if (value === 'custom') {
    customInput.classList.remove('hidden')
    customInput.focus()
    currentSettings.apiUrl = customInput.value.trim() || DEFAULT_API_URL
  } else {
    customInput.classList.add('hidden')
    currentSettings.apiUrl = value
  }

  // Keep the hidden legacy input in sync
  document.getElementById('apiUrlInput').value = currentSettings.apiUrl
}

function handleApiUrlCustomChange(e) {
  currentSettings.apiUrl = e.target.value.trim()
  document.getElementById('apiUrlInput').value = currentSettings.apiUrl
}

function handleApiUrlChange(e) {
  currentSettings.apiUrl = e.target.value.trim()
}

async function testConnection() {
  const button = document.getElementById('testConnectionBtn')
  const originalText = button.textContent

  button.textContent = 'Testing...'
  button.disabled = true

  try {
    await checkConnectionStatus()
    showStatusMessage('Connection test completed!', 'success')
  } catch (error) {
    showStatusMessage('Connection test failed: ' + error.message, 'error')
  } finally {
    button.textContent = originalText
    button.disabled = false
  }
}

function handleDragOver(e) {
  e.preventDefault()
  e.stopPropagation()
  document.getElementById('uploadArea').classList.add('drag-over')
}

function handleDragLeave(e) {
  e.preventDefault()
  e.stopPropagation()
  document.getElementById('uploadArea').classList.remove('drag-over')
}

function handleFileDrop(e) {
  e.preventDefault()
  e.stopPropagation()
  document.getElementById('uploadArea').classList.remove('drag-over')

  const files = e.dataTransfer.files
  if (files.length > 0) {
    processResumeFile(files[0])
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file) {
    processResumeFile(file)
  }
}

async function processResumeFile(file) {
  const allowedTypes = ['application/pdf', 'application/msword',
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'text/plain']
  const maxSize = 5 * 1024 * 1024

  if (!allowedTypes.includes(file.type)) {
    showStatusMessage('Please upload a PDF, DOC, DOCX, or TXT file', 'error')
    return
  }

  if (file.size > maxSize) {
    showStatusMessage('File size must be less than 5MB', 'error')
    return
  }

  try {
    showLoadingOverlay('Processing resume...')

    const content = await readFileContent(file)

    currentSettings.resumeFile = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }
    currentSettings.resume = content

    showResumePreview(currentSettings.resumeFile, content)
    updateStatusIndicators()

    showStatusMessage('Resume uploaded successfully!', 'success')

  } catch (error) {
    showStatusMessage('Failed to process resume: ' + error.message, 'error')
  } finally {
    hideLoadingOverlay()
  }
}

async function readFileContent(file) {
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        if (file.type === 'text/plain') {
          resolve(e.target.result)
        } else if (file.type === 'application/pdf') {
          const extractedText = await extractPDFText(e.target.result)
          resolve(extractedText)
        } else {
          resolve(`Please convert your resume to PDF format or plain text.

Current file type (${file.type}) cannot be processed.

To use your resume:
1. Save your resume as PDF
2. Or copy/paste your resume text directly in the text area below`)
        }
      } catch (error) {
        reject(new Error(`Failed to extract content from ${file.name}: ${error.message}`))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))

    if (file.type === 'text/plain') {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

async function extractPDFText(arrayBuffer) {
  try {
    if (typeof pdfjsLib === 'undefined') {
      await loadPDFJS()
    }

    const uint8Array = new Uint8Array(arrayBuffer)
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise

    let fullText = ''

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      fullText += pageText + '\n'
    }

    if (fullText.trim().length === 0) {
      throw new Error('No text content found in PDF. The PDF might be image-based.')
    }

    return fullText.trim()

  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`PDF text extraction failed: ${error.message}. Please try converting to text format.`)
  }
}

function loadPDFJS() {
  return new Promise((resolve, reject) => {
    if (typeof pdfjsLib !== 'undefined') {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('lib/pdf.min.js')
    script.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js')
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load local PDF.js library'))
    document.head.appendChild(script)
  })
}

function showResumePreview(fileInfo, content) {
  const preview = document.getElementById('resumePreview')
  const fileName = document.getElementById('resumeFileName')
  const fileSize = document.getElementById('resumeSize')
  const resumeContent = document.getElementById('resumeContent')

  if (fileInfo) {
    fileName.textContent = fileInfo.name
    fileSize.textContent = `${(fileInfo.size / 1024).toFixed(1)} KB`
  }

  resumeContent.textContent = content.substring(0, 500) + (content.length > 500 ? '...' : '')

  preview.classList.remove('hidden')
  document.getElementById('uploadArea').style.display = 'none'
}

function removeResume() {
  if (confirm('Are you sure you want to remove your resume?')) {
    currentSettings.resume = ''
    currentSettings.resumeFile = null

    document.getElementById('resumePreview').classList.add('hidden')
    document.getElementById('uploadArea').style.display = 'block'
    document.getElementById('resumeUpload').value = ''

    updateStatusIndicators()
    showStatusMessage('Resume removed', 'success')
  }
}

function handlePersonalInfoChange(e) {
  currentSettings.personalInfo = e.target.value
  updatePersonalInfoCharCount()
}

function updatePersonalInfoCharCount() {
  const textarea = document.getElementById('personalInfo')
  const counter = document.getElementById('personalInfoCount')
  const length = textarea.value.length

  counter.textContent = length

  if (length > 1000) {
    counter.style.color = '#ef4444'
    textarea.value = textarea.value.substring(0, 1000)
  } else {
    counter.style.color = '#6b7280'
  }
}

function handleAutoFillToggle(e) {
  currentSettings.autoFillEnabled = e.target.checked
}

function handleNotificationsToggle(e) {
  currentSettings.showNotifications = e.target.checked
}

function handleDailyUsageChange(e) {
  currentSettings.maxDailyUsage = parseInt(e.target.value)
  document.getElementById('dailyUsageValue').textContent = e.target.value
}

async function clearAllData() {
  const confirmed = confirm(
    'This will permanently delete all your settings, resume, and usage history. This action cannot be undone.\n\nAre you sure?'
  )

  if (!confirmed) return

  try {
    showLoadingOverlay('Clearing all data...')

    await chrome.storage.local.clear()
    await chrome.storage.sync.remove('apiBaseUrl')

    currentSettings = {
      apiUrl: DEFAULT_API_URL,
      resume: '',
      resumeFile: null,
      personalInfo: '',
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50
    }

    window.location.reload()

  } catch (error) {
    showStatusMessage('Failed to clear data: ' + error.message, 'error')
  } finally {
    hideLoadingOverlay()
  }
}

async function exportUsageData() {
  try {
    showLoadingOverlay('Exporting usage data...')

    const data = await chrome.storage.local.get([
      'dailyUsage', 'categoryUsage', 'accepted'
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      dailyUsage: data.dailyUsage || {},
      categoryUsage: data.categoryUsage || {},
      acceptedMessages: data.accepted || [],
      settings: {
        maxDailyUsage: currentSettings.maxDailyUsage,
        autoFillEnabled: currentSettings.autoFillEnabled,
        showNotifications: currentSettings.showNotifications
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aletheia-usage-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showStatusMessage('Usage data exported successfully!', 'success')

  } catch (error) {
    showStatusMessage('Failed to export data: ' + error.message, 'error')
  } finally {
    hideLoadingOverlay()
  }
}

async function saveAllSettings() {
  try {
    showLoadingOverlay('Saving settings...')

    if (!currentSettings.apiUrl) {
      throw new Error('API URL is required')
    }

    // Persist the API base URL in sync storage (shared across devices)
    await chrome.storage.sync.set({ apiBaseUrl: currentSettings.apiUrl })

    await chrome.storage.local.set({
      apiUrl: currentSettings.apiUrl,
      resume: currentSettings.resume,
      resumeFile: currentSettings.resumeFile,
      personalInfo: currentSettings.personalInfo,
      settings: {
        autoFillEnabled: currentSettings.autoFillEnabled,
        showNotifications: currentSettings.showNotifications,
        maxDailyUsage: currentSettings.maxDailyUsage
      }
    })

    await checkConnectionStatus()

    showStatusMessage('Settings saved successfully!', 'success')

  } catch (error) {
    showStatusMessage('Failed to save settings: ' + error.message, 'error')
  } finally {
    hideLoadingOverlay()
  }
}

async function resetToDefaults() {
  const confirmed = confirm('Reset all settings to default values?')
  if (!confirmed) return

  try {
    document.getElementById('apiUrlInput').value = DEFAULT_API_URL
    document.getElementById('apiUrlSelect').value = DEFAULT_API_URL
    document.getElementById('apiUrlCustom').classList.add('hidden')
    document.getElementById('personalInfo').value = ''
    document.getElementById('autoFillEnabled').checked = true
    document.getElementById('showNotifications').checked = true
    document.getElementById('maxDailyUsage').value = 50
    document.getElementById('dailyUsageValue').textContent = '50'

    const { resume, resumeFile } = currentSettings
    currentSettings = {
      resume, resumeFile,
      apiUrl: DEFAULT_API_URL,
      personalInfo: '',
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50
    }

    updatePersonalInfoCharCount()
    showStatusMessage('Settings reset to defaults', 'success')

  } catch (error) {
    showStatusMessage('Failed to reset settings: ' + error.message, 'error')
  }
}

// UI Helper Functions
function showStatusMessage(message, type = 'success') {
  const statusEl = document.getElementById('statusMessage')
  const textEl = document.getElementById('statusText')

  textEl.textContent = message
  statusEl.className = `status-message ${type}`
  statusEl.classList.remove('hidden')

  setTimeout(() => {
    hideStatusMessage()
  }, 5000)
}

function hideStatusMessage() {
  document.getElementById('statusMessage').classList.add('hidden')
}

function showLoadingOverlay(message = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay')
  const text = document.getElementById('loadingText')

  text.textContent = message
  overlay.classList.remove('hidden')
}

function hideLoadingOverlay() {
  document.getElementById('loadingOverlay').classList.add('hidden')
}

// Auto-save functionality
let saveTimeout
function autoSave() {
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    try {
      await chrome.storage.sync.set({ apiBaseUrl: currentSettings.apiUrl })
      await chrome.storage.local.set({
        apiUrl: currentSettings.apiUrl,
        resume: currentSettings.resume,
        resumeFile: currentSettings.resumeFile,
        personalInfo: currentSettings.personalInfo,
        settings: {
          autoFillEnabled: currentSettings.autoFillEnabled,
          showNotifications: currentSettings.showNotifications,
          maxDailyUsage: currentSettings.maxDailyUsage
        }
      })
    } catch (error) {
      console.warn('Auto-save failed:', error)
    }
  }, 2000)
}

document.addEventListener('input', autoSave)
document.addEventListener('change', autoSave)

console.log('Aletheia Settings page loaded')
