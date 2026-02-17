// Ascendia Extension Settings JavaScript
// Manages extension configuration, API keys, resume storage, and preferences

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
  await initializeSettings()
  setupEventListeners()
  await loadUserSettings()
  await checkConnectionStatus()
})

// Global state
let currentSettings = {
  apiKey: '',
  apiUrl: 'http://localhost:3000',
  resume: '',
  resumeFile: null,
  personalInfo: '',
  autoFillEnabled: true,
  showNotifications: true,
  maxDailyUsage: 50
}

async function initializeSettings() {
  // Load existing settings from storage
  const stored = await chrome.storage.local.get([
    'apiKey', 'apiUrl', 'resume', 'resumeFile', 'personalInfo',
    'settings'
  ])

  // Merge with defaults
  currentSettings = {
    ...currentSettings,
    ...stored,
    ...stored.settings
  }

  // Update status indicators
  updateStatusIndicators()
}

function setupEventListeners() {
  // API Configuration
  document.getElementById('apiKeyInput').addEventListener('input', handleApiKeyChange)
  document.getElementById('apiUrlInput').addEventListener('input', handleApiUrlChange)
  document.getElementById('toggleApiKey').addEventListener('click', toggleApiKeyVisibility)
  document.getElementById('testConnectionBtn').addEventListener('click', testConnection)

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
  // Populate form fields
  document.getElementById('apiKeyInput').value = currentSettings.apiKey || ''
  document.getElementById('apiUrlInput').value = currentSettings.apiUrl || 'https://your-app.vercel.app'
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

  // Character counter
  updatePersonalInfoCharCount()
}

function updateStatusIndicators() {
  // API Key Status
  const apiKeyStatus = document.getElementById('apiKeyStatus')
  const apiKeyStatusText = document.getElementById('apiKeyStatusText')

  if (currentSettings.apiKey) {
    apiKeyStatus.classList.add('success')
    apiKeyStatus.classList.remove('error')
    apiKeyStatusText.textContent = 'Configured'
    apiKeyStatusText.classList.add('success')
  } else {
    apiKeyStatus.classList.add('error')
    apiKeyStatus.classList.remove('success')
    apiKeyStatusText.textContent = 'Not configured'
    apiKeyStatusText.classList.add('error')
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

  if (!currentSettings.apiKey) {
    connectionStatus.classList.add('error')
    connectionStatusText.textContent = 'No API key'
    connectionStatusText.classList.add('error')
    return
  }

  try {
    connectionStatusText.textContent = 'Testing...'

    // Test connection to backend
    const response = await fetch(`${currentSettings.apiUrl}/api/extension/generate`, {
      method: 'GET',
      headers: {
        'x-api-key': currentSettings.apiKey,
        'Content-Type': 'application/json'
      }
    })

    console.log('Connection test response:', response.status, response.statusText)

    if (response.ok) {
      const data = await response.json()
      console.log('API Response:', data)

      if (data.authenticated) {
        connectionStatus.classList.add('success')
        connectionStatus.classList.remove('error', 'warning')
        connectionStatusText.textContent = 'Connected'
        connectionStatusText.classList.add('success')
        connectionStatusText.classList.remove('error', 'warning')
      } else {
        throw new Error('Authentication failed')
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      console.log('API Error:', errorData)

      let errorMessage = 'Connection failed'
      if (response.status === 401) {
        errorMessage = 'Invalid API key'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded'
      } else if (errorData.message) {
        errorMessage = errorData.message
      }

      throw new Error(errorMessage)
    }

  } catch (error) {
    console.error('Connection test error:', error)

    connectionStatus.classList.add('error')
    connectionStatus.classList.remove('success', 'warning')
    connectionStatusText.classList.add('error')
    connectionStatusText.classList.remove('success', 'warning')

    // Display specific error message
    let displayMessage = 'Connection failed'
    if (error.message.includes('NetworkError') || error.name === 'TypeError') {
      displayMessage = 'Network error'
    } else if (error.message.includes('Invalid API key') || error.message.includes('Unauthorized')) {
      displayMessage = 'Invalid API key'
    } else if (error.message.includes('Rate limit')) {
      displayMessage = 'Rate limit exceeded'
    } else if (error.message && error.message !== 'Failed to fetch') {
      displayMessage = error.message
    }

    connectionStatusText.textContent = displayMessage
  }
}

// Event Handlers
function handleApiKeyChange(e) {
  currentSettings.apiKey = e.target.value.trim()
  updateStatusIndicators()
}

function handleApiUrlChange(e) {
  currentSettings.apiUrl = e.target.value.trim()
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKeyInput')
  const button = document.getElementById('toggleApiKey')

  if (input.type === 'password') {
    input.type = 'text'
    button.textContent = '🙈'
    button.title = 'Hide'
  } else {
    input.type = 'password'
    button.textContent = '👁️'
    button.title = 'Show'
  }
}

async function testConnection() {
  const button = document.getElementById('testConnectionBtn')
  const originalText = button.textContent

  button.textContent = '🔄 Testing...'
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
  // Validate file
  const allowedTypes = ['application/pdf', 'application/msword',
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'text/plain']
  const maxSize = 5 * 1024 * 1024 // 5MB

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

    // Read file content
    const content = await readFileContent(file)

    // Store file info and content
    currentSettings.resumeFile = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }
    currentSettings.resume = content

    // Show preview
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
          // Extract text from PDF using PDF.js
          const extractedText = await extractPDFText(e.target.result)
          resolve(extractedText)
        } else {
          // For DOC/DOCX files, we need a different approach
          // For now, prompt user to use PDF or TXT
          resolve(`❌ CRITICAL: PDF extraction failed for ${file.name}

⚠️ IMPORTANT: Please convert your resume to PDF format or plain text.

Current file type (${file.type}) cannot be processed, which may cause the AI to generate content with incorrect experience.

To prevent hallucination:
1. Save your resume as PDF
2. Or copy/paste your resume text directly in the text area below

Without proper resume content, generated messages may contain false professional experience.`)
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

// Extract text from PDF using PDF.js (loaded from CDN)
async function extractPDFText(arrayBuffer) {
  try {
    // Load PDF.js from CDN if not already loaded
    if (typeof pdfjsLib === 'undefined') {
      await loadPDFJS()
    }

    const uint8Array = new Uint8Array(arrayBuffer)
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise

    let fullText = ''

    // Extract text from all pages
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

// Load PDF.js library from local files
function loadPDFJS() {
  return new Promise((resolve, reject) => {
    if (typeof pdfjsLib !== 'undefined') {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('lib/pdf.min.js')
    script.onload = () => {
      // Configure PDF.js worker with local file
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
    'This will permanently delete all your settings, API keys, resume, and usage history. This action cannot be undone.\n\nAre you sure?'
  )

  if (!confirmed) return

  try {
    showLoadingOverlay('Clearing all data...')

    // Clear all storage
    await chrome.storage.local.clear()

    // Reset current settings
    currentSettings = {
      apiKey: '',
      apiUrl: 'http://localhost:3000',
      resume: '',
      resumeFile: null,
      personalInfo: '',
      autoFillEnabled: true,
      showNotifications: true,
      maxDailyUsage: 50
    }

    // Reload the page to reset UI
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

    // Get usage data from storage
    const data = await chrome.storage.local.get([
      'dailyUsage', 'categoryUsage', 'accepted'
    ])

    // Create export object
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      dailyUsage: data.dailyUsage || {},
      categoryUsage: data.categoryUsage || {},
      acceptedMessages: data.accepted || [],
      settings: {
        maxDailyUsage: currentSettings.maxDailyUsage,
        autoFillEnabled: currentSettings.autoFillEnabled,
        showNotifications: currentSettings.showNotifications
      }
    }

    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ascendia-usage-data-${new Date().toISOString().split('T')[0]}.json`
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

    // Validate required fields
    if (!currentSettings.apiKey) {
      throw new Error('API key is required')
    }

    if (!currentSettings.apiUrl) {
      throw new Error('API URL is required')
    }

    // Save to storage
    await chrome.storage.local.set({
      apiKey: currentSettings.apiKey,
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

    // Test connection after saving
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
    // Reset form fields
    document.getElementById('apiKeyInput').value = ''
    document.getElementById('apiUrlInput').value = 'https://your-app.vercel.app'
    document.getElementById('personalInfo').value = ''
    document.getElementById('autoFillEnabled').checked = true
    document.getElementById('showNotifications').checked = true
    document.getElementById('maxDailyUsage').value = 50
    document.getElementById('dailyUsageValue').textContent = '50'

    // Reset current settings (but keep API key and resume)
    const { apiKey, resume, resumeFile } = currentSettings
    currentSettings = {
      apiKey, resume, resumeFile, // Keep these
      apiUrl: 'http://localhost:3000',
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

  // Auto-hide after 5 seconds
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
      await chrome.storage.local.set({
        apiKey: currentSettings.apiKey,
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

// Add auto-save to input handlers
document.addEventListener('input', autoSave)
document.addEventListener('change', autoSave)

console.log('Ascendia Settings page loaded')