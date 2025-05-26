// Enhanced injected.js with select handling and placeholders
(function() {
  'use strict';

  function jobAutoTriggerEvents(element) {
    // Fire events in sequence that ATS systems expect
    const events = ['focus', 'input', 'change', 'blur', 'keyup']; // Added focus and keyup
    events.forEach((eventType, index) => {
      setTimeout(() => {
        element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
      }, index * 50); // Reduced delay slightly
    });
  }

  function jobAutoFillFieldWithValidation(element, value) {
    if (!element || typeof value === 'undefined' || value === null) return false;
    if (element.disabled || element.readOnly) return false;

    // Store original value for comparison if needed, e.g., for validation check phase
    // element.dataset.originalValue = element.value;

    element.focus();
    element.value = ''; // Clear existing value first
    element.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input for clearing

    // Simulate typing for some frameworks
    // value.split('').forEach((char, i) => {
    //   setTimeout(() => {
    //     element.value += char;
    //     element.dispatchEvent(new Event('input', { bubbles: true }));
    //   }, i * 10);
    // });
    // Using direct set for now for speed, can be augmented with typing simulation if needed
    element.value = value;

    jobAutoTriggerEvents(element);
    return true;
  }

  function jobAutoSelectDropdownOption(selectElement, valueToMatch) {
    if (!selectElement || typeof valueToMatch === 'undefined' || valueToMatch === null) return false;
    if (selectElement.disabled) return false;

    const options = Array.from(selectElement.options);
    let matchedOption = options.find(option => option.text.trim().toLowerCase() === valueToMatch.trim().toLowerCase() || option.value.toLowerCase() === valueToMatch.toLowerCase());

    if (!matchedOption) { // Attempt partial match if no exact match
        matchedOption = options.find(option => option.text.trim().toLowerCase().includes(valueToMatch.trim().toLowerCase()));
    }

    if (matchedOption) {
      selectElement.value = matchedOption.value;
      jobAutoTriggerEvents(selectElement);
      // console.log(`[JobAuto] Selected '${matchedOption.text}' in dropdown ${selectElement.name || selectElement.id}`);
      return true;
    } else {
      // console.warn(`[JobAuto] Could not find option matching '${valueToMatch}' in dropdown ${selectElement.name || selectElement.id}`);
      return false;
    }
  }


  window.jobAutoFillBasicInfo = function(profile) {
    const basicFields = [
      { selectors: ['input[name*="first"]', '#firstName', '[data-automation-id*="firstName"]', 'input[autocomplete*="given-name"]'], value: profile.firstName },
      { selectors: ['input[name*="last"]', '#lastName', '[data-automation-id*="lastName"]', 'input[autocomplete*="family-name"]'], value: profile.lastName },
      { selectors: ['input[name*="full"]', '#fullName', 'input[autocomplete*="name"]'], value: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() }
    ];
    basicFields.forEach(field => {
      if (!field.value) return;
      field.selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (el && (el.value === '' || el.value !== field.value)) jobAutoFillFieldWithValidation(el, field.value);
        });
      });
    });
  };

  window.jobAutoFillContact = function(profile) {
    const contactFields = [
      { selectors: ['input[type="email"]', '#email', '[data-automation-id*="email"]', 'input[autocomplete*="email"]'], value: profile.email },
      { selectors: ['input[type="tel"]', '#phone', '[data-automation-id*="phone"]', 'input[autocomplete*="tel"]'], value: profile.phone },
      { selectors: ['input[name*="linkedin"]', '#linkedin', 'input[autocomplete*="url"]'], value: profile.linkedIn, contextKeywords: ['linkedin'] }, // Added context for better targeting
      { selectors: ['input[name*="location"]', '#location', 'input[autocomplete*="address-level2"]'], value: profile.location, contextKeywords: ['location', 'city'] }
    ];
    contactFields.forEach(field => {
      if (!field.value) return;
      field.selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          // If contextKeywords are provided, check if the element context matches
          if (field.contextKeywords) {
            const context = jobAutoGetInputContext(el).toLowerCase();
            if (!field.contextKeywords.some(kw => context.includes(kw))) return; // Skip if context doesn't match
          }
          if (el && (el.value === '' || el.value !== field.value)) jobAutoFillFieldWithValidation(el, field.value);
        });
      });
    });
  };

  window.jobAutoFillProfessional = function(profile) {
    const professionalFields = [
      { selectors: ['input[name*="company"]', '#currentCompany', 'input[autocomplete*="organization"]'], value: profile.currentCompany, contextKeywords: ['company', 'employer'] },
      { selectors: ['input[name*="title"]', '#currentTitle', 'input[autocomplete*="organization-title"]'], value: profile.currentTitle, contextKeywords: ['title', 'role'] },
      { selectors: ['textarea[name*="summary"]', '#summary', '#objective'], value: profile.summary },
      // Example for a select dropdown (Years of Experience)
      {
        selectors: ['select[name*="experience"]', 'select[id*="experience"]', 'select[data-automation-id*="experience"]'],
        value: profile.experience, // Expects a string like "5" or "5-10 years"
        type: 'select',
        contextKeywords: ['experience', 'years']
      },
       // Example for salary (can be input or select)
      {
        selectors: ['input[name*="salary"]', '#desiredSalary', 'input[data-automation-id*="salary"]'],
        value: profile.salary,
        contextKeywords: ['salary', 'compensation', 'pay']
      },
      {
        selectors: ['select[name*="salary"]', 'select[id*="salary"]', 'select[data-automation-id*="salary"]'],
        value: profile.salary, // e.g., "70000" or "70k-80k"
        type: 'select',
        contextKeywords: ['salary', 'compensation', 'pay']
      }
    ];

    professionalFields.forEach(field => {
      if (!field.value) return;
      field.selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
           if (field.contextKeywords) {
            const context = jobAutoGetInputContext(el).toLowerCase();
            if (!field.contextKeywords.some(kw => context.includes(kw))) return;
          }

          if (el.tagName.toLowerCase() === 'select' && field.type === 'select') {
            jobAutoSelectDropdownOption(el, field.value.toString());
          } else if (el.tagName.toLowerCase() !== 'select') { // Ensure it's not a select if no type specified
            if (el && (el.value === '' || el.value !== field.value)) jobAutoFillFieldWithValidation(el, field.value);
          }
        });
      });
    });
  };

  window.jobAutoHandleFileUploads = function(profile) {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(async (input) => {
      if (input.disabled || input.offsetParent === null) return; // Skip hidden or disabled

      const fieldType = jobAutoDetectFileFieldType(input);
      let fileDataToUpload = null;

      if (fieldType === 'resume' && profile.resumeFileData && profile.resumeFileData.data) {
        fileDataToUpload = profile.resumeFileData;
      } else if (fieldType === 'cover_letter' && profile.coverLetterFileData && profile.coverLetterFileData.data) {
        fileDataToUpload = profile.coverLetterFileData;
      }
      // Add more types like 'portfolio', 'transcript' if needed

      if (fileDataToUpload) {
        // console.log(`[JobAuto] Attempting to upload ${fileDataToUpload.name} to ${input.id || input.name}`);
        await jobAutoUploadFile(input, fileDataToUpload);
      }
    });
  };

  function jobAutoDetectFileFieldType(input) {
    const context = jobAutoGetInputContext(input).toLowerCase();
    if (context.includes('resume') || context.includes('cv')) return 'resume';
    if (context.includes('cover letter') || context.includes('covering letter')) return 'cover_letter';
    if (context.includes('portfolio')) return 'portfolio';
    if (context.includes('transcript')) return 'transcript';
    // Add more specific keywords
    return 'unknown';
  }

  function jobAutoGetInputContext(element) {
    let context = (element.id || '') + ' ' + (element.name || '') + ' ' + (element.placeholder || '') + ' ' + (element.ariaLabel || '');
    const label = element.labels && element.labels.length > 0 ? element.labels[0] : document.querySelector(`label[for="${element.id}"]`);
    if (label) context += ' ' + label.textContent;

    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) { // Check a few levels up for contextual text
      // Avoid overly broad containers
      if (parent.classList.contains('form-group') || parent.classList.contains('field') || parent.classList.contains('form-field')) {
         const parentLabels = parent.querySelectorAll('label, .label, .title, h1,h2,h3,h4,span'); // More generic selectors for text
         parentLabels.forEach(pl => {
            if (pl.offsetParent !== null && pl.textContent.length < 100) { // visible and not too long
                 context += ' ' + pl.textContent;
            }
         });
      }
      parent = parent.parentElement;
      depth++;
    }
    return context.replace(/\s+/g, ' ').trim(); // Normalize spaces
  }

  async function jobAutoUploadFile(inputElement, fileData) {
    try {
      if (!fileData || !fileData.data || !fileData.name || !fileData.type) {
        console.warn('[JobAuto] Invalid fileData for upload:', fileData);
        return;
      }
      const response = await fetch(fileData.data); // fileData.data is base64 string
      const blob = await response.blob();
      const file = new File([blob], fileData.name, { type: fileData.type });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputElement.files = dataTransfer.files;

      jobAutoTriggerEvents(inputElement);
      // console.log(`[JobAuto] File ${file.name} attached to ${inputElement.id || inputElement.name}`);

      // Some platforms might have specific additional handling (e.g. Workday sometimes has a separate upload button to click)
      // This would require more specific platform logic
    } catch (error) {
      console.error('[JobAuto] File upload error:', error, 'for input:', inputElement, 'with fileData:', fileData.name);
    }
  }

  window.jobAutoValidateAndCleanup = function(profile) {
    jobAutoWaitForResumeProcessing(() => {
      // Re-fill critical fields that might be overwritten by ATS resume parsing
      // console.log('[JobAuto] Running validation and cleanup phase.');
      const criticalFieldsData = [
        { selectors: ['input[type="email"]', '#email'], value: profile.email },
        { selectors: ['input[type="tel"]', '#phone'], value: profile.phone },
        { selectors: ['input[name*="first"]', '#firstName'], value: profile.firstName },
        { selectors: ['input[name*="last"]', '#lastName'], value: profile.lastName }
      ];

      criticalFieldsData.forEach(field => {
        if (!field.value) return;
        field.selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (el && el.value !== field.value && el.offsetParent !== null) { // Check if visible
              // console.log(`[JobAuto] Correcting field ${el.id || el.name} from '${el.value}' to '${field.value}'`);
              jobAutoFillFieldWithValidation(el, field.value);
            }
          });
        });
      });
    });
    // TODO: Add logic for "Next" / "Continue" buttons if this is the last step on the current page.
    // This is highly complex and site-specific. Example:
    // const nextButtonSelectors = ['button[type="submit"]', 'button[id*="next"]', 'button[class*="next"]', 'input[value*="Continue"]'];
    // let foundNextButton = null;
    // for (let selector of nextButtonSelectors) {
    //   document.querySelectorAll(selector).forEach(btn => {
    //     const btnText = (btn.innerText || btn.value || '').toLowerCase();
    //     if ((btnText.includes('next') || btnText.includes('continue') || btnText.includes('save and continue')) && btn.offsetParent !== null) {
    //       if (!btnText.includes('previous')) { // Avoid "Previous" buttons
    //            foundNextButton = btn;
    //       }
    //     }
    //   });
    //   if (foundNextButton) break;
    // }
    // if (foundNextButton) {
    //    console.log('[JobAuto] Identified potential Next/Continue button:', foundNextButton);
    //    // In a real scenario, you might send a message back to background to confirm before clicking,
    //    // or have a setting to enable auto-progression.
    //    // foundNextButton.click();
    // }

    // TODO: Add logic to detect CAPTCHAs.
    // This is also very complex and might involve checking for common CAPTCHA service iframes/scripts.
    // Example:
    // const captchaSelectors = ['iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]', 'div.g-recaptcha', 'div.h-captcha'];
    // let captchaDetected = false;
    // captchaSelectors.forEach(selector => {
    //    if (document.querySelector(selector)) captchaDetected = true;
    // });
    // if (captchaDetected) {
    //    console.warn('[JobAuto] CAPTCHA detected on page. Halting automation for this page.');
    //    // Send message to background/popup to inform user.
    // }
  };

  function jobAutoWaitForResumeProcessing(callback, maxWait = 7000, checkInterval = 500) { // Reduced maxWait
    const startTime = Date.now();
    const checkProcessing = () => {
      const processingIndicators = [
        '.loading', '.spinner', '.processing', '[aria-busy="true"]',
        '[data-automation-id*="spinner"]', '[class*="loading"]', '[class*="Spinner"]'
      ];
      const isProcessing = processingIndicators.some(selector => {
        const el = document.querySelector(selector);
        return el && el.offsetParent !== null; // Check if visible
      });

      if (!isProcessing || (Date.now() - startTime > maxWait)) {
        // console.log(isProcessing ? '[JobAuto] Max wait time exceeded for resume processing.' : '[JobAuto] No processing indicators found.');
        callback();
      } else {
        // console.log('[JobAuto] Waiting for resume processing/page load...');
        setTimeout(checkProcessing, checkInterval);
      }
    };
    checkProcessing();
  }

  window.jobAutoHandleConsentCheckboxes = function() {
    const consentSelectors = [
      'input[type="checkbox"][required]',
      'input[type="checkbox"][name*="consent"]',
      'input[type="checkbox"][name*="agree"]',
      'input[type="checkbox"][id*="terms"]',
      'input[type="checkbox"][id*="privacy"]'
    ];
    consentSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(checkbox => {
        if (!checkbox.checked && checkbox.offsetParent !== null && !checkbox.disabled) { // Check if visible and not disabled
          const context = jobAutoGetInputContext(checkbox).toLowerCase();
          const consentKeywords = [
            'agree', 'consent', 'terms', 'privacy', 'policy', 'acknowledge',
            'accept', 'authorize', 'confirm', 'understand', 'read'
            // EEO keywords (be careful with these, ensure user opt-in for EEO)
            // 'race', 'ethnicity', 'gender', 'disability', 'veteran'
          ];
          // Avoid checking boxes that are clearly opt-out, e.g., "do not sell my data"
          const optOutKeywords = ['do not sell', 'opt out', 'unsubscribe'];

          if (consentKeywords.some(keyword => context.includes(keyword)) &&
              !optOutKeywords.some(optOutKeyword => context.includes(optOutKeyword))) {
            checkbox.checked = true;
            jobAutoTriggerEvents(checkbox);
            // console.log(`[JobAuto] Checked consent checkbox: ${checkbox.id || checkbox.name} with context: "${context}"`);
          }
        }
      });
    });
  };

  // Platform detection and analysis (fairly similar to original)
  window.jobAutoDetectPlatform = function() {
    const url = window.location.href.toLowerCase();
    const html = document.documentElement.outerHTML.toLowerCase().substring(0, 20000); // Limit HTML size for performance

    // More specific patterns
    if (url.includes('myworkdayjobs.com') || document.querySelector('[data-automation-id*="workday"]')) return 'Workday';
    if (url.includes('greenhouse.io') || document.querySelector('#greenhouse_application_form')) return 'Greenhouse';
    if (url.includes('lever.co') || document.querySelector('.lever-job-title')) return 'Lever';
    if (url.includes('linkedin.com/jobs/view') || url.includes('linkedin.com/jobs/collections')) return 'LinkedIn';
    if (url.includes('taleo.net') || document.querySelector('form[name="TaleoForm"]')) return 'Taleo';
    if (url.includes('smartrecruiters.com') || document.querySelector('.js-job-ad-container')) return 'SmartRecruiters';
    if (url.includes('icims.com') || document.querySelector('div[data-id="icims-container"]')) return 'iCIMS';
    if (url.includes('jobvite.com') || document.querySelector('div.jvResponseMessage')) return 'Jobvite';
    if (url.includes('ashbyhq.com')) return 'AshbyHQ';
    if (url.includes('bamboohr.com/jobs')) return 'BambooHR';
    // Generic indicators
    if (html.includes('workday')) return 'Workday (heuristic)';
    if (html.includes('greenhouse')) return 'Greenhouse (heuristic)';
    if (html.includes('lever-')) return 'Lever (heuristic)';

    return 'Unknown/Custom';
  };

  window.jobAutoAnalyzeForm = function() {
    const forms = document.querySelectorAll('form');
    const analysis = {
      formCount: forms.length,
      fieldTypes: {},
      visibleInputs: 0,
      actionTargets: []
    };
    forms.forEach((form, index) => {
        if (form.action) analysis.actionTargets.push(new URL(form.action, window.location.href).hostname);
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.offsetParent !== null) { // Check if visible
                analysis.visibleInputs++;
                const type = input.type ? input.type.toLowerCase() : input.tagName.toLowerCase();
                analysis.fieldTypes[type] = (analysis.fieldTypes[type] || 0) + 1;
            }
        });
    });
    return analysis;
  };

  window.jobAutoIdentifyChallenges = function() {
    const challenges = [];
    if (document.querySelectorAll('iframe').length > 0) challenges.push('IFrames Present');
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) challenges.push('CSP Likely Active');
    if (document.querySelectorAll('.loading, .spinner, [aria-busy="true"]').length > 0) challenges.push('Dynamic Content Indicators');
    if (document.querySelector('input[type="file"][accept*="pdf"]') && !document.querySelector('input[type="file"][accept*="doc"]')) challenges.push('Potential PDF-only Uploads');
    if (document.querySelector('div.g-recaptcha') || document.querySelector('div.h-captcha') || document.querySelector('iframe[src*="recaptcha"]')) challenges.push('CAPTCHA Detected');
    return challenges;
  };

  // Initial check or message to confirm injected.js is loaded
  // console.log('[JobAuto Injected] Script loaded and running.');
})();
