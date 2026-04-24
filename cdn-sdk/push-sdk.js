// Beacon SDK 1.5.4
(function (window) {
  'use strict';

  // Get current script tag's URL to determine the base URL
  const getBaseUrl = () => {
    const scripts = document.getElementsByTagName('script');
    const currentScript = scripts[scripts.length - 1];
    const src = currentScript.src;

    // Extract base URL from script tag (e.g., https://your-domain.com from https://your-domain.com/cdn-sdk/push-sdk.js)
    const urlParts = src.split('/');
    const protocol = urlParts[0];
    const host = urlParts[2];
    return `${protocol}//${host}`;
  };

  // Beacon class definition
  class BeaconClass {
    constructor() {
      this._swRegistration = null;
      this._pushSubscription = null;
      this._websiteId = null;
      this._apiUrl = null;
      this._serviceWorkerPath = null;
      this._serviceWorkerScope = null;
      this._autoRegister = false;
      this._promptConfig = null;
      this._apiKey = null;
      this._autoResubscribe = false;
      this._promptShown = false;
      this._promptElement = null;
      this._onPromptRejected = null;
      this._promptRejectionTimeout = 10 * 60 * 1000; // 10 minutes in milliseconds
      this._resizeObserver = null;
      this._cachedVapidKey = null;
    }

    init(options) {
      console.log('Beacon SDK Initialized - Version 1.5.0');

      if (!options.websiteId) {
        console.error('Beacon: websiteId is required');
        return;
      }

      this._websiteId = options.websiteId;
      // Use provided API URL, or determine it from the script URL, or use default
      this._apiUrl = options.apiUrl || getBaseUrl() || '';
      this._serviceWorkerPath = options.serviceWorkerPath || '/service-worker.js';
      this._serviceWorkerScope = options.serviceWorkerScope || '/';

      this._registrationMode = options.registrationMode || (options.autoRegister ? 'auto' : 'manual');
      this._registrationDelay = options.registrationDelay || 0;
      this._customSegments = options.customSegments || {};

      this._apiKey = options.apiKey || null;
      this._autoResubscribe = options.autoResubscribe || false;
      this._onPromptRejected = options.onPromptRejected || null;

      // Check if service workers are supported
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        // Pre-fetch VAPID key to ensure user gesture is preserved during subscription
        this._prefetchVapidKey();

        // Fetch the prompt configuration from the server
        this._fetchPromptConfig().then(() => {
          if (this._registrationMode === 'auto') {
            this.registerServiceWorker().then(() => {
              this.getSubscriptionStatus().then(status => {
                if (!status.isSubscribed) {
                  // Check if we should auto resubscribe
                  if (this._autoResubscribe && this._wasSubscribedBefore()) {
                    console.log('Beacon: Auto resubscribing user');
                    setTimeout(() => {
                      this.subscribe(true).catch(error => {
                        console.error('Beacon: Auto resubscribe failed:', error);
                        // Show prompt as fallback if auto resubscribe fails
                        this._showPrompt();
                      });
                    }, this._registrationDelay);
                  } else {
                    // Show prompt based on server configuration with potential delay
                    setTimeout(() => {
                      this._showPrompt();
                    }, this._registrationDelay);
                  }
                }
              });
            });
          }
        });
      } else {
        console.warn('Beacon: Push notifications are not supported in this browser');
      }
    }

    // Check if the user was subscribed before
    _wasSubscribedBefore() {
      try {
        const subscriptionStatus = localStorage.getItem(`beacon_subscription_${this._websiteId}`);
        return subscriptionStatus === 'subscribed';
      } catch (error) {
        console.error('Beacon: Error checking previous subscription status:', error);
        return false;
      }
    }

    // Store subscription status in localStorage
    _storeSubscriptionStatus(isSubscribed) {
      try {
        if (isSubscribed) {
          localStorage.setItem(`beacon_subscription_${this._websiteId}`, 'subscribed');
        } else {
          localStorage.setItem(`beacon_subscription_${this._websiteId}`, 'unsubscribed');
        }
      } catch (error) {
        console.error('Beacon: Error storing subscription status:', error);
      }
    }

    // Pre-fetch VAPID key
    async _prefetchVapidKey() {
      try {
        const headers = {};
        if (this._apiKey) {
          headers['X-API-Key'] = this._apiKey;
        }

        const response = await fetch(`${this._apiUrl}/vapidPublicKey`, {
          headers: headers
        });
        const data = await response.json();
        this._cachedVapidKey = data.publicKey;
      } catch (error) {
        console.error('Beacon: Failed to pre-fetch VAPID key:', error);
      }
    }

    // Fetch prompt configuration from the server
    async _fetchPromptConfig() {
      try {
        if (this._promptConfig) {
          return this._promptConfig;
        }

        const websiteId = this._websiteId;

        console.log(`Beacon: Fetching config for website ${websiteId} from ${this._apiUrl}`);

        // Try to get website-specific configuration
        const response = await fetch(`${this._apiUrl}/website/${websiteId}/config`, {
          mode: 'cors',
          credentials: 'omit',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch prompt configuration: ${response.status} ${response.statusText}`);
        }

        // Get the response text first to avoid JSON parsing errors
        const responseText = await response.text();

        // Only parse if we have a non-empty response
        if (responseText && responseText.trim()) {
          try {
            this._promptConfig = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Beacon: Error parsing prompt configuration:', parseError);
            throw new Error('Invalid JSON response from server');
          }
        } else {
          throw new Error('Empty response from server');
        }

        console.log('Beacon: Successfully fetched configuration');
        return this._promptConfig;
      } catch (error) {
        console.error('Beacon: Error fetching prompt configuration:', error);

        // Check for CORS errors
        if (error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('Network request failed')) {
          console.warn(`Beacon: Possible CORS issue when connecting to ${this._apiUrl}. Make sure the server allows cross-origin requests from this domain.`);
        }

        // Use default configuration if fetch fails
        this._promptConfig = {
          type: 'slide',
          text: 'Subscribe to our notifications for the latest news and updates. You can disable anytime.',
          title: 'Page Title',
          acceptButtonText: 'Subscribe',
          rejectButtonText: 'Later',
          position: 'bottom-right',
          delay: 2000,
          imageUrl: null,
          colors: {
            background: '#ffffff',
            text: '#333333',
            acceptButton: '#4285f4',
            acceptButtonText: '#ffffff',
            rejectButton: 'transparent',
            rejectButtonText: '#6c757d'
          }
        };

        return this._promptConfig;
      }
    }

    // Show the prompt based on server configuration
    async _showPrompt() {
      if (this._promptShown) {
        return;
      }

      // Check if prompt was recently rejected
      if (this._wasPromptRecentlyRejected()) {
        console.log('Beacon: Prompt was recently rejected, not showing again');
        return;
      }

      try {
        const promptConfig = await this._fetchPromptConfig();

        // Track impression event
        try {
          fetch(`${this._apiUrl}/website/${this._websiteId}/prompt-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'impression' })
          });
        } catch (e) { console.warn('Prompt impression tracking failed', e); }

        // Apply delay if specified (skip for gate — it must appear instantly)
        const promptType = promptConfig.type || 'slide';
        if (promptType !== 'gate' && promptConfig.delay && typeof promptConfig.delay === 'number' && promptConfig.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, promptConfig.delay));

          // Check if prompt was shown during the delay
          if (this._promptShown) {
            return;
          }
        }

        // Prompt type already resolved above (before delay check)
        // NATIVE TYPE: Skip all custom UI — directly trigger browser permission dialog
        if (promptType === 'native') {
          this._promptShown = true;
          console.log('Beacon: Native mode — triggering browser permission dialog directly');
          try {
            await this.subscribe();
          } catch (err) {
            console.warn('Beacon: Native permission request failed or was dismissed', err);
            this._storePromptRejectionTime();
            if (this._onPromptRejected) {
              this._onPromptRejected();
            }
          }
          return;
        }

        // GATE TYPE: Full-screen content lock — maximum conversion system
        if (promptType === 'gate') {
          this._promptShown = true;
          await this._initGate(promptConfig);
          return;
        }

        // Create prompt container (for slide/modal types only — native/gate already returned above)
        const promptContainer = document.createElement('div');
        promptContainer.id = 'beacon-prompt';

        // Set prompt position based on configuration
        const position = promptConfig.position || 'bottom-right';

        // Add custom font styles
        const fontStyle = document.createElement('style');
        fontStyle.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          #beacon-prompt * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
            box-sizing: border-box;
          }
          #beacon-prompt .title {
            font-weight: 600;
            font-size: 16px;
            margin: 0;
            padding: 0;
            letter-spacing: -0.01em;
          }
          #beacon-prompt .message {
            font-weight: 400;
            font-size: 14px;
            line-height: 1.5;
            letter-spacing: -0.01em;
            margin: 0;
            padding: 0;
          }
          @keyframes bellShake {
            0%, 100% { transform: rotate(0); }
            20%, 60% { transform: rotate(8deg); }
            40%, 80% { transform: rotate(-8deg); }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          #beacon-prompt {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
          }
          #beacon-prompt button {
            font-weight: 600;
            font-size: 14px;
            letter-spacing: -0.01em;
            transition: all 0.2s ease;
            white-space: nowrap;
          }
          #beacon-prompt button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          /* Mobile responsive styles */
          @media (max-width: 480px) {
            #beacon-prompt {
              width: calc(100% - 20px) !important;
              margin: 0 10px !important;
              padding: 15px !important;
            }
            #beacon-prompt.position-bottom {
              bottom: 10px !important;
              left: 0 !important;
              right: 0 !important;
              transform: none !important;
            }
            #beacon-prompt.position-top {
              top: 10px !important;
              left: 0 !important;
              right: 0 !important;
              transform: none !important;
            }
            #beacon-prompt.modal-type {
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              margin: 0 !important;
              width: calc(100% - 40px) !important;
              max-width: 350px !important;
            }
            #beacon-prompt .actions-container {
              flex-direction: row !important;
              justify-content: space-between !important;
              gap: 8px !important;
              width: 100% !important;
            }
            #beacon-prompt button {
              padding: 12px 10px !important;
              flex: 1;
            }
          }
        `;
        document.head.appendChild(fontStyle);

        // Apply base styles with improved design
        promptContainer.style.position = 'fixed';
        promptContainer.style.zIndex = '999999';
        promptContainer.style.backgroundColor = promptConfig.colors?.background || '#ffffff';
        promptContainer.style.color = promptConfig.colors?.text || '#333333';
        promptContainer.style.padding = '20px';
        promptContainer.style.borderRadius = '12px';
        promptContainer.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
        promptContainer.style.display = 'flex';
        promptContainer.style.flexDirection = 'column';
        promptContainer.style.gap = '15px';
        promptContainer.style.width = '100%';
        promptContainer.style.maxWidth = '400px';
        promptContainer.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        promptContainer.style.overflow = 'hidden';
        promptContainer.style.border = '1px solid rgba(0,0,0,0.08)';

        // Position the prompt based on type and position
        if (promptType === 'slide') {
          if (position === 'bottom-right') {
            promptContainer.style.bottom = '20px';
            promptContainer.style.right = '20px';
            promptContainer.classList.add('position-bottom');
          } else if (position === 'bottom-left') {
            promptContainer.style.bottom = '20px';
            promptContainer.style.left = '20px';
            promptContainer.classList.add('position-bottom');
          } else if (position === 'top-right') {
            promptContainer.style.top = '20px';
            promptContainer.style.right = '20px';
            promptContainer.classList.add('position-top');
          } else if (position === 'top-left') {
            promptContainer.style.top = '20px';
            promptContainer.style.left = '20px';
            promptContainer.classList.add('position-top');
          } else if (position === 'top-middle') {
            promptContainer.style.top = '0';
            promptContainer.style.left = '50%';
            promptContainer.style.transform = 'translateX(-50%)';
            promptContainer.style.margin = '0 auto';
            promptContainer.style.right = 'auto';
            promptContainer.classList.add('position-top');
          } else if (position === 'bottom-middle') {
            promptContainer.style.bottom = '20px';
            promptContainer.style.left = '50%';
            promptContainer.style.transform = 'translateX(-50%)';
            promptContainer.style.margin = '0 auto';
            promptContainer.style.right = 'auto';
            promptContainer.classList.add('position-bottom');
          }

          // Start off-screen for slide animation
          if (position === 'top-middle') {
            promptContainer.style.transform = 'translate(-50%, -100%)';
            promptContainer.style.margin = '0 auto';
            promptContainer.style.right = 'auto';
          } else if (position === 'bottom-middle') {
            promptContainer.style.transform = 'translate(-50%, 120%)';
            promptContainer.style.margin = '0 auto';
            promptContainer.style.right = 'auto';
          } else if (position.includes('right')) {
            promptContainer.style.transform = 'translateX(120%)';
          } else if (position.includes('left')) {
            promptContainer.style.transform = 'translateX(-120%)';
          } else if (position.includes('top')) {
            promptContainer.style.transform = 'translateY(-120%)';
          } else {
            promptContainer.style.transform = 'translateY(120%)';
          }
        } else if (promptType === 'modal') {
          // Center the modal
          promptContainer.style.top = '50%';
          promptContainer.style.left = '50%';
          promptContainer.style.transform = 'translate(-50%, -50%) scale(0.9)';
          promptContainer.style.opacity = '0';
          promptContainer.classList.add('modal-type');

          // Create overlay with blur effect
          const overlay = document.createElement('div');
          overlay.id = 'beacon-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.backgroundColor = 'rgba(0,0,0,0.4)';
          overlay.style.backdropFilter = 'blur(5px)';
          overlay.style.zIndex = '999998';
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 0.4s ease-in-out';
          document.body.appendChild(overlay);

          // Animate overlay
          setTimeout(() => {
            overlay.style.opacity = '1';
          }, 10);
        }

        // Create header with logo and site name
        const headerContainer = document.createElement('div');
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.gap = '12px';
        headerContainer.style.marginBottom = '5px';

        // Create the bell icon with the LaraPush bell logo
        const bellIcon = document.createElement('div');
        bellIcon.style.width = '28px';
        bellIcon.style.height = '28px';
        bellIcon.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234285f4'%3E%3Cpath d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/%3E%3C/svg%3E\")";
        bellIcon.style.backgroundSize = 'cover';
        bellIcon.style.backgroundPosition = 'center';
        bellIcon.style.borderRadius = '50%';
        bellIcon.style.animation = 'bellShake 1s ease-in-out';

        // Create site name with improved typography
        const siteName = document.createElement('div');
        siteName.className = 'title';
        siteName.textContent = promptConfig.title || document.title || 'Page Title';

        // Add elements to header
        headerContainer.appendChild(bellIcon);
        headerContainer.appendChild(siteName);

        // Create the content container
        const contentContainer = document.createElement('div');
        contentContainer.style.flex = '1';

        // Create the message with improved styling
        const message = document.createElement('div');
        message.className = 'message';
        message.textContent = promptConfig.text;
        message.style.marginBottom = '15px';

        // Create image preview if available
        if (promptConfig.imageUrl) {
          const imagePreview = document.createElement('div');
          imagePreview.style.width = '100%';
          imagePreview.style.height = '140px';
          imagePreview.style.marginBottom = '15px';
          imagePreview.style.borderRadius = '8px';
          imagePreview.style.backgroundImage = `url(${promptConfig.imageUrl})`;
          imagePreview.style.backgroundSize = 'cover';
          imagePreview.style.backgroundPosition = 'center';
          contentContainer.appendChild(imagePreview);
        }

        // Create the action buttons container
        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('actions-container');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '12px';
        actionsContainer.style.marginTop = '5px';
        actionsContainer.style.justifyContent = 'flex-end';

        // Create the reject button with improved styling
        const rejectButton = document.createElement('button');
        rejectButton.textContent = promptConfig.rejectButtonText || 'Later';
        rejectButton.style.padding = '10px 16px';
        rejectButton.style.border = 'none';
        rejectButton.style.borderRadius = '6px';
        rejectButton.style.cursor = 'pointer';
        rejectButton.style.backgroundColor = promptConfig.colors?.rejectButton || 'transparent';
        rejectButton.style.color = promptConfig.colors?.rejectButtonText || '#6c757d';
        rejectButton.style.transition = 'all 0.2s ease';

        // Create the accept button with improved styling
        const acceptButton = document.createElement('button');
        acceptButton.textContent = promptConfig.acceptButtonText || 'Subscribe';
        acceptButton.style.padding = '10px 20px';
        acceptButton.style.border = 'none';
        acceptButton.style.borderRadius = '6px';
        acceptButton.style.cursor = 'pointer';
        acceptButton.style.backgroundColor = promptConfig.colors?.acceptButton || '#4285f4';
        acceptButton.style.color = promptConfig.colors?.acceptButtonText || '#ffffff';
        acceptButton.style.transition = 'all 0.2s ease';
        acceptButton.style.animation = 'pulse 2s infinite';

        // Check if we're on a mobile device
        const isMobile = window.innerWidth <= 480;

        // If on mobile, adjust the button container
        if (isMobile) {
          actionsContainer.style.flexDirection = 'row';
          actionsContainer.style.width = '100%';
          actionsContainer.style.justifyContent = 'space-between';
          rejectButton.style.flex = '1';
          acceptButton.style.flex = '1';
        }

        // Add event listeners to buttons
        rejectButton.addEventListener('click', () => {
          // Track 'later' event
          try {
            fetch(`${this._apiUrl}/website/${this._websiteId}/prompt-event`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'later' })
            });
          } catch (e) { console.warn('Prompt later tracking failed', e); }
          this._hidePrompt();
          this._storePromptRejectionTime();
          if (this._onPromptRejected) {
            this._onPromptRejected();
          }
        });

        acceptButton.addEventListener('click', () => {
          // Track 'allow' event
          try {
            fetch(`${this._apiUrl}/website/${this._websiteId}/prompt-event`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'allow' })
            });
          } catch (e) { console.warn('Prompt allow tracking failed', e); }
          this._hidePrompt();
          this.subscribe();
        });

        // Assemble the prompt
        actionsContainer.appendChild(rejectButton);
        actionsContainer.appendChild(acceptButton);
        contentContainer.appendChild(message);
        contentContainer.appendChild(actionsContainer);
        headerContainer.appendChild(bellIcon);
        headerContainer.appendChild(siteName);
        promptContainer.appendChild(headerContainer);
        promptContainer.appendChild(contentContainer);

        // Add the prompt to the page
        document.body.appendChild(promptContainer);

        // Detect viewport changes and adjust layout if needed
        const resizeObserver = new ResizeObserver(entries => {
          const isMobileView = window.innerWidth <= 480;

          if (isMobileView) {
            // Mobile view adjustments
            if (promptContainer.classList.contains('position-bottom') ||
              promptContainer.classList.contains('position-top')) {
              promptContainer.style.width = 'calc(100% - 20px)';
              promptContainer.style.left = '0';
              promptContainer.style.right = '0';
              promptContainer.style.margin = '0 10px';
              promptContainer.style.transform = 'none';
            }

            actionsContainer.style.flexDirection = 'row';
            actionsContainer.style.width = '100%';
            actionsContainer.style.justifyContent = 'space-between';
            rejectButton.style.flex = '1';
            acceptButton.style.flex = '1';
          } else {
            // Desktop view adjustments
            if (position === 'top-middle') {
              promptContainer.style.left = '50%';
              promptContainer.style.transform = promptContainer.classList.contains('animated') ?
                'translateX(-50%)' : 'translate(-50%, -100%)';
            } else if (position === 'bottom-middle') {
              promptContainer.style.left = '50%';
              promptContainer.style.transform = promptContainer.classList.contains('animated') ?
                'translateX(-50%)' : 'translate(-50%, 120%)';
            }

            actionsContainer.style.flexDirection = 'row';
            actionsContainer.style.justifyContent = 'flex-end';
            rejectButton.style.flex = 'initial';
            acceptButton.style.flex = 'initial';
          }
        });

        // Start observing the viewport
        resizeObserver.observe(document.body);

        // Store the observer for cleanup
        this._resizeObserver = resizeObserver;

        // Animate the prompt in
        setTimeout(() => {
          if (promptType === 'slide') {
            if (position === 'top-middle' || position === 'bottom-middle') {
              if (window.innerWidth <= 480) {
                // For mobile, don't use translateX(-50%) which can cause issues
                promptContainer.style.transform = 'none';
              } else {
                promptContainer.style.transform = 'translateX(-50%)';
              }
            } else {
              promptContainer.style.transform = 'translate(0)';
            }
            promptContainer.classList.add('animated');
          } else if (promptType === 'modal') {
            promptContainer.style.opacity = '1';
            if (window.innerWidth <= 480) {
              // For mobile, ensure the modal stays centered
              promptContainer.style.transform = 'translate(-50%, -50%) scale(1)';
            } else {
              promptContainer.style.transform = 'translate(-50%, -50%) scale(1)';
            }
            promptContainer.classList.add('animated');
          }
        }, 10);

        this._promptShown = true;
        this._promptElement = promptContainer;
      } catch (error) {
        console.error('Beacon: Error showing prompt:', error);
      }
    }

    _hidePrompt() {
      if (!this._promptElement) {
        return;
      }

      // Clean up the resize observer if it exists
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }

      const promptConfig = this._promptConfig || {};
      const promptType = promptConfig.type || 'slide';

      // Animate out based on prompt type
      if (promptType === 'modal') {
        // Fade out overlay
        const overlay = document.getElementById('beacon-overlay');
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.remove();
          }, 400);
        }

        // Fade out and scale down modal
        this._promptElement.style.opacity = '0';
        // Ensure proper transform on mobile
        if (window.innerWidth <= 480) {
          this._promptElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
        } else {
          this._promptElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
        }
      } else {
        // Slide out based on position
        const position = promptConfig.position || 'bottom-right';

        if (position === 'top-middle') {
          this._promptElement.style.transform = 'translate(-50%, -100%)';
          this._promptElement.style.margin = '0 auto';
          this._promptElement.style.right = 'auto';
        } else if (position === 'bottom-middle') {
          this._promptElement.style.transform = 'translate(-50%, 120%)';
          this._promptElement.style.margin = '0 auto';
          this._promptElement.style.right = 'auto';
        } else if (position.includes('right')) {
          this._promptElement.style.transform = 'translateX(120%)';
        } else if (position.includes('left')) {
          this._promptElement.style.transform = 'translateX(-120%)';
        } else if (position.includes('top')) {
          this._promptElement.style.transform = 'translateY(-120%)';
        } else {
          this._promptElement.style.transform = 'translateY(120%)';
        }
      }

      // Remove the element after animation completes
      setTimeout(() => {
        if (this._promptElement && this._promptElement.parentNode) {
          this._promptElement.parentNode.removeChild(this._promptElement);
        }
        this._promptElement = null;
      }, 400);

      this._promptShown = false;
    }

    // Register service worker
    async registerServiceWorker() {
      try {
        this._swRegistration = await navigator.serviceWorker.register(this._serviceWorkerPath, {
          scope: this._serviceWorkerScope
        });
        console.log('Beacon: Service Worker registered');
        return this._swRegistration;
      } catch (error) {
        console.error('Beacon: Service Worker registration failed:', error);
        throw error;
      }
    }

    // Get the current subscription status
    async getSubscriptionStatus() {
      if (!this._swRegistration) {
        try {
          this._swRegistration = await this.registerServiceWorker();
        } catch (error) {
          return { isSubscribed: false, subscription: null };
        }
      }

      try {
        const subscription = await this._swRegistration.pushManager.getSubscription();
        this._pushSubscription = subscription;
        return {
          isSubscribed: !!subscription,
          subscription: subscription
        };
      } catch (error) {
        console.error('Beacon: Error getting subscription status:', error);
        return { isSubscribed: false, subscription: null };
      }
    }

    // Subscribe to push notifications
    async subscribe(useNativeBrowserPrompt = true) {
      if (!this._swRegistration) {
        try {
          this._swRegistration = await this.registerServiceWorker();
        } catch (error) {
          throw new Error('Failed to register service worker before subscribing');
        }
      }

      try {
        // We must request permission quickly so the user gesture isn't lost
        if (!useNativeBrowserPrompt) {
          const permission = Notification.permission;
          if (permission !== 'granted') {
            throw new Error('Notification permission not granted and native browser prompt disabled');
          }
        } else {
          // Explicitly ask for permission to consume the user gesture immediately
          const permResult = await Notification.requestPermission();
          if (permResult !== 'granted') {
            throw new Error('Notification permission denied by user');
          }
        }

        let vapidPublicKey = this._cachedVapidKey;

        // Final fallback if prefetch failed
        if (!vapidPublicKey) {
          const headers = {};
          if (this._apiKey) {
            headers['X-API-Key'] = this._apiKey;
          }
          const response = await fetch(`${this._apiUrl}/vapidPublicKey`, {
            headers: headers
          });
          const vapidPublicKeyData = await response.json();
          vapidPublicKey = vapidPublicKeyData.publicKey;
        }

        // Convert the VAPID public key to a Uint8Array
        const convertedVapidKey = this._urlBase64ToUint8Array(vapidPublicKey);

        // Get the subscription options
        const options = {
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        };

        // Subscribe to push notifications with retry logic for stale VAPID keys
        let subscription;
        try {
          subscription = await this._swRegistration.pushManager.subscribe(options);
        } catch (subError) {
          console.warn('Beacon: Subscription failed, attempting to clear old subscription and retry...', subError);
          // Often fails if the VAPID key changed but a stale subscription exists
          const existingSub = await this._swRegistration.pushManager.getSubscription();
          if (existingSub) {
            await existingSub.unsubscribe();
            console.log('Beacon: Cleared stale subscription, retrying...');
            subscription = await this._swRegistration.pushManager.subscribe(options);
          } else {
            throw subError; // Rethrow if it wasn't a stale subscription issue
          }
        }

        console.log('Beacon: User is subscribed:', subscription);
        this._pushSubscription = subscription;

        // Send the subscription to the server
        await this._sendSubscriptionToServer(subscription);

        return subscription;
      } catch (error) {
        console.error('Beacon: Failed to subscribe the user:', error);
        throw error;
      }
    }

    // Get subscription token from the server
    async _getSubscriptionToken() {
      try {
        const response = await fetch(`${this._apiUrl}/website/${this._websiteId}/subscription-token`);

        if (!response.ok) {
          throw new Error(`Failed to get subscription token: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.token;
      } catch (error) {
        console.error('Beacon: Error getting subscription token:', error);
        throw error;
      }
    }

    // Send subscription to the server
    async _sendSubscriptionToServer(subscription) {
      try {
        // Get subscription token first
        const token = await this._getSubscriptionToken();

        // Check if subscription is valid
        if (!subscription || !subscription.endpoint) {
          throw new Error('Invalid subscription object');
        }

        // Check if token is valid
        if (!token) {
          throw new Error('Failed to get subscription token');
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };

        if (this._apiKey) {
          headers['X-API-Key'] = this._apiKey;
        }

        const response = await fetch(`${this._apiUrl}/add-subscription`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            subscription: subscription,
            websiteId: this._websiteId,
            metadata: this._customSegments
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to send subscription to server: ${response.status} ${response.statusText}. ${errorText}`);
        }

        // Store subscription status
        this._storeSubscriptionStatus(true);

        return true;
      } catch (error) {
        console.error('Beacon: Error sending subscription to server:', error);
        throw error;
      }
    }

    // Update subscription on the server
    async _updateSubscriptionOnServer(oldSubscription, newSubscription) {
      try {
        // Get subscription token first
        const token = await this._getSubscriptionToken();

        const response = await fetch(`${this._apiUrl}/update-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            oldSubscription: oldSubscription,
            subscription: newSubscription,
            websiteId: this._websiteId
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update subscription on server: ${response.status} ${response.statusText}`);
        }

        return true;
      } catch (error) {
        console.error('Beacon: Error updating subscription on server:', error);
        throw error;
      }
    }

    // Remove subscription from the server
    async _removeSubscriptionFromServer(subscription) {
      try {
        // Get subscription token first
        const token = await this._getSubscriptionToken();

        const response = await fetch(`${this._apiUrl}/remove-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            subscription: subscription,
            websiteId: this._websiteId
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to remove subscription from server: ${response.status} ${response.statusText}`);
        }

        return true;
      } catch (error) {
        console.error('Beacon: Error removing subscription from server:', error);
        throw error;
      }
    }

    // Unsubscribe from push notifications
    async unsubscribe() {
      try {
        // Get the current subscription
        const swRegistration = await navigator.serviceWorker.getRegistration(this._serviceWorkerPath);
        if (!swRegistration) {
          console.warn('Beacon: No service worker registration found');
          return false;
        }

        const subscription = await swRegistration.pushManager.getSubscription();
        if (!subscription) {
          console.warn('Beacon: No subscription found');
          return false;
        }

        // Get subscription token first
        const token = await this._getSubscriptionToken();

        // Send unsubscribe request to server
        await fetch(`${this._apiUrl}/remove-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            subscription: subscription,
            websiteId: this._websiteId
          })
        });

        // Unsubscribe from the browser
        const result = await subscription.unsubscribe();

        // Store subscription status
        this._storeSubscriptionStatus(false);

        return result;
      } catch (error) {
        console.error('Beacon: Error unsubscribing:', error);
        return false;
      }
    }

    // Convert URL-safe base64 to Uint8Array
    _urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    // Store the time when prompt was rejected
    _storePromptRejectionTime() {
      try {
        const rejectionTime = Date.now();
        localStorage.setItem(`beacon_prompt_rejected_${this._websiteId}`, rejectionTime.toString());
      } catch (error) {
        console.error('Beacon: Error storing prompt rejection time:', error);
      }
    }

    // Check if prompt was recently rejected
    _wasPromptRecentlyRejected() {
      try {
        const rejectionTimeStr = localStorage.getItem(`beacon_prompt_rejected_${this._websiteId}`);
        if (!rejectionTimeStr) {
          return false;
        }

        const rejectionTime = parseInt(rejectionTimeStr, 10);
        const currentTime = Date.now();

        // Check if the rejection was within the timeout period
        return (currentTime - rejectionTime) < this._promptRejectionTimeout;
      } catch (error) {
        console.error('Beacon: Error checking prompt rejection status:', error);
        return false;
      }
    }
    // ═══════════════════════════════════════════════════════
    // PUSH GATE SYSTEM — Full-screen content lock for max conversions
    // Features: 3-layer validation, self-healing, fake verify step,
    // denied handling, full reset, smart cleanup
    // ═══════════════════════════════════════════════════════

    // 3-Layer Smart Validation: localStorage + Permission API + ServiceWorker
    async _gateValidate() {
      const lsKey = 'beacon_gate_' + this._websiteId;
      const lsFlag = localStorage.getItem(lsKey) === '1';
      const permission = ('Notification' in window) ? Notification.permission : 'default';

      let hasSubscription = false;
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration(this._serviceWorkerScope || '/');
          if (reg) {
            const sub = await reg.pushManager.getSubscription();
            hasSubscription = !!sub;
          }
        }
      } catch (e) { }

      // Denied takes priority
      if (permission === 'denied') {
        localStorage.removeItem(lsKey);
        return 'denied';
      }
      // All 3 layers pass
      if (lsFlag && permission === 'granted' && hasSubscription) return 'subscribed';
      // Permission OK but subscription missing — repairable
      if (permission === 'granted' && !hasSubscription) return 'needs-repair';
      // Stale localStorage — smart cleanup
      if (lsFlag && permission !== 'granted') localStorage.removeItem(lsKey);
      return 'not-subscribed';
    }

    // Main gate orchestrator
    async _initGate(cfg) {
      // === STEP 1: 3-Layer Validation ===
      const status = await this._gateValidate();

      if (status === 'subscribed') {
        console.log('Beacon Gate: ✓ Validated — content unlocked');
        return;
      }

      // Self-healing: permission granted but subscription broken
      if (status === 'needs-repair') {
        console.log('Beacon Gate: Self-healing — re-subscribing silently');
        try {
          await this.registerServiceWorker();
          await this.subscribe(false); // silent — don't re-prompt
          localStorage.setItem('beacon_gate_' + this._websiteId, '1');
          console.log('Beacon Gate: ✓ Self-healed');
          return;
        } catch (e) {
          console.warn('Beacon Gate: Self-heal failed, showing gate');
        }
      }

      // Track impression
      try {
        fetch(`${this._apiUrl}/website/${this._websiteId}/prompt-event`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'impression' })
        });
      } catch (e) { }

      // === STEP 2: Lock the page ===
      document.body.style.overflow = 'hidden';

      // Colors from dashboard config
      const accent = cfg.colors?.acceptButton || '#4f46e5';
      const accentText = cfg.colors?.acceptButtonText || '#ffffff';
      const textColor = cfg.colors?.text || '#1f2937';
      const bgColor = cfg.colors?.background || '#ffffff';
      const isDark = this._isColorDark(bgColor);
      const rejectBg = cfg.colors?.rejectButton || (isDark ? '#374151' : '#f3f4f6');
      const rejectText = cfg.colors?.rejectButtonText || (isDark ? '#9ca3af' : '#6b7280');

      // Inject gate styles
      const style = document.createElement('style');
      style.id = 'beacon-gate-css';
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        #beacon-gate-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:${isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.88)'};backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);opacity:0;transition:opacity .4s ease;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        #beacon-gate-card{background:${bgColor};color:${textColor};border-radius:20px;padding:44px 36px;max-width:420px;width:90%;box-shadow:${isDark ? '0 25px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06)' : '0 25px 60px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.04)'};text-align:center;transform:scale(.92) translateY(20px);opacity:0;transition:all .5s cubic-bezier(.175,.885,.32,1.275)}
        .pp-g-icon{width:72px;height:72px;border-radius:20px;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;animation:pp-bell 2s ease-in-out infinite}
        .pp-g-title{font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-.02em;line-height:1.3}
        .pp-g-text{font-size:14px;line-height:1.6;margin:0 0 28px;opacity:.6}
        .pp-g-btn{display:block;width:100%;padding:14px 24px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s ease;font-family:inherit;letter-spacing:-.01em}
        .pp-g-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.15)}
        .pp-g-btn:active{transform:translateY(0)}
        .pp-g-btn:disabled{opacity:.6;cursor:not-allowed;transform:none!important;box-shadow:none!important}
        .pp-g-btn-sec{background:${rejectBg};color:${rejectText};margin-top:12px;font-size:13px;padding:11px 20px}
        .pp-g-btn-sec:hover{box-shadow:none;opacity:.8}
        .pp-g-spin{width:48px;height:48px;border:4px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'};border-top-color:${accent};border-radius:50%;margin:0 auto 24px;animation:pp-spin .7s linear infinite}
        .pp-g-steps{text-align:left;margin:16px 0 24px;padding:0;list-style:none}
        .pp-g-steps li{display:flex;align-items:flex-start;gap:10px;padding:10px 0;font-size:13px;line-height:1.5;border-bottom:1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'}}
        .pp-g-steps li:last-child{border-bottom:none}
        .pp-g-sn{flex-shrink:0;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:${this._hexToRgba(accent, .1)};color:${accent}}
        @keyframes pp-bell{0%,100%{transform:rotate(0) scale(1)}10%{transform:rotate(14deg) scale(1.05)}20%{transform:rotate(-14deg) scale(1.05)}30%{transform:rotate(10deg)}40%{transform:rotate(-8deg)}50%{transform:rotate(0) scale(1)}}
        @keyframes pp-spin{to{transform:rotate(360deg)}}
        @keyframes pp-pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes pp-shake{0%,100%{transform:scale(1) translateY(0)}25%{transform:scale(1) translateX(-8px)}75%{transform:scale(1) translateX(8px)}}
        @media(max-width:480px){#beacon-gate-card{padding:32px 24px;border-radius:16px;width:calc(100% - 32px)}.pp-g-title{font-size:20px}.pp-g-icon{width:60px;height:60px}}
      `;
      document.head.appendChild(style);

      // Create DOM
      const overlay = document.createElement('div');
      overlay.id = 'beacon-gate-overlay';
      const card = document.createElement('div');
      card.id = 'beacon-gate-card';

      // === STEP 3: Denied state ===
      if (status === 'denied') {
        this._renderGateDenied(card, { accent, accentText, textColor, bgColor });
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => setTimeout(() => {
          overlay.style.opacity = '1';
          card.style.transform = 'scale(1) translateY(0)';
          card.style.opacity = '1';
        }, 30));
        return;
      }

      // === STEP 4: Main gate UI ===
      card.innerHTML = `
        <div class="pp-g-icon" style="background:${this._hexToRgba(accent, .1)}">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div class="pp-g-title">${cfg.title || 'Enable Notifications'}</div>
        <p class="pp-g-text">${cfg.text || 'Allow notifications to unlock this content and stay updated.'}</p>
        <button class="pp-g-btn" id="pp-g-go" style="background:${accent};color:${accentText}">${cfg.acceptButtonText || 'Continue'}</button>
      `;

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      // Animate in
      requestAnimationFrame(() => setTimeout(() => {
        overlay.style.opacity = '1';
        card.style.transform = 'scale(1) translateY(0)';
        card.style.opacity = '1';
      }, 30));

      // === STEP 5: Continue click handler ===
      const self = this;
      card.querySelector('#pp-g-go').addEventListener('click', async function () {
        this.disabled = true;

        // Phase 1: Fake "Verifying" step (1.5s)
        card.innerHTML = `
          <div class="pp-g-spin"></div>
          <div class="pp-g-title">Verifying your access…</div>
          <p class="pp-g-text" style="animation:pp-pulse 1.5s ease infinite">Setting things up for you</p>
        `;
        await new Promise(r => setTimeout(r, 1500));

        // Phase 2: Trigger browser permission dialog
        try {
          try {
            fetch(`${self._apiUrl}/website/${self._websiteId}/prompt-event`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'allow' })
            });
          } catch (e) { }

          await self.registerServiceWorker();
          await self.subscribe(true); // This triggers browser's Allow/Block dialog

          // === SUCCESS ===
          localStorage.setItem('beacon_gate_' + self._websiteId, '1');

          card.innerHTML = `
            <div class="pp-g-icon" style="background:rgba(16,185,129,.1)">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="pp-g-title">You're all set!</div>
            <p class="pp-g-text">Unlocking content…</p>
          `;
          setTimeout(() => self._unlockGate(), 800);

        } catch (err) {
          if (Notification.permission === 'denied') {
            // Track later event for denied
            try {
              fetch(`${self._apiUrl}/website/${self._websiteId}/prompt-event`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'later' })
              });
            } catch (e) { }
            self._renderGateDenied(card, { accent, accentText, textColor, bgColor: bgColor });
          } else {
            // Dismissed or error — show retry
            card.innerHTML = `
              <div class="pp-g-icon" style="background:rgba(245,158,11,.1)">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div class="pp-g-title">Permission Required</div>
              <p class="pp-g-text">Notification access is needed to continue. Please try again.</p>
              <button class="pp-g-btn" id="pp-g-retry" style="background:${accent};color:${accentText}">Try Again</button>
            `;
            card.querySelector('#pp-g-retry').addEventListener('click', () => window.location.reload());
          }
        }
      });
    }

    // Render denied-user instructions with browser-specific steps
    _renderGateDenied(card, colors) {
      const { accent, accentText, textColor } = colors;
      const ua = navigator.userAgent;
      let browser = 'your browser', steps = [];

      if (ua.includes('Chrome') && !ua.includes('Edg')) {
        browser = 'Chrome';
        steps = [
          'Click the <strong>🔒 lock icon</strong> in the address bar',
          'Find <strong>Notifications</strong> in the dropdown',
          'Change from <strong>Block</strong> to <strong>Allow</strong>',
          'Come back and click the button below'
        ];
      } else if (ua.includes('Firefox')) {
        browser = 'Firefox';
        steps = [
          'Click the <strong>🔒 lock icon</strong> in the address bar',
          'Click <strong>Connection secure</strong> → <strong>More info</strong>',
          'Go to <strong>Permissions</strong> → enable <strong>Notifications</strong>',
          'Come back and click the button below'
        ];
      } else if (ua.includes('Edg')) {
        browser = 'Edge';
        steps = [
          'Click the <strong>🔒 lock icon</strong> in the address bar',
          'Find <strong>Notifications</strong> in the menu',
          'Change to <strong>Allow</strong>',
          'Come back and click the button below'
        ];
      } else if (ua.includes('Safari')) {
        browser = 'Safari';
        steps = [
          'Go to <strong>Safari → Settings → Websites</strong>',
          'Select <strong>Notifications</strong> in the sidebar',
          'Find this website and set to <strong>Allow</strong>',
          'Come back and click the button below'
        ];
      } else {
        steps = [
          'Open browser <strong>Settings</strong>',
          'Find <strong>Site Permissions → Notifications</strong>',
          'Allow notifications for this site',
          'Come back and click the button below'
        ];
      }

      const stepsHTML = steps.map((s, i) =>
        `<li><span class="pp-g-sn">${i + 1}</span><span>${s}</span></li>`
      ).join('');

      card.innerHTML = `
        <div class="pp-g-icon" style="background:rgba(239,68,68,.1)">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div class="pp-g-title">Notifications Blocked</div>
        <p class="pp-g-text">You previously blocked notifications. Only you can fix this from your browser settings — follow the steps below:</p>
        <ol class="pp-g-steps">${stepsHTML}</ol>
        <button class="pp-g-btn" id="pp-g-check" style="background:${accent};color:${accentText}">I've Enabled — Check Again</button>
        <p style="font-size:11px;opacity:.45;margin-top:16px;line-height:1.5">This cannot be fixed automatically. You must change the setting in your browser first, then click the button above.</p>
      `;

      const self = this;

      // "Check Again" handler — re-validates all 3 layers
      card.querySelector('#pp-g-check').addEventListener('click', async function () {
        this.textContent = 'Checking…';
        this.disabled = true;
        await new Promise(r => setTimeout(r, 800));

        const s = await self._gateValidate();
        if (s === 'subscribed') {
          self._unlockGate();
        } else if (s === 'needs-repair' || s === 'not-subscribed') {
          try {
            await self.registerServiceWorker();
            await self.subscribe(true);
            localStorage.setItem('beacon_gate_' + self._websiteId, '1');
            self._unlockGate();
          } catch (e) {
            this.textContent = '⚠️ Still blocked — change browser setting first';
            this.disabled = false;
            this.style.background = '#ef4444';
            card.style.animation = 'pp-shake .5s ease';
            setTimeout(() => {
              card.style.animation = '';
              // Reset button after 3s
              setTimeout(() => {
                this.textContent = 'I\'ve Enabled — Check Again';
                this.style.background = accent;
              }, 3000);
            }, 500);
          }
        } else {
          this.textContent = '⚠️ Still blocked — change browser setting first';
          this.disabled = false;
          this.style.background = '#ef4444';
          card.style.animation = 'pp-shake .5s ease';
          setTimeout(() => {
            card.style.animation = '';
            setTimeout(() => {
              this.textContent = 'I\'ve Enabled — Check Again';
              this.style.background = accent;
            }, 3000);
          }, 500);
        }
      });
    }

    // Smooth unlock animation
    _unlockGate() {
      const card = document.getElementById('beacon-gate-card');
      const overlay = document.getElementById('beacon-gate-overlay');

      if (card) {
        card.style.transform = 'scale(.95) translateY(-20px)';
        card.style.opacity = '0';
      }
      if (overlay) {
        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.remove();
            const css = document.getElementById('beacon-gate-css');
            if (css) css.remove();
          }, 400);
        }, 200);
      }
      document.body.style.overflow = '';
    }

    // Nuclear reset: SW + IndexedDB + localStorage + sessionStorage
    async _gateFullReset() {
      console.log('Beacon Gate: Full system reset');
      // 1. localStorage
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('beacon_') || k.startsWith('Beacon'))) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch (e) { }
      // 2. sessionStorage
      try {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith('beacon_') || k.startsWith('Beacon'))) keys.push(k);
        }
        keys.forEach(k => sessionStorage.removeItem(k));
      } catch (e) { }
      // 3. Service Workers
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
          } catch (e) { }
          await reg.unregister();
        }
      } catch (e) { }
      // 4. IndexedDB
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name && db.name.toLowerCase().includes('push')) indexedDB.deleteDatabase(db.name);
        }
      } catch (e) { }
      console.log('Beacon Gate: Reset complete');
    }

    // Utility: detect dark background
    _isColorDark(hex) {
      if (!hex || hex === 'transparent') return false;
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
    }

    // Utility: hex to rgba
    _hexToRgba(hex, a) {
      if (!hex || hex === 'transparent') return `rgba(0,0,0,${a})`;
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      return `rgba(${parseInt(hex.substr(0, 2), 16)},${parseInt(hex.substr(2, 2), 16)},${parseInt(hex.substr(4, 2), 16)},${a})`;
    }
  }

  // Expose the Beacon object to the global scope
  window.Beacon = new BeaconClass();
})(window); 