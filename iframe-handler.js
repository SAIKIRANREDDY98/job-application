// iframe-handler.js - Handle cross-origin iframe challenges
(function() {
  'use strict';

  // This script attempts to handle iframes, particularly for sites like LinkedIn.
  // Direct DOM manipulation across cross-origin iframes is not possible.
  // Communication relies on postMessage or by injecting scripts if same-origin.

  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // Likely cross-origin
    }
  }

  if (isInIframe()) {
    // console.log('[JobAuto IframeHandler] Script loaded in an iframe:', window.location.href);

    // Listen for messages from the parent frame (e.g., the extension's content script in the top frame)
    window.addEventListener('message', (event) => {
      // IMPORTANT: Always verify event.origin for security
      // For this example, we might expect messages from the extension itself or known job platform domains
      // if (event.origin !== 'expected_origin_here' && !event.origin.startsWith('chrome-extension://')) return;

      const { type, profile, phase } = event.data;

      if (type === 'JOB_AUTO_FILL_IFRAME') {
        // console.log('[JobAuto IframeHandler] Received FILL_IFRAME message with phase:', phase, 'Profile keys:', profile ? Object.keys(profile) : 'No profile');
        // Call the appropriate filling functions from injected.js if they are available in this iframe's context
        // This assumes injected.js has also been loaded into this iframe.
        try {
            if (phase === 'basic_info' && typeof window.jobAutoFillBasicInfo === 'function') window.jobAutoFillBasicInfo(profile);
            else if (phase === 'contact_details' && typeof window.jobAutoFillContact === 'function') window.jobAutoFillContact(profile);
            else if (phase === 'professional_info' && typeof window.jobAutoFillProfessional === 'function') window.jobAutoFillProfessional(profile);
            else if (phase === 'file_uploads' && typeof window.jobAutoHandleFileUploads === 'function') window.jobAutoHandleFileUploads(profile);
            else if (phase === 'consent_handling' && typeof window.jobAutoHandleConsentCheckboxes === 'function') window.jobAutoHandleConsentCheckboxes();
            else if (phase === 'validation_check' && typeof window.jobAutoValidateAndCleanup === 'function') window.jobAutoValidateAndCleanup(profile);
            // Send a response back if needed
            // event.source.postMessage({ type: 'JOB_AUTO_IFRAME_FILLED', phase: phase, success: true }, event.origin);
        } catch (e) {
            console.error(`[JobAuto IframeHandler] Error during phase ${phase} in iframe:`, e);
            // event.source.postMessage({ type: 'JOB_AUTO_IFRAME_FILLED', phase: phase, success: false, error: e.message }, event.origin);
        }
      }
    });

    // Announce that the iframe is ready to receive commands (optional)
    // This requires the parent frame to listen for this.
    // window.parent.postMessage({ type: 'JOB_AUTO_IFRAME_READY', href: window.location.href }, '*'); // Use specific target origin in production
  }


  // The following is for the main content script to interact with iframes it finds.
  // This part would typically be in content.js or background.js orchestrating iframe interaction.
  // For simplicity, keeping some iframe detection logic here if this script is also injected into the top frame.

  if (!isInIframe()) { // Only run this part in the top frame
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME') {
            const iframe = node;
            // console.log('[JobAuto IframeHandler] Detected new iframe:', iframe.src || iframe.id);
            // For same-origin iframes, you could inject scripts.
            // For cross-origin, you must use postMessage IF the iframe is expecting messages.
            // This example doesn't automatically send messages TO new iframes without a profile.
            // The main autofill process in background.js using `allFrames: true` for executeScript
            // is the primary way `injected.js` gets into iframes. This handler script here
            // is more for specialized iframe communication if needed.
          }
        });
      });
    });

    // Start observing the body for added iframes when the document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        observer.observe(document.body, { childList: true, subtree: true });
    }
  }

})();
