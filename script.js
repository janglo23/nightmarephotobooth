// Nightmare Before Christmas Photobooth JavaScript

class NightmarePhotobooth {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.photosGrid = document.getElementById('photosGrid');
        this.photoCountSelect = document.getElementById('photoCount');
        this.startCameraBtn = document.getElementById('startCamera');
        this.capturePhotoBtn = document.getElementById('capturePhoto');
        this.resetPhotosBtn = document.getElementById('resetPhotos');
        this.downloadPhotosBtn = document.getElementById('downloadPhotos');
        this.photoCounter = document.getElementById('photoCounter');
        this.totalPhotos = document.getElementById('totalPhotos');
        this.finalResult = document.getElementById('finalResult');
        this.finalCanvas = document.getElementById('finalCanvas');
        this.downloadFinalBtn = document.getElementById('downloadFinal');
        this.startOverBtn = document.getElementById('startOver');
        
        // Add filter control elements
        this.filterIntensitySlider = document.getElementById('filterIntensity');
        this.filterPreviewBtn = document.getElementById('filterPreview');
        this.filterLabel = document.getElementById('filterLabel');
        
        // Countdown overlay elements
        this.countdownOverlay = document.getElementById('countdownOverlay');
        this.countdownNumber = document.getElementById('countdownNumber');
        this.countdownText = document.getElementById('countdownText');
        this.countdownPhotoInfo = document.getElementById('countdownPhotoInfo');
        
        // Photo enlargement elements
        this.photoEnlargeOverlay = document.getElementById('photoEnlargeOverlay');
        this.enlargedPhoto = document.getElementById('enlargedPhoto');
        this.closeEnlargeBtn = document.getElementById('closeEnlarge');
        
        this.photos = [];
        this.stream = null;
        this.maxPhotos = 2;
        this.currentPhotoCount = 0;
        this.isCountdownActive = false;
        this.countdownTimer = null;
        
        // Filter settings
        this.filterIntensity = 0.15; // Default light filter
        this.isPreviewMode = false;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updatePhotoGrid();
        this.updateUI();
        this.enableMirrorMode(); // Always use mirror mode
        this.checkCameraSupport();
    }
    
    bindEvents() {
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.capturePhotoBtn.addEventListener('click', () => this.capturePhoto());
        this.resetPhotosBtn.addEventListener('click', () => this.resetPhotos());
        this.downloadPhotosBtn.addEventListener('click', () => this.downloadAllPhotos());
        this.photoCountSelect.addEventListener('change', () => this.updateMaxPhotos());
        this.downloadFinalBtn.addEventListener('click', () => this.downloadFinalResult());
        this.startOverBtn.addEventListener('click', () => this.startNewSession());
        
        // Add event listeners for filter controls
        if (this.filterIntensitySlider) {
            this.filterIntensitySlider.addEventListener('input', (e) => this.updateFilterIntensity(e.target.value));
        }
        if (this.filterPreviewBtn) {
            this.filterPreviewBtn.addEventListener('click', () => this.toggleFilterPreview());
        }
        
        // Add event listeners for photo enlargement
        if (this.closeEnlargeBtn) {
            this.closeEnlargeBtn.addEventListener('click', () => this.closePhotoEnlargement());
        }
        if (this.photoEnlargeOverlay) {
            this.photoEnlargeOverlay.addEventListener('click', (e) => {
                if (e.target === this.photoEnlargeOverlay) {
                    this.closePhotoEnlargement();
                }
            });
        }
    }
    
    async checkCameraSupport() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showNotification('⚠️ Camera not supported in this browser. Please use Chrome, Firefox, or Edge.', 'error');
                this.startCameraBtn.disabled = true;
                this.startCameraBtn.textContent = '❌ Camera Not Supported';
                return;
            }
            
            // Check if we're on HTTPS or localhost
            const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if (!isSecure) {
                this.showNotification('🔒 Camera requires HTTPS connection. Please use https:// or localhost.', 'error');
                this.startCameraBtn.textContent = '🔒 Requires HTTPS';
                return;
            }
            
            // Try to enumerate devices to check if camera exists
            if (navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                
                if (videoDevices.length === 0) {
                    this.showNotification('📷 No camera detected. Please connect a camera and refresh the page.', 'error');
                    this.startCameraBtn.disabled = true;
                    this.startCameraBtn.textContent = '📷 No Camera Detected';
                    return;
                }
                
                console.log(`Found ${videoDevices.length} camera(s):`, videoDevices);
                this.showNotification('📹 Camera detected! Click "Start Camera" to begin.', 'info');
            }
            
        } catch (error) {
            console.warn('Camera support check failed:', error);
            // Don't block the user, just log the warning
        }
    }
    
    async startCamera() {
        try {
            // Check if browser supports camera
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported by this browser');
            }
            
            // Stop existing stream if any
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            this.startCameraBtn.textContent = '⏳ Starting Camera...';
            this.startCameraBtn.disabled = true;
            
            // Try different camera configurations with improved color settings
            const constraints = [
                // Try ideal resolution first with enhanced settings for better color
                {
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user',
                        // Enhanced settings for better color reproduction
                        whiteBalanceMode: { ideal: 'auto' },
                        exposureMode: { ideal: 'auto' },
                        focusMode: { ideal: 'auto' },
                        // Improve image quality
                        aspectRatio: { ideal: 1.777777778 }, // 16:9
                        frameRate: { ideal: 30 },
                        // Request higher quality when available
                        videoKind: { ideal: 'color' }
                    },
                    audio: false
                },
                // Fallback to lower resolution with basic auto adjustments
                {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user',
                        whiteBalanceMode: { ideal: 'auto' },
                        exposureMode: { ideal: 'auto' },
                        focusMode: { ideal: 'auto' }
                    },
                    audio: false
                },
                // Basic video only
                {
                    video: true,
                    audio: false
                }
            ];
            
            let streamStarted = false;
            
            for (let i = 0; i < constraints.length && !streamStarted; i++) {
                try {
                    console.log(`Trying camera configuration ${i + 1}...`);
                    this.stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
                    streamStarted = true;
                } catch (configError) {
                    console.warn(`Camera configuration ${i + 1} failed:`, configError);
                    if (i === constraints.length - 1) {
                        throw configError;
                    }
                }
            }
            
            if (!streamStarted) {
                throw new Error('Failed to start camera with any configuration');
            }
            
            this.video.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Camera timeout - video not ready'));
                }, 10000); // 10 second timeout
                
                this.video.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeout);
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve();
                }, { once: true });
                
                this.video.addEventListener('error', (e) => {
                    clearTimeout(timeout);
                    reject(new Error('Video element error: ' + e.message));
                }, { once: true });
            });
            
            // Ensure video is playing
            try {
                await this.video.play();
            } catch (playError) {
                console.warn('Video play failed, but continuing:', playError);
            }
            
            this.startCameraBtn.textContent = '📹 Camera Active';
            this.capturePhotoBtn.disabled = false;
            
            this.showNotification('👻 Camera is ready! Strike a spooky pose!', 'success');
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            
            // Reset button state
            this.startCameraBtn.textContent = '👻 Start Camera';
            this.startCameraBtn.disabled = false;
            this.capturePhotoBtn.disabled = true;
            
            // Provide specific error messages
            let errorMessage = '💀 Camera error: ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Camera permission denied. Please allow camera access and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found. Please connect a camera and try again.';
            } else if (error.name === 'NotReadableError') {
                errorMessage += 'Camera is already in use by another application.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage += 'Camera constraints not supported. Try a different browser.';
            } else if (error.message.includes('not supported')) {
                errorMessage += 'Your browser does not support camera access. Try Chrome, Firefox, or Edge.';
            } else {
                errorMessage += error.message || 'Unknown camera error. Please try refreshing the page.';
            }
            
            this.showNotification(errorMessage, 'error');
            
            // Show troubleshooting tips
            setTimeout(() => {
                this.showTroubleshootingTips();
            }, 2000);
        }
    }
    
    capturePhoto() {
        if (!this.stream || this.isCountdownActive) {
            return;
        }
        
        // Start the auto-capture sequence
        this.startAutoCapture();
    }
    
    async startAutoCapture() {
        this.isCountdownActive = true;
        this.capturePhotoBtn.disabled = true;
        
        const photosToTake = this.maxPhotos - this.currentPhotoCount;
        
        for (let i = 0; i < photosToTake; i++) {
            // Show countdown for each photo
            await this.showCountdown(i + 1, photosToTake);
            
            // Capture the photo
            await this.takeSinglePhoto();
            
            // Short pause between photos (except for the last one)
            if (i < photosToTake - 1) {
                await this.delay(1000); // 1 second pause between photos
            }
        }
        
        this.isCountdownActive = false;
        
        if (this.currentPhotoCount >= this.maxPhotos) {
            this.showNotification('🎭 Photo session complete! Creating your masterpiece...', 'info');
            setTimeout(() => {
                this.showFinalResult();
            }, 1500);
        } else {
            this.capturePhotoBtn.disabled = false;
        }
    }
    
    showCountdown(photoNumber, totalPhotos) {
        return new Promise((resolve) => {
            let countdown = 4;
            
            // Show the countdown overlay
            this.countdownOverlay.style.display = 'flex';
            this.countdownPhotoInfo.textContent = `Photo ${photoNumber} of ${totalPhotos}`;
            
            const updateCountdown = () => {
                if (countdown > 0) {
                    // Update the big countdown number
                    this.countdownNumber.textContent = countdown;
                    this.countdownNumber.style.animation = 'none'; // Reset animation
                    setTimeout(() => {
                        this.countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
                    }, 10);
                    
                    // Update countdown text based on number
                    if (countdown === 4) {
                        this.countdownText.textContent = 'Get Ready! 👻';
                    } else if (countdown === 3) {
                        this.countdownText.textContent = 'Strike a Pose! 🎃';
                    } else if (countdown === 2) {
                        this.countdownText.textContent = 'Almost There! 💀';
                    } else if (countdown === 1) {
                        this.countdownText.textContent = 'Say Boo! 📸';
                    }
                    
                    // Update button text
                    this.capturePhotoBtn.textContent = `📸 Photo ${photoNumber}/${totalPhotos} - ${countdown}`;
                    this.capturePhotoBtn.style.background = '#ff6b35';
                    
                    countdown--;
                    setTimeout(updateCountdown, 1000);
                } else {
                    // Hide countdown overlay
                    this.countdownOverlay.style.display = 'none';
                    
                    // Reset button appearance
                    this.capturePhotoBtn.style.background = '';
                    resolve();
                }
            };
            
            updateCountdown();
        });
    }
    
    async takeSinglePhoto() {
        return new Promise((resolve) => {
            // Create flash effect
            this.createFlashEffect();
            
            // Add spooky capture effect
            this.capturePhotoBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.capturePhotoBtn.style.transform = 'scale(1)';
            }, 150);
            
            // Set canvas size to match video dimensions exactly
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Clear the canvas first
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Save the current context state
            this.ctx.save();
            
            // Always use mirror mode - mirror the captured photo to match the preview
            this.ctx.scale(-1, 1);
            this.ctx.translate(-this.canvas.width, 0);
            
            // Capture the photo
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Restore the context state
            this.ctx.restore();
            
            // Apply Nightmare Before Christmas filter effect
            this.applySpookyFilter();
            
            const photoDataUrl = this.canvas.toDataURL('image/jpeg', 0.9);
            this.photos.push({
                id: Date.now(),
                dataUrl: photoDataUrl,
                timestamp: new Date().toISOString()
            });
            
            this.currentPhotoCount++;
            this.updatePhotoGrid();
            this.updateUI();
            
            // Show spooky notification
            const spookyMessages = [
                '🎃 Spook-tacular shot!',
                '👻 Boo-tiful capture!',
                '💀 Frighteningly fabulous!',
                '🕷️ Delightfully dark!',
                '🦇 Wickedly wonderful!'
            ];
            const randomMessage = spookyMessages[Math.floor(Math.random() * spookyMessages.length)];
            this.showNotification(randomMessage, 'success');
            
            // Update button text to show current progress
            this.capturePhotoBtn.textContent = `📸 Take Photo (${this.currentPhotoCount}/${this.maxPhotos})`;
            
            setTimeout(resolve, 500); // Small delay to show the photo was taken
        });
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    applySpookyFilter() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        // Calculate histogram for better auto-exposure
        const histogram = new Array(256).fill(0);
        let totalPixels = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            const luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[luminance]++;
            totalPixels++;
        }
        
        // Calculate mean brightness
        let weightedSum = 0;
        for (let i = 0; i < 256; i++) {
            weightedSum += i * histogram[i];
        }
        const meanBrightness = weightedSum / totalPixels;
        
        // Auto-exposure adjustment based on mean brightness
        let globalExposureAdjustment = 1.0;
        if (meanBrightness < 80) {
            globalExposureAdjustment = 1.5; // Brighten dark images significantly
        } else if (meanBrightness < 120) {
            globalExposureAdjustment = 1.2; // Moderately brighten
        } else if (meanBrightness > 200) {
            globalExposureAdjustment = 0.8; // Darken overexposed images
        }
        
        // Apply enhanced lighting correction and adjustable spooky effect
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Apply global exposure adjustment
            r = Math.min(255, r * globalExposureAdjustment);
            g = Math.min(255, g * globalExposureAdjustment);
            b = Math.min(255, b * globalExposureAdjustment);
            
            // Color temperature correction for better skin tones
            const avgColor = (r + g + b) / 3;
            
            // Detect and correct blue/cool color cast (common in poor lighting)
            if (b > (r + g) / 2 && avgColor > 50) {
                r = Math.min(255, r * 1.08);  // Warm up reds
                g = Math.min(255, g * 1.04);  // Slightly boost greens  
                b = Math.min(255, b * 0.94);  // Reduce blue cast
            }
            
            // Detect and correct yellow/warm cast (from incandescent lighting)
            if (r > b * 1.3 && g > b * 1.2 && avgColor > 50) {
                r = Math.min(255, r * 0.96);  // Reduce excessive warmth
                g = Math.min(255, g * 0.98);
                b = Math.min(255, b * 1.04);  // Add cooler tones
            }
            
            // Adjustable spooky enhancement based on user setting
            const spookyIntensity = this.filterIntensity;
            
            // Only apply spooky filter if intensity > 0
            if (spookyIntensity > 0) {
                // Add warm/orange tint and contrast based on intensity
                r = Math.min(255, r * (1 + spookyIntensity * 0.3) + (spookyIntensity * 8));
                g = Math.min(255, g * (1 + spookyIntensity * 0.1));
                b = Math.min(255, b * (1 + spookyIntensity * 0.05) + (spookyIntensity * 3));
                
                // Adjustable contrast enhancement
                const contrast = 1.0 + (spookyIntensity * 0.3);
                r = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
                g = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
                b = Math.min(255, Math.max(0, (b - 128) * contrast + 128));
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    updateFilterIntensity(value) {
        this.filterIntensity = parseFloat(value);
        const percentage = Math.round(this.filterIntensity * 100);
        
        if (this.filterLabel) {
            if (percentage === 0) {
                this.filterLabel.textContent = `Natural Colors (${percentage}%)`;
            } else if (percentage <= 25) {
                this.filterLabel.textContent = `Light Spooky (${percentage}%)`;
            } else if (percentage <= 50) {
                this.filterLabel.textContent = `Medium Spooky (${percentage}%)`;
            } else {
                this.filterLabel.textContent = `Full Nightmare (${percentage}%)`;
            }
        }
        
        this.showNotification(`🎨 Filter intensity: ${percentage}%`, 'info');
    }
    
    toggleFilterPreview() {
        if (!this.stream) {
            this.showNotification('📹 Start camera first to preview filters!', 'error');
            return;
        }
        
        this.isPreviewMode = !this.isPreviewMode;
        
        if (this.filterPreviewBtn) {
            if (this.isPreviewMode) {
                this.filterPreviewBtn.textContent = '👁️ Stop Preview';
                this.filterPreviewBtn.style.background = 'var(--blood-red)';
                this.startPreviewLoop();
                this.showNotification('👁️ Filter preview active - adjust the slider!', 'info');
            } else {
                this.filterPreviewBtn.textContent = '👁️ Preview Filter';
                this.filterPreviewBtn.style.background = '';
                this.showNotification('👁️ Filter preview stopped', 'info');
            }
        }
    }
    
    startPreviewLoop() {
        if (!this.isPreviewMode || !this.stream) return;
        
        // Capture current frame for preview
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        this.ctx.save();
        this.ctx.scale(-1, 1);
        this.ctx.translate(-this.canvas.width, 0);
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        // Analyze lighting conditions before applying filter
        this.analyzeLightingConditions();
        
        // Apply current filter settings
        this.applySpookyFilter();
        
        // Continue preview loop
        if (this.isPreviewMode) {
            requestAnimationFrame(() => this.startPreviewLoop());
        }
    }
    
    analyzeLightingConditions() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        let totalBrightness = 0;
        let totalPixels = 0;
        let blueSum = 0, redSum = 0, greenSum = 0;
        
        // Sample every 10th pixel for performance
        for (let i = 0; i < data.length; i += 40) { // 40 = 4 channels * 10 pixels
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            totalBrightness += brightness;
            totalPixels++;
            
            redSum += r;
            greenSum += g;
            blueSum += b;
        }
        
        const avgBrightness = totalBrightness / totalPixels;
        const avgRed = redSum / totalPixels;
        const avgGreen = greenSum / totalPixels;
        const avgBlue = blueSum / totalPixels;
        
        // Detect lighting issues and provide feedback (throttled)
        if (!this.lastLightingCheck || Date.now() - this.lastLightingCheck > 3000) {
            this.lastLightingCheck = Date.now();
            
            if (avgBrightness < 60) {
                this.showNotification('💡 Lighting too dark - move closer to a light source!', 'error');
            } else if (avgBrightness > 220) {
                this.showNotification('☀️ Lighting too bright - move away from direct light!', 'error');
            } else if (avgBlue > (avgRed + avgGreen) / 2 && avgBrightness > 50) {
                this.showNotification('🔵 Cool lighting detected - filter will auto-correct colors', 'info');
            } else if (avgRed > avgBlue * 1.4 && avgGreen > avgBlue * 1.3) {
                this.showNotification('🟡 Warm lighting detected - filter will balance colors', 'info');
            } else if (avgBrightness >= 80 && avgBrightness <= 180) {
                this.showNotification('✨ Great lighting! Colors will look natural', 'success');
            }
        }
    }
    
    drawSpookyBackground(ctx, width, height) {
        // Create gradient background
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#0a0a0a');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add spooky pattern overlay
        this.drawSpookyPatterns(ctx, width, height);
        
        // Add subtle texture
        this.addTextureOverlay(ctx, width, height);
    }
    
    drawSpookyPatterns(ctx, width, height) {
        ctx.save();
        
        // Draw swirling mist effect
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#4a154b';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 15; i++) {
            ctx.beginPath();
            const startX = Math.random() * width;
            const startY = Math.random() * height;
            const curves = 3 + Math.random() * 3;
            
            ctx.moveTo(startX, startY);
            for (let j = 0; j < curves; j++) {
                const cpX1 = startX + (Math.random() - 0.5) * 200;
                const cpY1 = startY + (Math.random() - 0.5) * 200;
                const cpX2 = startX + (Math.random() - 0.5) * 200;
                const cpY2 = startY + (Math.random() - 0.5) * 200;
                const endX = startX + (Math.random() - 0.5) * 300;
                const endY = startY + (Math.random() - 0.5) * 300;
                
                ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, endX, endY);
            }
            ctx.stroke();
        }
        
        // Draw spider web corners
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        
        // Top-left corner web
        this.drawSpiderWeb(ctx, 0, 0, 150);
        // Top-right corner web
        this.drawSpiderWeb(ctx, width, 0, 150);
        // Bottom-left corner web  
        this.drawSpiderWeb(ctx, 0, height, 150);
        // Bottom-right corner web
        this.drawSpiderWeb(ctx, width, height, 150);
        
        // Add scattered Halloween elements
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#ff6b35';
        ctx.font = '24px serif';
        
        const spookySymbols = ['🎃', '👻', '🦇', '🕷️', '💀', '🕸️'];
        for (let i = 0; i < 20; i++) {
            const symbol = spookySymbols[Math.floor(Math.random() * spookySymbols.length)];
            const x = Math.random() * width;
            const y = Math.random() * height;
            ctx.fillText(symbol, x, y);
        }
        
        ctx.restore();
    }
    
    drawSpiderWeb(ctx, centerX, centerY, size) {
        ctx.beginPath();
        
        // Determine quadrant and adjust accordingly
        const isRight = centerX > 0;
        const isBottom = centerY > 0;
        
        const startX = isRight ? centerX - size : centerX;
        const startY = isBottom ? centerY - size : centerY;
        const endX = isRight ? centerX : centerX + size;
        const endY = isBottom ? centerY : centerY + size;
        
        // Draw radial lines
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 8;
            const x = centerX + Math.cos(angle) * size * (isRight ? -0.5 : 0.5);
            const y = centerY + Math.sin(angle) * size * (isBottom ? -0.5 : 0.5);
            
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
        }
        
        // Draw concentric web circles
        for (let i = 1; i <= 5; i++) {
            const radius = (size / 5) * i;
            for (let j = 0; j < 8; j++) {
                const angle1 = (j * Math.PI) / 4;
                const angle2 = ((j + 1) * Math.PI) / 4;
                
                const x1 = centerX + Math.cos(angle1) * radius * (isRight ? -0.5 : 0.5);
                const y1 = centerY + Math.sin(angle1) * radius * (isBottom ? -0.5 : 0.5);
                const x2 = centerX + Math.cos(angle2) * radius * (isRight ? -0.5 : 0.5);
                const y2 = centerY + Math.sin(angle2) * radius * (isBottom ? -0.5 : 0.5);
                
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            }
        }
        
        ctx.stroke();
    }
    
    addTextureOverlay(ctx, width, height) {
        // Add noise texture for vintage/spooky feel
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // Add random noise
            const noise = (Math.random() - 0.5) * 30;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));     // Red
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // Green  
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // Blue
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    createFlashEffect() {
        const flashDiv = document.createElement('div');
        flashDiv.className = 'flash-effect';
        document.body.appendChild(flashDiv);
        
        setTimeout(() => {
            document.body.removeChild(flashDiv);
        }, 300);
    }
    
    updateMaxPhotos() {
        this.maxPhotos = parseInt(this.photoCountSelect.value);
        this.updatePhotoGrid();
        this.updateUI();
        
        // Reset if current photos exceed new limit
        if (this.currentPhotoCount > this.maxPhotos) {
            this.resetPhotos();
        }
    }
    
    enableMirrorMode() {
        // Always use mirror mode for selfie camera experience
        this.video.style.transform = 'scaleX(-1)';
    }
    
    updatePhotoGrid() {
        // Clear existing grid
        this.photosGrid.innerHTML = '';
        
        // Create photo slots based on selected count
        for (let i = 0; i < this.maxPhotos; i++) {
            const photoSlot = document.createElement('div');
            photoSlot.className = 'photo-placeholder';
            
            if (i < this.photos.length) {
                // Display captured photo
                const img = document.createElement('img');
                img.src = this.photos[i].dataUrl;
                img.className = 'captured-photo';
                img.alt = `Spooky Photo ${i + 1}`;
                img.addEventListener('click', () => this.enlargePhoto(this.photos[i].dataUrl));
                photoSlot.appendChild(img);
                
                // Add download button for individual photo
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = '💾';
                downloadBtn.className = 'individual-download-btn';
                downloadBtn.style.cssText = `
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: rgba(255, 107, 53, 0.8);
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    cursor: pointer;
                    font-size: 12px;
                `;
                downloadBtn.onclick = () => this.downloadPhoto(this.photos[i], i + 1);
                photoSlot.appendChild(downloadBtn);
            } else {
                // Display placeholder
                const placeholderContent = document.createElement('div');
                placeholderContent.className = 'placeholder-content';
                placeholderContent.innerHTML = `
                    <span class="skull">💀</span>
                    <p>Photo ${i + 1}</p>
                `;
                photoSlot.appendChild(placeholderContent);
            }
            
            this.photosGrid.appendChild(photoSlot);
        }
    }
    
    updateUI() {
        this.photoCounter.textContent = this.currentPhotoCount;
        this.totalPhotos.textContent = this.maxPhotos;
        
        // Update button states
        this.capturePhotoBtn.disabled = !this.stream || this.currentPhotoCount >= this.maxPhotos || this.isCountdownActive;
        this.resetPhotosBtn.disabled = this.currentPhotoCount === 0 && !this.isCountdownActive;
        this.downloadPhotosBtn.disabled = this.currentPhotoCount === 0;
        
        // Update capture button text (only if not in countdown)
        if (!this.isCountdownActive) {
            if (this.currentPhotoCount >= this.maxPhotos) {
                this.capturePhotoBtn.textContent = '✅ Photos Complete';
            } else {
                this.capturePhotoBtn.textContent = `📸 Start Photo Session (${this.currentPhotoCount}/${this.maxPhotos})`;
            }
        }
    }
    
    resetPhotos() {
        // Stop any active countdown
        this.isCountdownActive = false;
        if (this.countdownTimer) {
            clearTimeout(this.countdownTimer);
            this.countdownTimer = null;
        }
        
        // Hide countdown overlay
        this.countdownOverlay.style.display = 'none';
        
        this.photos = [];
        this.currentPhotoCount = 0;
        this.updatePhotoGrid();
        this.updateUI();
        
        // Hide final result and show photos grid
        this.finalResult.style.display = 'none';
        this.photosGrid.style.display = 'grid';
        
        // Reset button appearance
        this.capturePhotoBtn.style.transform = 'scale(1)';
        this.capturePhotoBtn.style.fontSize = '';
        this.capturePhotoBtn.style.background = '';
        this.capturePhotoBtn.textContent = `📸 Take Photo (${this.currentPhotoCount}/${this.maxPhotos})`;
        
        if (this.stream) {
            this.capturePhotoBtn.disabled = false;
        }
        
        this.showNotification('🔄 Photos reset! Ready for a new spooky session!', 'info');
    }
    
    downloadPhoto(photo, index) {
        const link = document.createElement('a');
        link.download = `nightmare-photo-${index}-${Date.now()}.jpg`;
        link.href = photo.dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification(`� IG Story photo ${index} downloaded!`, 'success');
    }
    
    async downloadAllPhotos() {
        if (this.photos.length === 0) return;
        
        // Create a collage of all photos
        const collageCanvas = document.createElement('canvas');
        const collageCtx = collageCanvas.getContext('2d');
        
        // Set 9:16 aspect ratio dimensions
        const canvasWidth = 1080;  // Standard width for mobile
        const canvasHeight = 1920; // 9:16 aspect ratio
        
        collageCanvas.width = canvasWidth;
        collageCanvas.height = canvasHeight;
        
        // Calculate photo dimensions to fit within the 9:16 canvas
        const cols = this.maxPhotos === 2 ? 1 : 2;
        const rows = Math.ceil(this.maxPhotos / cols);
        const spacing = 40;
        const titleHeight = 200;
        
        const availableWidth = canvasWidth - (cols + 1) * spacing;
        const availableHeight = canvasHeight - titleHeight - (rows + 1) * spacing;
        
        const photoWidth = availableWidth / cols;
        const photoHeight = availableHeight / rows;
        
        // Create themed background
        this.drawSpookyBackground(collageCtx, collageCanvas.width, collageCanvas.height);
        
        // Add title with glow effect (scaled for 9:16)
        collageCtx.shadowColor = '#ff6b35';
        collageCtx.shadowBlur = 15;
        collageCtx.fillStyle = '#ff6b35';
        collageCtx.font = 'bold 64px Creepster, cursive';
        collageCtx.textAlign = 'center';
        collageCtx.fillText('🎃 Nightmare Photobooth 🎃', collageCanvas.width / 2, 100);
        
        // Add subtitle
        collageCtx.shadowBlur = 8;
        collageCtx.fillStyle = '#f5f5dc';
        collageCtx.font = '32px Nosifer, cursive';
        collageCtx.fillText('~ Spooky Memories Collection ~', collageCanvas.width / 2, 150);
        collageCtx.shadowBlur = 0;
        
        // Add photos to collage
        let photosLoaded = 0;
        
        for (let i = 0; i < this.photos.length; i++) {
            const img = new Image();
            img.onload = () => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = spacing + col * (photoWidth + spacing);
                const y = titleHeight + spacing + row * (photoHeight + spacing);
                
                // Draw decorative photo frame
                this.drawSpookyPhotoFrame(collageCtx, x, y, photoWidth, photoHeight);
                collageCtx.drawImage(img, x, y, photoWidth, photoHeight);
                
                photosLoaded++;
                
                // If all photos are loaded, save the collage
                if (photosLoaded === this.photos.length) {
                    setTimeout(() => {
                        // Generate file data
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const filename = `nightmare-photobooth-collage-${timestamp}.jpg`;
                        const dataUrl = collageCanvas.toDataURL('image/jpeg', 0.9);
                        
                        // Save to Pictures\Photobooth_ContentServices
                        this.autoSaveCollage(dataUrl, filename);
                        
                        this.showNotification('🎃 Photo collage ready to save!', 'success');
                    }, 100);
                }
            };
            img.src = this.photos[i].dataUrl;
        }
    }

    async showFinalResult() {
        if (this.photos.length === 0) return;
        
        // Hide the photos grid and show the final result
        this.photosGrid.style.display = 'none';
        this.finalResult.style.display = 'block';
        
        // Create the final collage on the canvas
        await this.createFinalCollage();
        
        // Add click event listener to the final canvas for enlargement
        this.finalCanvas.removeEventListener('click', this.handleFinalCanvasClick);
        this.finalCanvas.addEventListener('click', this.handleFinalCanvasClick);
        
        this.showNotification('🎭 Your spooky masterpiece is ready! Click to enlarge!', 'success');
    }

    async createFinalCollage() {
        const collageCtx = this.finalCanvas.getContext('2d');
        
        // Set 9:16 aspect ratio dimensions
        const canvasWidth = 1080;  // Standard width for mobile
        const canvasHeight = 1920; // 9:16 aspect ratio
        
        this.finalCanvas.width = canvasWidth;
        this.finalCanvas.height = canvasHeight;
        
        // Calculate photo dimensions to fit within the 9:16 canvas
        const cols = this.maxPhotos === 2 ? 1 : 2;
        const rows = Math.ceil(this.maxPhotos / cols);
        const spacing = 40;
        const titleHeight = 200;
        
        const availableWidth = canvasWidth - (cols + 1) * spacing;
        const availableHeight = canvasHeight - titleHeight - (rows + 1) * spacing;
        
        const photoWidth = availableWidth / cols;
        const photoHeight = availableHeight / rows;
        
        // Create themed background
        this.drawSpookyBackground(collageCtx, this.finalCanvas.width, this.finalCanvas.height);
        
        // Add title with glow effect (scaled for 9:16)
        collageCtx.shadowColor = '#ff6b35';
        collageCtx.shadowBlur = 15;
        collageCtx.fillStyle = '#ff6b35';
        collageCtx.font = 'bold 64px Creepster, cursive';
        collageCtx.textAlign = 'center';
        collageCtx.fillText('🎃 Nightmare Before Christmas 🎃', this.finalCanvas.width / 2, 100);
        
        // Add subtitle
        collageCtx.shadowBlur = 8;
        collageCtx.fillStyle = '#f5f5dc';
        collageCtx.font = '32px Nosifer, cursive';
        collageCtx.fillText('~ Content Services Halloween 2025 ~', this.finalCanvas.width / 2, 150);
        collageCtx.shadowBlur = 0;
        
        // Add photos to collage
        return new Promise((resolve) => {
            let photosLoaded = 0;
            
            for (let i = 0; i < this.photos.length; i++) {
                const img = new Image();
                img.onload = () => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const x = spacing + col * (photoWidth + spacing);
                    const y = titleHeight + spacing + row * (photoHeight + spacing);
                    
                    // Draw decorative photo frame
                    this.drawSpookyPhotoFrame(collageCtx, x, y, photoWidth, photoHeight);
                    collageCtx.drawImage(img, x, y, photoWidth, photoHeight);
                    
                    photosLoaded++;
                    
                    // If all photos are loaded, save the collage
                    if (photosLoaded === this.photos.length) {
                        // Generate file data
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const filename = `nightmare-photobooth-collage-${timestamp}.jpg`;
                        const dataUrl = this.finalCanvas.toDataURL('image/jpeg', 0.9);
                        
                        // Save to Pictures\Photobooth_ContentServices
                        this.autoSaveCollage(dataUrl, filename);
                        
                        this.showNotification('🎃 Photo collage ready to save!', 'success');
                        resolve();
                    }
                };
                img.src = this.photos[i].dataUrl;
            }
        });
    }

    downloadFinalResult() {
        if (!this.finalCanvas) return;
        
        // Generate file data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `nightmare-photobooth-masterpiece-${timestamp}.jpg`;
        const dataUrl = this.finalCanvas.toDataURL('image/jpeg', 0.9);
        
        // Save to Pictures\Photobooth_ContentServices
        this.autoSaveCollage(dataUrl, filename);
        
        this.showNotification('🎃 Your masterpiece is ready to save!', 'success');
    }
    
    autoSaveCollage(dataUrl, filename) {
        // Create a blob from the data URL
        const blob = this.dataURLToBlob(dataUrl);
        
        try {
            // Use the File System Access API to open a save dialog pointing to Pictures\Photobooth_ContentServices
            if (window.showSaveFilePicker) {
                this.saveWithFileSystemAccessAPI(blob, filename);
            } else {
                // Fallback for browsers that don't support File System Access API
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showNotification('📸 Collage ready! Saved to your downloads folder.', 'success');
                
                // Revoke object URL to free up memory
                setTimeout(() => URL.revokeObjectURL(link.href), 100);
            }
        } catch (error) {
            console.error('Error in autoSaveCollage:', error);
            this.showNotification('⚠️ Save dialog could not be opened. Check console for details.', 'warning');
        }
    }
    
    async saveWithFileSystemAccessAPI(blob, filename) {
        try {
            // Set suggested directory to Pictures/Photobooth_ContentServices
            const options = {
                suggestedName: filename,
                types: [{
                    description: 'JPEG image',
                    accept: {'image/jpeg': ['.jpg']}
                }],
                // Try to suggest the Pictures/Photobooth_ContentServices directory
                startIn: 'pictures'
            };
            
            // Show the file picker dialog pointing to the Pictures folder
            const fileHandle = await window.showSaveFilePicker(options);
            
            // Get a writable stream
            const writableStream = await fileHandle.createWritable();
            
            // Write the blob to the file
            await writableStream.write(blob);
            
            // Close the file
            await writableStream.close();
            
            this.showNotification('📸 Collage saved successfully!', 'success');
        } catch (error) {
            // If user canceled the save dialog, don't show an error
            if (error.name !== 'AbortError') {
                console.error('Error saving file:', error);
                this.showNotification('⚠️ Failed to save collage. Check console for details.', 'error');
            }
        }
    }
    
    dataURLToBlob(dataUrl) {
        // Convert base64 data URL to blob
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], { type: mime });
    }







    startNewSession() {
        // Hide final result and show photos grid
        this.finalResult.style.display = 'none';
        this.photosGrid.style.display = 'grid';
        
        // Remove final canvas click event listener
        if (this.finalCanvas) {
            this.finalCanvas.removeEventListener('click', this.handleFinalCanvasClick);
        }
        
        // Reset the photobooth
        this.resetPhotos();
        
        this.showNotification('🎭 Ready for a new spooky session!', 'info');
    }
    
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Styling for notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#8B0000' : type === 'success' ? '#32cd32' : '#ff6b35'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: 'Butcherman', cursive;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    showTroubleshootingTips() {
        const troubleshootingDiv = document.createElement('div');
        troubleshootingDiv.className = 'troubleshooting-tips';
        troubleshootingDiv.innerHTML = `
            <div class="troubleshooting-content">
                <h3>📱 Camera Troubleshooting Tips</h3>
                <ul>
                    <li>🔒 <strong>Check Permissions:</strong> Allow camera access in your browser</li>
                    <li>🔄 <strong>Refresh Page:</strong> Try reloading the page</li>
                    <li>📷 <strong>Check Camera:</strong> Make sure your camera isn't being used by other apps</li>
                    <li>🌐 <strong>Use HTTPS:</strong> Camera requires secure connection (https://)</li>
                    <li>🖥️ <strong>Try Different Browser:</strong> Chrome, Firefox, or Edge work best</li>
                    <li>🔌 <strong>External Camera:</strong> If using external webcam, check connection</li>
                </ul>
                <button class="close-tips-btn">✕ Close</button>
            </div>
        `;
        
        troubleshootingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            padding: 20px;
            box-sizing: border-box;
        `;
        
        const content = troubleshootingDiv.querySelector('.troubleshooting-content');
        content.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%);
            color: #f5f5dc;
            padding: 30px;
            border-radius: 15px;
            border: 3px solid #ff6b35;
            max-width: 500px;
            width: 100%;
            font-family: 'Butcherman', cursive;
            box-shadow: 0 0 30px rgba(255, 107, 53, 0.5);
        `;
        
        const h3 = content.querySelector('h3');
        h3.style.cssText = `
            color: #ff6b35;
            margin-bottom: 20px;
            text-align: center;
            font-size: 1.5rem;
        `;
        
        const ul = content.querySelector('ul');
        ul.style.cssText = `
            list-style: none;
            padding: 0;
            margin: 0 0 20px 0;
        `;
        
        const lis = content.querySelectorAll('li');
        lis.forEach(li => {
            li.style.cssText = `
                margin-bottom: 10px;
                padding: 8px;
                background: rgba(255, 107, 53, 0.1);
                border-radius: 5px;
                border-left: 3px solid #ff6b35;
            `;
        });
        
        const closeBtn = content.querySelector('.close-tips-btn');
        closeBtn.style.cssText = `
            background: #ff6b35;
            color: #0a0a0a;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-family: inherit;
            font-weight: bold;
            display: block;
            margin: 0 auto;
            transition: all 0.3s ease;
        `;
        
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(troubleshootingDiv);
        });
        
        troubleshootingDiv.addEventListener('click', (e) => {
            if (e.target === troubleshootingDiv) {
                document.body.removeChild(troubleshootingDiv);
            }
        });
        
        document.body.appendChild(troubleshootingDiv);
    }
    
    drawSpookyPhotoFrame(ctx, x, y, width, height) {
        const frameWidth = 8;
        
        // Outer frame - dark
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - frameWidth, y - frameWidth, width + frameWidth * 2, height + frameWidth * 2);
        
        // Middle frame - orange
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(x - frameWidth + 2, y - frameWidth + 2, width + (frameWidth - 2) * 2, height + (frameWidth - 2) * 2);
        
        // Inner frame - dark purple
        ctx.fillStyle = '#4a154b';
        ctx.fillRect(x - frameWidth + 4, y - frameWidth + 4, width + (frameWidth - 4) * 2, height + (frameWidth - 4) * 2);
        
        // Innermost frame - bone white
        ctx.fillStyle = '#f5f5dc';
        ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
        
        // Add corner decorations
        ctx.fillStyle = '#8B0000';
        const cornerSize = 15;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x - frameWidth, y - frameWidth);
        ctx.lineTo(x - frameWidth + cornerSize, y - frameWidth);
        ctx.lineTo(x - frameWidth, y - frameWidth + cornerSize);
        ctx.closePath();
        ctx.fill();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + width + frameWidth, y - frameWidth);
        ctx.lineTo(x + width + frameWidth - cornerSize, y - frameWidth);
        ctx.lineTo(x + width + frameWidth, y - frameWidth + cornerSize);
        ctx.closePath();
        ctx.fill();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x - frameWidth, y + height + frameWidth);
        ctx.lineTo(x - frameWidth + cornerSize, y + height + frameWidth);
        ctx.lineTo(x - frameWidth, y + height + frameWidth - cornerSize);
        ctx.closePath();
        ctx.fill();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + width + frameWidth, y + height + frameWidth);
        ctx.lineTo(x + width + frameWidth - cornerSize, y + height + frameWidth);
        ctx.lineTo(x + width + frameWidth, y + height + frameWidth - cornerSize);
        ctx.closePath();
        ctx.fill();
    }
    


    // Photo enlargement functionality
    enlargePhoto(photoUrl, isCollage = false) {
        if (this.enlargedPhoto && this.photoEnlargeOverlay) {
            this.enlargedPhoto.src = photoUrl;
            
            // If it's the final collage, ensure it fits nicely on screen
            if (isCollage) {
                this.enlargedPhoto.style.maxHeight = '90vh';
                this.enlargedPhoto.style.width = 'auto';
                this.enlargedPhoto.style.objectFit = 'contain';
                this.photoEnlargeOverlay.style.padding = '20px';
            } else {
                // Reset styles for regular photos
                this.enlargedPhoto.style.maxHeight = '';
                this.enlargedPhoto.style.width = '';
                this.enlargedPhoto.style.objectFit = '';
                this.photoEnlargeOverlay.style.padding = '';
            }
            
            this.photoEnlargeOverlay.style.display = 'flex';
            // Add show class after a brief delay for smooth animation
            setTimeout(() => {
                this.photoEnlargeOverlay.classList.add('show');
            }, 10);
            
            // Add keyboard listener for ESC key
            document.addEventListener('keydown', this.handleEnlargeEscKey);
        }
    }
    
    closePhotoEnlargement() {
        if (this.photoEnlargeOverlay) {
            this.photoEnlargeOverlay.classList.remove('show');
            // Hide after animation completes
            setTimeout(() => {
                this.photoEnlargeOverlay.style.display = 'none';
            }, 300);
            
            // Remove keyboard listener
            document.removeEventListener('keydown', this.handleEnlargeEscKey);
        }
    }
    
    handleEnlargeEscKey = (e) => {
        if (e.key === 'Escape') {
            this.closePhotoEnlargement();
        }
    }

    handleFinalCanvasClick = () => {
        if (this.finalCanvas) {
            const canvasDataUrl = this.finalCanvas.toDataURL('image/jpeg', 0.9);
            this.enlargePhoto(canvasDataUrl, true); // Pass true to indicate this is the final collage
        }
    }

    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        // Clean up event listeners
        document.removeEventListener('keydown', this.handleEnlargeEscKey);
        if (this.finalCanvas) {
            this.finalCanvas.removeEventListener('click', this.handleFinalCanvasClick);
        }
    }
}

// Initialize the photobooth when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const photobooth = new NightmarePhotobooth();
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        photobooth.destroy();
    });
    
    // Add some spooky Easter eggs
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.shiftKey) {
            // Secret spooky mode
            document.body.style.filter = 'invert(1) hue-rotate(180deg)';
            setTimeout(() => {
                document.body.style.filter = 'none';
            }, 2000);
        }
    });
    
    // Add floating spooky elements occasionally
    setInterval(() => {
        if (Math.random() < 0.1) { // 10% chance every interval
            createFloatingSpook();
        }
    }, 5000);
    
    function createFloatingSpook() {
        const spooks = ['👻', '🎃', '🦇', '🕷️', '💀'];
        const spook = document.createElement('div');
        spook.textContent = spooks[Math.floor(Math.random() * spooks.length)];
        spook.style.cssText = `
            position: fixed;
            font-size: 2rem;
            pointer-events: none;
            z-index: 1000;
            opacity: 0.7;
            animation: floatAcross 8s linear forwards;
            top: ${Math.random() * window.innerHeight}px;
            left: -50px;
        `;
        
        const floatStyle = document.createElement('style');
        floatStyle.textContent = `
            @keyframes floatAcross {
                from { 
                    transform: translateX(0) rotate(0deg);
                    opacity: 0.7;
                }
                to { 
                    transform: translateX(${window.innerWidth + 100}px) rotate(360deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(floatStyle);
        
        document.body.appendChild(spook);
        
        setTimeout(() => {
            if (spook.parentNode) {
                spook.parentNode.removeChild(spook);
            }
            if (floatStyle.parentNode) {
                floatStyle.parentNode.removeChild(floatStyle);
            }
        }, 8000);
    }
});