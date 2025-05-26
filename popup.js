// Enhanced popup.js
class EnhancedPopupController {
  constructor() {
    this.profileForm = document.getElementById('profile-form');
    this.deleteProfileBtn = document.getElementById('delete-profile-btn');
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

    this.statusIndicatorText = document.getElementById('status-text');
    this.statusIndicatorDot = document.querySelector('#status-indicator .status-dot');


    this.tempResumeFileData = null;
    this.tempCoverLetterFileData = null;

    this.init();
  }

  async init() {
    this.showLegalDisclaimerIfNeeded();
    this.setupTabs();
    await this.loadProfileIntoForm();
    this.setupEventListeners();
    if (document.getElementById('application-history-list')) {
      await this.loadApplications();
    }
    this.updateOverallStatus('Ready', 'ready');
  }

  updateOverallStatus(text, type = 'ready') { // types: ready, processing, error, success
    if (this.statusIndicatorText) this.statusIndicatorText.textContent = text;
    if (this.statusIndicatorDot) {
        this.statusIndicatorDot.className = 'status-dot'; // Reset
        if (type === 'processing') this.statusIndicatorDot.classList.add('processing');
        else if (type === 'error') this.statusIndicatorDot.classList.add('error');
        else if (type === 'success') this.statusIndicatorDot.classList.add('success');
        // 'ready' uses default green
    }
  }


  showLegalDisclaimerIfNeeded() {
    const disclaimerContainer = document.getElementById('legal-disclaimer-container');
    if (!disclaimerContainer) return;

    if (localStorage.getItem('job-auto-disclaimer-accepted') === 'true') {
      disclaimerContainer.style.display = 'none';
      return;
    }
    // ... (HTML for disclaimer as in previous popup.html) ...
    // This ensures that if the disclaimer HTML isn't in popup.html initially, it gets created.
    // For simplicity, assuming it's in popup.html and we just control display.
    disclaimerContainer.style.display = 'flex'; // Show it if not accepted

    const acceptCheckbox = document.getElementById('disclaimer-accepted-checkbox'); // Assuming ID from HTML
    const okButton = document.getElementById('disclaimer-ok-btn'); // Assuming ID from HTML

    if (acceptCheckbox && okButton) {
        acceptCheckbox.onchange = (e) => {
        okButton.disabled = !e.target.checked;
        };
        okButton.onclick = () => {
        localStorage.setItem('job-auto-disclaimer-accepted', 'true');
        disclaimerContainer.style.display = 'none';
        };
    } else {
        console.warn("Disclaimer checkbox or OK button not found in the DOM for legal notice.");
    }
  }


  setupTabs() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.tabs.forEach(t => t.classList.remove('active'));
        this.tabPanels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const activeTabPanel = document.getElementById(tab.dataset.tab + '-tab');
        if (activeTabPanel) activeTabPanel.classList.add('active');

        if (tab.dataset.tab === 'history') {
          this.loadApplications();
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
    if (this.deleteProfileBtn) {
        this.deleteProfileBtn.addEventListener('click', () => this.deleteProfile());
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
    const statusEl = type === 'resume' ? this.resumeFileStatus : this.coverLetterFileStatus;
    const inputEl = type === 'resume' ? this.resumeFileInput : this.coverLetterFileInput;

    if (!file) {
      this.updateFileStatusUI(statusEl, `No file selected.`, true);
      if (type === 'resume') this.tempResumeFileData = null;
      else if (type === 'coverLetter') this.tempCoverLetterFileData = null;
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.showErrorMessage(`File "${file.name}" is too large (max 5MB).`);
      this.updateFileStatusUI(statusEl, `File too large.`, true);
      if (inputEl) inputEl.value = ''; // Clear the input
      return;
    }

    this.updateOverallStatus('Processing file...', 'processing');
    try {
        const reader = new FileReader();
        reader.onload = (e) => {
        const base64Data = e.target.result;
        const fileData = { name: file.name, type: file.type, size: file.size, base64Data: base64Data };
        if (type === 'resume') {
            this.tempResumeFileData = fileData;
            this.updateFileStatusUI(statusEl, `📄 ${file.name} ready to save.`);
        } else if (type === 'coverLetter') {
            this.tempCoverLetterFileData = fileData;
            this.updateFileStatusUI(statusEl, `📝 ${file.name} ready to save.`);
        }
        this.showSuccessMessage(`${file.name} processed.`);
        this.updateOverallStatus('Ready', 'ready');
        };
        reader.onerror = (e) => {
            throw new Error(`Error reading file ${file.name}.`);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        this.showErrorMessage(error.message);
        this.updateFileStatusUI(statusEl, `Error processing file.`, true);
        if (inputEl) inputEl.value = '';
        this.updateOverallStatus('Error processing file', 'error');
    }
  }

  updateFileStatusUI(statusElement, message, isError = false) {
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = isError ? 'file-status error' : 'file-status success';
    }
  }

  async saveProfile() {
    if (localStorage.getItem('job-auto-disclaimer-accepted') !== 'true') {
        this.showErrorMessage('Please accept the legal disclaimer first.');
        this.showLegalDisclaimerIfNeeded(); // Ensure it's visible
        return;
    }
    this.showProcessingMessage('Saving profile...');
    this.updateOverallStatus('Saving profile...', 'processing');
    try {
      const profileDataToSave = {};
      const formElements = this.profileForm.elements;
      for (let element of formElements) {
        if (element.id && element.type !== 'submit' && element.type !== 'button' && element.type !== 'file') {
          profileDataToSave[element.id] = element.value;
        }
      }

      // Incorporate staged file data (or retain existing if no new file was staged)
      profileDataToSave.resumeFileData = this.tempResumeFileData || (await this.getCurrentProfileData()).resumeFileData || null;
      profileDataToSave.coverLetterFileData = this.tempCoverLetterFileData || (await this.getCurrentProfileData()).coverLetterFileData || null;

      const response = await chrome.runtime.sendMessage({ action: 'SAVE_PROFILE', data: profileDataToSave });
      if (response && response.success) {
        this.showSuccessMessage(response.message || 'Profile saved successfully!');
        this.tempResumeFileData = profileDataToSave.resumeFileData; // Update temp data to reflect saved state
        this.tempCoverLetterFileData = profileDataToSave.coverLetterFileData;
        await this.loadProfileIntoForm(); // Reload to confirm and update UI from potentially modified data
        this.updateOverallStatus('Profile Saved', 'success');
      } else {
        this.showErrorMessage('Failed to save profile: ' + (response ? response.error : 'Unknown error'));
        this.updateOverallStatus('Save failed', 'error');
      }
    } catch (error) {
      this.showErrorMessage('Error saving profile: ' + error.message);
      this.updateOverallStatus('Save error', 'error');
    } finally {
        this.showProcessingMessage(''); // Clear "Saving..."
    }
  }

  async deleteProfile() {
    if (localStorage.getItem('job-auto-disclaimer-accepted') !== 'true') {
        this.showErrorMessage('Please accept the legal disclaimer first.');
        this.showLegalDisclaimerIfNeeded();
        return;
    }
    if (!confirm("Are you sure you want to delete your profile? This action cannot be undone.")) {
      return;
    }
    this.showProcessingMessage('Deleting profile...');
    this.updateOverallStatus('Deleting...', 'processing');
    try {
      const response = await chrome.runtime.sendMessage({ action: 'DELETE_PROFILE' });
      if (response && response.success) {
        this.showSuccessMessage(response.message || 'Profile deleted.');
        this.profileForm.reset(); // Clear the form
        this.tempResumeFileData = null;
        this.tempCoverLetterFileData = null;
        this.updateFileStatusUI(this.resumeFileStatus, 'No resume uploaded.');
        this.updateFileStatusUI(this.coverLetterFileStatus, 'No cover letter uploaded.');
        this.updateOverallStatus('Profile Deleted', 'success');
      } else {
        this.showErrorMessage('Failed to delete profile: ' + (response ? response.error : 'Unknown error.'));
        this.updateOverallStatus('Delete failed', 'error');
      }
    } catch (error) {
      this.showErrorMessage('Error deleting profile: ' + error.message);
      this.updateOverallStatus('Delete error', 'error');
    } finally {
        this.showProcessingMessage('');
    }
  }


  async loadProfileIntoForm() {
    this.showProcessingMessage('Loading profile...');
    this.updateOverallStatus('Loading profile...', 'processing');
    try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_PROFILE' });
        if (response && response.success) {
            const profile = response.profile;
            if (profile && Object.keys(profile).length > 0) {
                const formElements = this.profileForm.elements;
                for (let element of formElements) {
                    if (element.id && profile[element.id] !== undefined && element.type !== 'file' && element.type !== 'submit' && element.type !== 'button') {
                    element.value = profile[element.id];
                    }
                }
                this.tempResumeFileData = profile.resumeFileData || null;
                this.tempCoverLetterFileData = profile.coverLetterFileData || null;

                this.updateFileStatusUI(this.resumeFileStatus, this.tempResumeFileData ? `📄 ${this.tempResumeFileData.name} loaded.` : 'No resume uploaded.');
                this.updateFileStatusUI(this.coverLetterFileStatus, this.tempCoverLetterFileData ? `📝 ${this.tempCoverLetterFileData.name} loaded.` : 'No cover letter uploaded.');
                this.showProcessingMessage('');
                this.updateOverallStatus('Profile Loaded', 'ready');
            } else {
                this.showProcessingMessage('No profile found. Please fill and save.');
                this.updateOverallStatus('No profile', 'ready');
                this.profileForm.reset(); // Ensure form is clear if no profile
                this.updateFileStatusUI(this.resumeFileStatus, 'No resume uploaded.');
                this.updateFileStatusUI(this.coverLetterFileStatus, 'No cover letter uploaded.');
            }
        } else {
            throw new Error(response.error || "Failed to get profile from background.");
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        this.showErrorMessage(`Error loading profile: ${error.message}. It might be corrupted or an encryption key issue.`);
        this.showProcessingMessage('');
        this.updateOverallStatus('Profile error', 'error');
        // Optionally clear the form or guide user to re-create profile
        this.profileForm.reset();
        this.updateFileStatusUI(this.resumeFileStatus, 'Profile load error.');
        this.updateFileStatusUI(this.coverLetterFileStatus, 'Profile load error.');
    }
  }

  async getCurrentProfileData() {
    // Helper to get current profile state without full UI load, useful for SAVE_PROFILE
    const response = await chrome.runtime.sendMessage({ action: 'GET_PROFILE' });
    if (response && response.success && response.profile) {
        return response.profile;
    }
    return {}; // Return empty object if not found or error
  }


  async initiateAutoFill() {
    if (localStorage.getItem('job-auto-disclaimer-accepted') !== 'true') {
        this.showErrorMessage('Please accept the legal disclaimer first (see top of Profile tab).');
        this.showLegalDisclaimerIfNeeded();
        return;
    }

    this.fillProgressText.textContent = 'Preparing auto-fill...';
    this.fillProgressText.className = 'status-processing';
    this.updateOverallStatus('Auto-filling...', 'processing');

    const profileResponse = await chrome.runtime.sendMessage({ action: 'GET_PROFILE' });

    if (!profileResponse || !profileResponse.success || !profileResponse.profile || Object.keys(profileResponse.profile).length === 0) {
      const errorMsg = 'Profile is empty or could not be loaded. Please save your profile first.';
      this.fillProgressText.textContent = `Error: ${errorMsg}`;
      this.fillProgressText.className = 'status-error';
      this.showErrorMessage(errorMsg);
      this.updateOverallStatus('Profile error', 'error');
      return;
    }
    const profileForFilling = profileResponse.profile; // This profile already includes fileData objects from storage

    const fillOptions = {
      fillBasic: document.getElementById('fill-basic').checked,
      fillContact: document.getElementById('fill-contact').checked,
      fillProfessional: document.getElementById('fill-professional').checked,
      uploadFiles: document.getElementById('upload-files').checked,
      handleConsent: document.getElementById('handle-consent').checked,
    };

    try {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab || !currentTab.id) throw new Error("Could not get active tab.");
      if (!currentTab.url || (!currentTab.url.startsWith('http:') && !currentTab.url.startsWith('https:'))) {
        throw new Error("Autofill cannot run on this page type.");
      }

      this.fillProgressText.textContent = 'Auto-filling in progress...';
      const response = await chrome.runtime.sendMessage({
        action: 'AUTO_FILL',
        data: profileForFilling, // Send the full profile object which includes fileData
        options: fillOptions
      });

      if (response && response.success) {
        const successMsg = response.message || 'Auto-fill completed!';
        this.fillProgressText.textContent = successMsg;
        this.fillProgressText.className = 'status-success';
        this.showSuccessMessage(successMsg);
        this.logApplicationAttempt(currentTab.url, currentTab.title || "Untitled Page");
        this.updateOverallStatus('Auto-fill Done', 'success');
      } else {
        const errorDetail = response && response.error ? response.error : 'Auto-fill failed.';
        this.fillProgressText.textContent = `Error: ${errorDetail}`;
        this.fillProgressText.className = 'status-error';
        this.showErrorMessage(errorDetail + (response.partialSuccess ? " Some fields may have been filled." : ""));
        this.updateOverallStatus('Auto-fill Error', 'error');
      }
    } catch (error) {
      this.fillProgressText.textContent = `Error: ${error.message}`;
      this.fillProgressText.className = 'status-error';
      this.showErrorMessage('Error initiating auto-fill: ' + error.message);
      this.updateOverallStatus('Auto-fill Error', 'error');
    }
  }

  async logApplicationAttempt(url, pageTitle) {
    let jobTitle = pageTitle;
    let companyName = "Unknown";

    if (pageTitle) {
        const patterns = [
            /(.+)\s(?:at|@|-|\|)\s(.+)\s(?:-|\||via)?\s*(LinkedIn|Indeed|Glassdoor|Myworkdayjobs|Greenhouse|Lever|Taleo|SmartRecruiters|Jobvite|Dice)/i,
            /(.+)\s(?:at|@|-|\|)\s([^-\|]+)/i, // Simpler Job Title at Company
            /(.+)/i // Just the title if no clear company
        ];
        for (const regex of patterns) {
            const match = pageTitle.match(regex);
            if (match) {
                jobTitle = match[1] ? match[1].trim() : pageTitle;
                if (match[2] && !/LinkedIn|Indeed|Glassdoor|Myworkdayjobs|Greenhouse|Lever|Taleo|SmartRecruiters|Jobvite|Dice/i.test(match[2])) {
                    companyName = match[2].trim();
                } else if (match[3] && match[2] && !/LinkedIn|Indeed|Glassdoor|Myworkdayjobs|Greenhouse|Lever|Taleo|SmartRecruiters|Jobvite|Dice/i.test(match[2])) {
                     companyName = match[2].trim(); // If platform name is third, second is company
                }
                break;
            }
        }
        if (companyName === "Unknown") { // Fallback for company if not parsed well
            try { companyName = new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch { /* ignore */ }
        }
    } else {
        jobTitle = "Application";
        try { companyName = new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch { /* ignore */ }
    }
    jobTitle = jobTitle.replace(/careers|jobs|vacancies|hiring/gi, '').trim();
    if (jobTitle.length > 70) jobTitle = jobTitle.substring(0, 67) + "..."; // Truncate long titles

    const applicationData = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      jobTitle: jobTitle || "N/A",
      company: companyName || "N/A",
      url: url,
      appliedDate: new Date().toISOString(),
      status: 'Attempted'
    };
    await chrome.runtime.sendMessage({ action: 'LOG_APPLICATION', data: applicationData });
    await this.loadApplications(); // Refresh history
  }

  async loadApplications() {
    const historyListDiv = document.getElementById('application-history-list');
    if (!historyListDiv) return;

    historyListDiv.innerHTML = '<p>Loading history...</p>';
    const response = await chrome.runtime.sendMessage({ action: 'GET_APPLICATIONS' });

    if (response && response.success) {
        const applications = response.applications;
        if (applications && applications.length > 0) {
          historyListDiv.innerHTML = '';
          const ul = document.createElement('ul');
          applications.forEach(app => {
            const li = document.createElement('li');
            li.innerHTML = `
              <strong>${app.jobTitle}</strong> at ${app.company}<br>
              <a href="${app.url}" target="_blank" title="${app.url}">Applied: ${new Date(app.appliedDate).toLocaleDateString()}</a>
              <em>Status: ${app.status}</em>
            `;
            ul.appendChild(li);
          });
          historyListDiv.appendChild(ul);
        } else {
          historyListDiv.innerHTML = '<p>No applications logged yet.</p>';
        }
    } else {
        historyListDiv.innerHTML = `<p class="error-message">Error loading history: ${response.error || "Unknown error"}</p>`;
    }
  }

  async clearApplicationHistory() {
    if (!confirm("Are you sure you want to clear all application history? This cannot be undone.")) {
      return;
    }
    this.updateOverallStatus('Clearing History...', 'processing');
    const response = await chrome.runtime.sendMessage({ action: 'SAVE_APPLICATIONS_OVERWRITE', data: [] });
    if (response && response.success) {
        this.showSuccessMessage("Application history cleared.");
        this.updateOverallStatus('History Cleared', 'success');
    } else {
        this.showErrorMessage("Failed to clear history: " + (response.error || "Unknown error"));
        this.updateOverallStatus('Clear Error', 'error');
    }
    await this.loadApplications(); // Refresh list
  }

  async testCurrentPage() {
    this.fillProgressText.textContent = 'Testing current page...';
    this.fillProgressText.className = 'status-processing';
    this.updateOverallStatus('Testing Page...', 'processing');
    const detectionResultDiv = document.getElementById('detection-result-content');
    detectionResultDiv.innerHTML = '<p>Testing...</p>';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url || (!tab.url.startsWith('http:') && !tab.url.startsWith('https:'))) {
        throw new Error("Cannot test this page. Navigate to a job application.");
      }
      const results = await chrome.runtime.sendMessage({ action: 'TEST_PLATFORM' }); // Background handles tabId now

      if (results && !results.error) {
        let htmlResult = `
          <p><strong>Platform:</strong> ${results.platform || 'N/A'}</p>
          <h4>Form Analysis:</h4>
          <p>Forms: ${results.formAnalysis ? results.formAnalysis.formCount : 'N/A'}, Visible Inputs: ${results.formAnalysis ? results.formAnalysis.visibleInputs : 'N/A'}</p>
          Field Types: <ul>${results.formAnalysis && results.formAnalysis.fieldTypes ? Object.entries(results.formAnalysis.fieldTypes).map(([type, count]) => `<li>${type}: ${count}</li>`).join('') : '<li>N/A</li>'}</ul>
          <h4>Challenges:</h4>
          ${(results.challenges && results.challenges.length > 0) ? `<ul>${results.challenges.map(c => `<li>${c}</li>`).join('')}</ul>` : '<p>None identified.</p>'}
        `;
        detectionResultDiv.innerHTML = htmlResult;
        this.fillProgressText.textContent = 'Test complete.';
        this.fillProgressText.className = 'status-idle';
        this.updateOverallStatus('Test Complete', 'success');
      } else {
        const errorMsg = results ? results.error : 'Unknown test error.';
        detectionResultDiv.innerHTML = `<p class="error-message">Test Error: ${errorMsg}</p>`;
        this.fillProgressText.textContent = 'Test failed.';
        this.fillProgressText.className = 'status-error';
        this.updateOverallStatus('Test Error', 'error');
      }
    } catch (error) {
      detectionResultDiv.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
      this.fillProgressText.textContent = 'Test error.';
      this.fillProgressText.className = 'status-error';
      this.updateOverallStatus('Test Error', 'error');
    }
  }

  showProcessingMessage(message) {
    if (this.fillProgressText) {
        if (message) {
            this.fillProgressText.textContent = message;
            this.fillProgressText.className = 'status-processing';
        } else { // Clear
            this.fillProgressText.textContent = 'Status: Idle';
            this.fillProgressText.className = 'status-idle';
        }
    }
  }

  showMessage(message, type = 'info', duration = 4000) {
    if (!this.messagesContainer) return;
    // Clear previous messages of the same type or all for simplicity
    Array.from(this.messagesContainer.children).forEach(child => {
        if(child.classList.contains(type) || this.messagesContainer.children.length > 2) child.remove();
    });

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    this.messagesContainer.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => messageDiv.remove(), 300);
    }, duration);
  }
  showSuccessMessage(message) { this.showMessage(message, 'success'); }
  showErrorMessage(message) { this.showMessage(message, 'error', 6000); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new EnhancedPopupController());
} else {
  new EnhancedPopupController();
}
