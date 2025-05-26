// Enhanced background.js with better file handling and application logging
class EnhancedJobAutomator {
  constructor() {
    this.init();
    this.fileCache = new Map(); // Simple cache for files being processed in a session
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Indicates that the response will be sent asynchronously
    });

    chrome.webNavigation.onCompleted.addListener((details) => {
      // Inject iframe handler on main frame completion
      if (details.frameId === 0) { // 0 is the main frame
        this.injectIframeHandler(details.tabId);
      }
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'AUTO_FILL':
          const fillResult = await this.enhancedAutoFill(sender.tab.id, request.data, request.options);
          sendResponse(fillResult);
          break;
        case 'UPLOAD_FILE_TO_CACHE': // Renamed for clarity
          const fileInfo = await this.processFileUpload(request.file);
          sendResponse({ success: true, fileInfo });
          break;
        case 'GET_PROFILE':
          const profile = await SecureStorage.loadSecure('userProfile');
          sendResponse(profile || {});
          break;
        case 'SAVE_PROFILE':
          await SecureStorage.saveSecure('userProfile', request.data);
          // Clear file cache after profile save as file data is now part of the profile
          this.fileCache.clear();
          sendResponse({ success: true, message: "Profile saved successfully!" });
          break;
        case 'TEST_PLATFORM':
          const platformInfo = await this.testPlatformCompatibility(sender.tab.id);
          sendResponse(platformInfo);
          break;
        case 'LOG_APPLICATION':
          await this.logApplication(request.data);
          sendResponse({ success: true });
          break;
        case 'GET_APPLICATIONS':
          const applications = await SecureStorage.loadSecure('jobApplications');
          sendResponse(applications || []);
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[JobAuto BG] Error:', error.message, error.stack);
      sendResponse({ success: false, error: error.message });
    }
  }

  async processFileUpload(fileObject) {
    // We receive a simple object, not a File instance directly from content script
    // For simplicity, we'll assume fileObject contains {name, type, size, base64Data}
    // In a real scenario, if sending File objects from popup, it's different.
    // Here, we assume the base64 conversion happens in popup.js before sending.
    const fileId = this.generateFileId();
    const fileData = {
      id: fileId,
      name: fileObject.name,
      type: fileObject.type,
      size: fileObject.size,
      data: fileObject.base64Data, // This is the base64 string
      uploadDate: new Date().toISOString()
    };
    this.fileCache.set(fileId, fileData); // Cache for potential use during autofill
    // No need to SecureStorage.saveSecure here for files if they are part of the profile
    // The popup will include this base64 data in the profile object when saving.
    return { fileId, name: fileData.name, type: fileData.type, size: fileData.size };
  }


  async enhancedAutoFill(tabId, profileData, fillOptions) {
    console.log('Starting Enhanced Auto Fill with options:', fillOptions);
    const phases = [];
    if (fillOptions.fillBasic) phases.push('basic_info');
    if (fillOptions.fillContact) phases.push('contact_details');
    if (fillOptions.fillProfessional) phases.push('professional_info');
    if (fillOptions.uploadFiles) phases.push('file_uploads');
    if (fillOptions.handleConsent) phases.push('consent_handling');
    phases.push('validation_check'); // Always run validation

    let allPhasesSuccess = true;
    let errors = [];

    for (const phase of phases) {
      try {
        console.log(`Executing phase: ${phase}`);
        const results = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true }, // Consider if allFrames is always needed or per-phase
          func: this.dispatchFillPhase, // Changed to avoid self-injection issues
          args: [profileData, phase]
        });

        // Check results from all frames; if any frame failed, consider phase failed.
        if (results.some(result => result.result && result.result.success === false)) {
            allPhasesSuccess = false;
            const phaseError = results.find(r => r.result && r.result.error)?.result?.error || `Phase ${phase} failed in one or more frames.`;
            errors.push(phaseError);
            console.warn(`Phase ${phase} failed:`, phaseError);
            // Decide if we should stop on first error or collect all errors
            // break; // Uncomment to stop on first phase error
        }
        await this.delay(1000); // Reduced delay slightly, adjust as needed
      } catch (e) {
        allPhasesSuccess = false;
        errors.push(`Error during phase ${phase}: ${e.message}`);
        console.error(`Error during phase ${phase}:`, e);
        break; // Stop on critical script execution error
      }
    }
    if (allPhasesSuccess) {
        return { success: true, message: "Autofill completed." };
    } else {
        return { success: false, error: `Autofill encountered issues: ${errors.join('; ')}` };
    }
  }

  // This function is intended to be executed in the content script's context
  dispatchFillPhase(profile, phase) {
    // Ensure the global filling functions are available (e.g., from injected.js)
    try {
        if (phase === 'basic_info' && window.jobAutoFillBasicInfo) window.jobAutoFillBasicInfo(profile);
        else if (phase === 'contact_details' && window.jobAutoFillContact) window.jobAutoFillContact(profile);
        else if (phase === 'professional_info' && window.jobAutoFillProfessional) window.jobAutoFillProfessional(profile);
        else if (phase === 'file_uploads' && window.jobAutoHandleFileUploads) window.jobAutoHandleFileUploads(profile);
        else if (phase === 'consent_handling' && window.jobAutoHandleConsentCheckboxes) window.jobAutoHandleConsentCheckboxes();
        else if (phase === 'validation_check' && window.jobAutoValidateAndCleanup) window.jobAutoValidateAndCleanup(profile);
        else {
            // console.warn(`No handler for phase: ${phase} or handler not found in this frame.`);
            return { success: true, message: `No specific action for phase ${phase} in this frame or handler missing.` }; // Not a failure if not applicable
        }
        return { success: true };
    } catch (e) {
        console.error(`Error executing phase ${phase} in content script:`, e);
        return { success: false, error: `Error in phase ${phase}: ${e.message}`};
    }
  }


  async testPlatformCompatibility(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId, allFrames: false }, // Typically run on main frame for platform detection
            func: () => { // This function is executed in the content script context
            return {
                platform: typeof window.jobAutoDetectPlatform === 'function' ? window.jobAutoDetectPlatform() : 'Detection function not found',
                formAnalysis: typeof window.jobAutoAnalyzeForm === 'function' ? window.jobAutoAnalyzeForm() : 'Analysis function not found',
                challenges: typeof window.jobAutoIdentifyChallenges === 'function' ? window.jobAutoIdentifyChallenges() : 'Challenge identification function not found'
            };
            }
        });
        return results[0]?.result || { error: 'Failed to execute platform compatibility test.' };
    } catch (e) {
        console.error('Error in testPlatformCompatibility:', e);
        return { error: e.message };
    }
  }

  async injectIframeHandler(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true }, // Inject into all frames
        files: ['iframe-handler.js']
      });
    } catch (e) {
      // console.warn(`Could not inject iframe-handler into tab ${tabId} (perhaps a restricted page): ${e.message}`);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateFileId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  async logApplication(applicationData) {
    let applications = await SecureStorage.loadSecure('jobApplications') || [];
    applications.unshift(applicationData); // Add to the beginning of the list
    if (applications.length > 100) { // Limit history size
        applications = applications.slice(0, 100);
    }
    await SecureStorage.saveSecure('jobApplications', applications);
  }
}

new EnhancedJobAutomator();
