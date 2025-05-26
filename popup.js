// Enhanced popup.js with legal disclaimers, testing, history, and better error handling
class EnhancedPopupController {
  constructor() {
    this.profileForm = document.getElementById('profile-form');
    this.autoFillBtn = document.getElementById('auto-fill-btn');
    this.testPageBtn = document.getElementById('test-page-btn');
    this.tabs = document.querySelectorAll('.tab-btn');
    this.tabPanels = document.querySelectorAll('.tab-panel');
    this.messagesContainer = document.getElementById('messages-container');
    this.fillProgressText = document.getElementById('fill-progress-text');

    this.resumeFileStatus = document.getElementById('resume-file-status');
    this.coverLetterFileStatus = document.getElementById('cover-letter-file-status');
    this.resumeFileInput = document.getElementById('resumeFile');
    this.coverLetterFileInput = document.getElementById('coverLetterFile');

    // Store file data temporarily before saving to profile
    this.tempResumeFileData = null;
    this.tempCoverLetterFileData = null;

    this.init();
  }

  async init() {
    this.showLegalDisclaimerIfNeeded();
    this.setupTabs();
    await this.loadProfileIntoForm();
    this.setupEventListeners();
    if (document.getElementById('application-history-list')) { // Ensure history tab elements exist
        await this.loadApplications();
    }
  }

  showLegalDisclaimerIfNeeded() {
    const disclaimerContainer = document.getElementById('legal-disclaimer-container');
    if (localStorage.getItem('job-auto-disclaimer-accepted') === 'true') {
      disclaimerContainer.style.display = 'none';
      return;
    }

    disclaimerContainer.innerHTML = `
      <div class="disclaimer-content-wrapper">
        <h4>⚠️ Important Legal Notice & User Responsibility</h4>
        <div class="disclaimer-text-content">
          <p><strong>User Responsibility:</strong> You are SOLELY responsible for reviewing ALL auto-filled information for accuracy and completeness before submitting any job application. Errors or omissions can occur.</p>
          <p><strong>Terms Compliance:</strong> Ensure your use of this extension complies with the terms of service of each job platform. Some platforms may prohibit automated form filling.</p>
          <p><strong>Data Privacy:</strong> Your profile data, including uploaded documents, is stored locally on your device using encryption. The encryption key is also stored locally. While measures are taken to secure your data, understand the inherent risks of storing sensitive information in a browser extension.</p>
          <p><strong>No Guarantees:</strong> This tool is provided "as-is" without any warranties, express or implied. Application success rates are not guaranteed and may vary significantly by platform and job.</p>
          <p><strong>CAPTCHA & Anti-Bot:</strong> This tool cannot and will not attempt to bypass CAPTCHAs or other sophisticated anti-bot measures.</p>
        </div>
        <label class="disclaimer-checkbox-label">
          <input type="checkbox" id="disclaimer-accepted-checkbox"> I have read, understood, and accept full responsibility for my use of this extension under these terms.
        </label>
        <button id="disclaimer-ok-btn" class="primary-btn" disabled>Continue</button>
      </div>
    `;
    disclaimerContainer.style.display = 'flex';

    const acceptCheckbox = document.getElementById('disclaimer-accepted-checkbox');
    const okButton = document.getElementById('disclaimer-ok-btn');

    acceptCheckbox.onchange = (e) => {
      okButton.disabled = !e.target.checked;
    };

    okButton.onclick = () => {
      localStorage.setItem('job-auto-disclaimer-accepted', 'true');
      disclaimerContainer.style.display = 'none';
    };
  }


  setupTabs() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.tabs.forEach(t => t.classList.remove('active'));
        this.tabPanels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
        if (tab.dataset.tab === 'history') {
            this.loadApplications(); // Refresh history when tab is clicked
        }
      });
    });
  }

  setupEventListeners() {
    if (this.profileForm) {
        this.profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });
    }
    if (this.autoFillBtn) {
        this.autoFillBtn.addEventListener('click', () => this.initiateAutoFill());
    }
    if (this.testPageBtn) {
        this.testPageBtn.addEventListener('click', () => this.testCurrentPage());
    }

    if (this.resumeFileInput) {
        this.resumeFileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files[0], 'resume'));
    }
    if (this.coverLetterFileInput) {
        this.coverLetterFileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files[0], 'coverLetter'));
    }

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => this.clearApplicationHistory());
    }
  }

  async handleFileUpload(file, type) {
    if (!file) {
      this.updateFileStatus(type, `No file selected.`, true);
      if (type === 'resume') this.tempResumeFileData = null;
      else if (type === 'coverLetter') this.tempCoverLetterFileData = null;
      return;
    }

    // Basic validation (size, type)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        this.showErrorMessage(`File "${file.name}" is too large (max 5MB).`);
        this.updateFileStatus(type, `File too large.`, true);
        if (type === 'resume') this.resumeFileInput.value = ''; else this.coverLetterFileInput.value = '';
        return;
    }
    // Add more specific type checking if needed: const allowedTypes = ['application/pdf', 'application/msword', ...];

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        base64Data: base64Data // Store base64 string
      };
      if (type === 'resume') {
        this.tempResumeFileData = fileData;
        this.updateFileStatus(type, `📄 ${file.name} ready.`);
      } else if (type === 'coverLetter') {
        this.tempCoverLetterFileData = fileData;
        this.updateFileStatus(type, `📝 ${file.name} ready.`);
      }
    };
    reader.onerror = (e) => {
        this.showErrorMessage(`Error reading file ${file.name}.`);
        this.updateFileStatus(type, `Error reading file.`, true);
    };
    reader.readAsDataURL(file);
  }

  updateFileStatus(type, message, isError = false) {
    const statusEl = type === 'resume' ? this.resumeFileStatus : this.coverLetterFileStatus;
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = isError ? 'file-status error' : 'file-status success';
    }
  }

  async saveProfile() {
    this.showProcessingMessage('Saving profile...');
    try {
      const profile = {};
      const formElements = this.profileForm.elements;
      for (let element of formElements) {
        if (element.id && element.type !== 'submit' && element.type !== 'file') {
          profile[element.id] = element.value;
        }
      }

      // Attach file data if new files were staged
      if (this.tempResumeFileData) profile.resumeFileData = this.tempResumeFileData;
      else if (profile.resumeFileData === undefined) profile.resumeFileData = null; // Ensure it's explicitly null if not set

      if (this.tempCoverLetterFileData) profile.coverLetterFileData = this.tempCoverLetterFileData;
      else if (profile.coverLetterFileData === undefined) profile.coverLetterFileData = null;


      const response = await chrome.runtime.sendMessage({ action: 'SAVE_PROFILE', data: profile });
      if (response && response.success) {
        this.showSuccessMessage(response.message || 'Profile saved securely!');
        this.tempResumeFileData = null; // Clear temp data after successful save
        this.tempCoverLetterFileData = null;
        await this.loadProfileIntoForm(); // Reload to reflect saved state including file names
      } else {
        this.showErrorMessage('Failed to save profile: ' + (response ? response.error : 'Unknown error'));
      }
    } catch (error) {
      this.showErrorMessage('Error saving profile: ' + error.message);
    }
  }

  async loadProfileIntoForm() {
    this.showProcessingMessage('Loading profile...');
    const profile = await chrome.runtime.sendMessage({ action: 'GET_PROFILE' });
    if (profile && Object.keys(profile).length > 0) {
      const formElements = this.profileForm.elements;
      for (let element of formElements) {
        if (element.id && profile[element.id] !== undefined && element.type !== 'file') {
          element.value = profile[element.id];
        }
      }
      // Update file status from loaded profile
      if (profile.resumeFileData && profile.resumeFileData.name) {
        this.updateFileStatus('resume', `📄 ${profile.resumeFileData.name} loaded.`);
        this.tempResumeFileData = profile.resumeFileData; // Keep it in temp if loaded from storage
      } else {
        this.updateFileStatus('resume', `No resume uploaded.`);
        this.tempResumeFileData = null;
      }
      if (profile.coverLetterFileData && profile.coverLetterFileData.name) {
        this.updateFileStatus('coverLetter', `📝 ${profile.coverLetterFileData.name} loaded.`);
        this.tempCoverLetterFileData = profile.coverLetterFileData;
      } else {
        this.updateFileStatus('coverLetter', `No cover letter uploaded.`);
        this.tempCoverLetterFileData = null;
      }
      this.showProcessingMessage(''); // Clear message
    } else {
      this.showProcessingMessage('No profile found. Please fill and save.');
    }
  }

  async initiateAutoFill() {
    if (localStorage.getItem('job-auto-disclaimer-accepted') !== 'true') {
        this.showErrorMessage('Please accept the legal disclaimer first (scroll to top).');
        // Force disclaimer to show
        localStorage.removeItem('job-auto-disclaimer-accepted');
        this.showLegalDisclaimerIfNeeded();
        document.getElementById('legal-disclaimer-container').scrollIntoView({behavior: 'smooth'});
        return;
    }

    this.fillProgressText.textContent = 'Starting auto-fill...';
    this.fillProgressText.className = 'status-processing';

    const profile = await chrome.runtime.sendMessage({ action: 'GET_PROFILE' });
    if (!profile || Object.keys(profile).length === 0) {
      this.fillProgressText.textContent = 'Error: Profile is empty. Please save your profile first.';
      this.fillProgressText.className = 'status-error';
      this.showErrorMessage('Profile is empty. Please save your profile first.');
      return;
    }

    // Ensure file data from profile is used if not freshly uploaded
    if (!this.tempResumeFileData && profile.resumeFileData) this.tempResumeFileData = profile.resumeFileData;
    if (!this.tempCoverLetterFileData && profile.coverLetterFileData) this.tempCoverLetterFileData = profile.coverLetterFileData;

    // Pass the actual file data (including base64) with the profile for injection
    const profileForFilling = { ...profile };
    if (this.tempResumeFileData) profileForFilling.resumeFileData = this.tempResumeFileData;
    if (this.tempCoverLetterFileData) profileForFilling.coverLetterFileData = this.tempCoverLetterFileData;

    const fillOptions = {
        fillBasic: document.getElementById('fill-basic').checked,
        fillContact: document.getElementById('fill-contact').checked,
        fillProfessional: document.getElementById('fill-professional').checked,
        uploadFiles: document.getElementById('upload-files').checked,
        handleConsent: document.getElementById('handle-consent').checked,
    };

    try {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) {
          throw new Error("Could not get active tab information.");
      }
      if (!currentTab.url || (!currentTab.url.startsWith('http:') && !currentTab.url.startsWith('https:'))) {
          throw new Error("Autofill cannot run on this type of page (e.g., new tab, extension page).");
      }


      const response = await chrome.runtime.sendMessage({
        action: 'AUTO_FILL',
        data: profileForFilling,
        options: fillOptions
      });

      if (response && response.success) {
        this.fillProgressText.textContent = 'Auto-fill successful!';
        this.fillProgressText.className = 'status-success';
        this.showSuccessMessage(response.message || 'Auto-fill completed successfully!');
        // Log application attempt
        this.logApplicationAttempt(currentTab.url, currentTab.title);
      } else {
        const errorMessage = response && response.error ? response.error : 'Auto-fill failed for an unknown reason.';
        this.fillProgressText.textContent = `Error: ${errorMessage}`;
        this.fillProgressText.className = 'status-error';
        this.showErrorMessage(errorMessage);
      }
    } catch (error) {
      this.fillProgressText.textContent = `Error: ${error.message}`;
      this.fillProgressText.className = 'status-error';
      this.showErrorMessage('Error initiating auto-fill: ' + error.message);
    }
  }

  async logApplicationAttempt(url, pageTitle) {
    let jobTitle = pageTitle;
    let companyName = "Unknown Company"; // Placeholder

    // Try to extract job title and company from page title (simple heuristic)
    if (pageTitle) {
        const parts = pageTitle.split(/ at | \| | - /); // Common separators
        if (parts.length > 0) jobTitle = parts[0].trim();
        if (parts.length > 1) companyName = parts[1].trim();
         // Refine company name if it still looks like a job site
        const jobSitePatterns = ['LinkedIn', 'Indeed', 'Dice', 'Myworkdayjobs', 'Greenhouse', 'Lever'];
        if (jobSitePatterns.some(p => companyName.includes(p))) {
            if (parts.length > 2 && !jobSitePatterns.some(p => parts[2].includes(p))) {
                companyName = parts[2].trim();
            } else {
                 companyName = new URL(url).hostname; // Fallback to hostname
            }
        }
    } else {
        jobTitle = "Unknown Job";
        companyName = new URL(url).hostname;
    }


    const applicationData = {
      id: Date.now().toString(), // Simple ID
      jobTitle: jobTitle,
      company: companyName,
      url: url,
      appliedDate: new Date().toISOString(),
      status: 'Attempted' // Or 'Filled', 'Applied' - based on confidence
    };
    await chrome.runtime.sendMessage({ action: 'LOG_APPLICATION', data: applicationData });
    await this.loadApplications(); // Refresh history list
  }

  async loadApplications() {
    const historyListDiv = document.getElementById('application-history-list');
    if (!historyListDiv) return;

    historyListDiv.innerHTML = '<p>Loading history...</p>'; // Loading state
    const applications = await chrome.runtime.sendMessage({ action: 'GET_APPLICATIONS' });

    if (applications && applications.length > 0) {
      historyListDiv.innerHTML = ''; // Clear loading/default message
      const ul = document.createElement('ul');
      applications.forEach(app => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${app.jobTitle || 'N/A'}</strong> at ${app.company || 'N/A'}<br>
          <a href="${app.url}" target="_blank" title="${app.url}">Applied On: ${new Date(app.appliedDate).toLocaleDateString()}</a>
          <em>(${app.status || 'N/A'})</em>
        `;
        ul.appendChild(li);
      });
      historyListDiv.appendChild(ul);
    } else {
      historyListDiv.innerHTML = '<p>No applications logged yet.</p>';
    }
  }

  async clearApplicationHistory() {
    if (confirm("Are you sure you want to clear all application history? This cannot be undone.")) {
        // To clear, we save an empty array.
        await chrome.runtime.sendMessage({ action: 'LOG_APPLICATION', data: 'CLEAR_HISTORY_MARKER' }); // Special marker
        // Or more directly: await SecureStorage.saveSecure('jobApplications', []); but background should own data ops
        // For this example, let's refine the background handler for 'LOG_APPLICATION'
        // Background.js would need to be updated to handle 'CLEAR_HISTORY_MARKER'
        // Simpler for now: just tell background to save an empty array for applications
        await chrome.runtime.sendMessage({ action: 'SAVE_APPLICATIONS_OVERWRITE', data: [] }); // Requires new action in background
        this.showSuccessMessage("Application history cleared.");
        await this.loadApplications();
    }
  }
  // Add SAVE_APPLICATIONS_OVERWRITE to background.js:
  // case 'SAVE_APPLICATIONS_OVERWRITE':
  //   await SecureStorage.saveSecure('jobApplications', request.data); // Overwrite with new data (e.g. empty array)
  //   sendResponse({ success: true });
  //   break;
  // For now, clearing will just tell it to log an application with a specific marker. The user would need
  // to modify background.js to actually clear based on this or add a dedicated clear action.
  // For a quick fix, I'll make `logApplication` in background.js handle it.
  // Updated `logApplication` in `background.js` to handle a special value to clear.


  async testCurrentPage() {
    this.fillProgressText.textContent = 'Testing current page...';
    this.fillProgressText.className = 'status-processing';
    const detectionResultDiv = document.getElementById('detection-result-content');
    detectionResultDiv.innerHTML = '<p>Testing...</p>';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url || (!tab.url.startsWith('http:') && !tab.url.startsWith('https:'))) {
          throw new Error("Cannot test this type of page. Please navigate to a job application form.");
      }
      const results = await chrome.runtime.sendMessage({ action: 'TEST_PLATFORM' });

      if (results && !results.error) {
        let htmlResult = `
          <p><strong>Platform Detected:</strong> ${results.platform || 'Unknown'}</p>
          <h4>Form Analysis:</h4>
          <p>Forms on page: ${results.formAnalysis ? results.formAnalysis.formCount : 'N/A'}</p>
          <p>Visible Input Fields: ${results.formAnalysis ? results.formAnalysis.visibleInputs : 'N/A'}</p>
          Field Types:
          <ul>
            ${results.formAnalysis && results.formAnalysis.fieldTypes ?
              Object.entries(results.formAnalysis.fieldTypes).map(([type, count]) => `<li>${type}: ${count}</li>`).join('') :
              '<li>N/A</li>'
            }
          </ul>
          <h4>Potential Challenges:</h4>
          ${(results.challenges && results.challenges.length > 0) ?
            `<ul>${results.challenges.map(challenge => `<li>${challenge}</li>`).join('')}</ul>` :
            '<p>No specific challenges identified automatically (manual review still recommended).</p>'
          }
        `;
        detectionResultDiv.innerHTML = htmlResult;
        this.fillProgressText.textContent = 'Test complete.';
        this.fillProgressText.className = 'status-idle';
      } else {
        detectionResultDiv.innerHTML = `<p class="error-message">Error during test: ${results ? results.error : 'Unknown error'}</p>`;
        this.fillProgressText.textContent = 'Test failed.';
        this.fillProgressText.className = 'status-error';
      }
    } catch (error) {
        detectionResultDiv.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
        this.fillProgressText.textContent = 'Test failed.';
        this.fillProgressText.className = 'status-error';
    }
  }

  showProcessingMessage(message) {
    if (this.fillProgressText && message) {
        this.fillProgressText.textContent = message;
        this.fillProgressText.className = 'status-processing';
    } else if (this.fillProgressText) {
        this.fillProgressText.textContent = 'Status: Idle';
        this.fillProgressText.className = 'status-idle';
    }
  }

  showMessage(message, type = 'info', duration = 4000) {
    // Clear existing messages quickly
    while (this.messagesContainer.firstChild) {
        this.messagesContainer.removeChild(this.messagesContainer.firstChild);
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`; // 'info', 'success', 'error'
    messageDiv.textContent = message;
    this.messagesContainer.appendChild(messageDiv);

    // Auto-remove message
    setTimeout(() => {
      if (messageDiv.parentNode === this.messagesContainer) { // Check if it hasn't been cleared already
        messageDiv.style.opacity = '0';
        setTimeout(() => messageDiv.remove(), 300); // Remove after fade
      }
    }, duration);
  }

  showSuccessMessage(message) { this.showMessage(message, 'success'); }
  showErrorMessage(message) { this.showMessage(message, 'error', 5000); }
}

// Initialize the popup controller once the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new EnhancedPopupController());
} else {
    new EnhancedPopupController();
}

// Make sure to add a new case to background.js for clearing history:
// In EnhancedJobAutomator class, handleMessage method:
/*
  async handleMessage(request, sender, sendResponse) {
    // ... other cases
    case 'SAVE_APPLICATIONS_OVERWRITE': // New action from popup.js for clearing history
      if (Array.isArray(request.data)) { // Ensure data is an array (e.g. empty for clear)
        await SecureStorage.saveSecure('jobApplications', request.data);
        sendResponse({ success: true, message: "Application history updated." });
      } else {
        sendResponse({ success: false, error: "Invalid data for overwriting applications."});
      }
      break;
    // ...
  }
*/
// And update the logApplication function in background.js to handle the marker
/*
  async logApplication(applicationData) {
    if (applicationData === 'CLEAR_HISTORY_MARKER') { // Check for special marker
        await SecureStorage.saveSecure('jobApplications', []);
        console.log('[JobAuto BG] Application history cleared.');
        return;
    }
    let applications = await SecureStorage.loadSecure('jobApplications') || [];
    applications.unshift(applicationData); // Add to the beginning of the list
    if (applications.length > 100) { // Limit history size
        applications = applications.slice(0, 100);
    }
    await SecureStorage.saveSecure('jobApplications', applications);
  }
*/
// The `clearApplicationHistory` function in popup.js has been updated to use a new action for clarity.
// The background.js needs the `'SAVE_APPLICATIONS_OVERWRITE'` case.
