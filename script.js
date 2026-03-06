document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('videoElement');
    const captureBtn = document.getElementById('captureBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const countdownEl = document.getElementById('countdown');
    const flashEl = document.getElementById('flash');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const statusMessage = document.getElementById('statusMessage');
    const stripContainer = document.getElementById('stripContainer');

    // Core state
    let stream = null;
    let currentFilter = 'none';
    let capturedFrames = [];
    const NUM_PHOTOS = 5;
    const COUNTDOWN_SECONDS = 3;

    // Configuration for the final strip
    const stripConfig = {
        width: 600,
        photoWidth: 540,
        photoHeight: 405, // 4:3 aspect ratio
        paddingX: 30,
        paddingYTop: 40,
        paddingYBetween: 20,
        paddingYBottom: 120, // Space for logo/text
        bgColor: '#fdf5e6',
        textColor: '#2d2426'
    };

    // Calculate total height: padding top + (3 * photo height) + (2 * spacing) + padding bottom
    stripConfig.height = stripConfig.paddingYTop +
        (NUM_PHOTOS * stripConfig.photoHeight) +
        ((NUM_PHOTOS - 1) * stripConfig.paddingYBetween) +
        stripConfig.paddingYBottom;

    // Initialize Camera
    async function initCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 960 }
                },
                audio: false
            });
            video.srcObject = stream;
        } catch (err) {
            console.error("Camera access denied or unavailable", err);
            statusMessage.textContent = "Error: Camera access denied or unavailable.";
            statusMessage.style.color = "#ff6b6b";
            captureBtn.disabled = true;
        }
    }

    // Handle Filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update UI
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update state and video element
            currentFilter = e.target.dataset.filter;
            video.style.filter = currentFilter;
        });
    });

    // Capture Process
    async function startCaptureSequence() {
        captureBtn.disabled = true;
        filterBtns.forEach(btn => btn.disabled = true);
        capturedFrames = [];

        // Remove placeholder if present
        const placeholder = document.querySelector('.placeholder-strip');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        // Clear any previous canvas in the container
        const oldCanvas = stripContainer.querySelector('canvas');
        if (oldCanvas) {
            oldCanvas.remove();
        }

        for (let i = 0; i < NUM_PHOTOS; i++) {
            statusMessage.textContent = `Pose ${i + 1} of ${NUM_PHOTOS}... Get ready!`;
            await runCountdown();
            triggerFlash();
            captureFrame();
            await sleep(500); // Wait a bit before next countdown
        }

        statusMessage.textContent = "Developing...";
        await sleep(800);

        generatePhotoStrip();

        statusMessage.textContent = "Magnifique! Your souvenir is ready.";
        captureBtn.disabled = false;
        downloadBtn.disabled = false;
        filterBtns.forEach(btn => btn.disabled = false);
    }

    function runCountdown() {
        return new Promise(resolve => {
            let count = COUNTDOWN_SECONDS;
            countdownEl.textContent = count;
            countdownEl.classList.remove('hidden');

            const interval = setInterval(() => {
                count--;
                if (count > 0) {
                    countdownEl.textContent = count;
                    // Reset animation
                    countdownEl.style.animation = 'none';
                    countdownEl.offsetHeight; /* trigger reflow */
                    countdownEl.style.animation = null;
                } else {
                    clearInterval(interval);
                    countdownEl.classList.add('hidden');
                    resolve();
                }
            }, 1000);
        });
    }

    function triggerFlash() {
        flashEl.classList.remove('fade-out');
        flashEl.classList.add('active');

        setTimeout(() => {
            flashEl.classList.remove('active');
            flashEl.classList.add('fade-out');
        }, 50);
    }

    function captureFrame() {
        // We capture to an off-screen canvas at the video's actual resolution
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        // Mirror the canvas horizontally to match the video element's mirror effect
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        // Apply current filter before drawing
        // Because canvas filter needs standard CSS filters
        // The data-filter already holds valid CSS filters or "none"
        if (currentFilter !== 'none') {
            ctx.filter = currentFilter;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Store the captured image as an Image object for later rendering
        const img = new Image();
        img.src = canvas.toDataURL('image/jpeg', 0.9);
        capturedFrames.push(img);
    }

    function generatePhotoStrip() {
        const stripCanvas = document.createElement('canvas');
        stripCanvas.width = stripConfig.width;
        stripCanvas.height = stripConfig.height;
        const ctx = stripCanvas.getContext('2d');

        // Draw background
        ctx.fillStyle = stripConfig.bgColor;
        ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

        // Ensure all images are loaded before drawing (they are data URLs, so they load sync mostly, but let's be safe)
        let loadedCount = 0;

        capturedFrames.forEach((img, index) => {
            img.onload = () => {
                loadedCount++;
                // Calculate position
                const yPos = stripConfig.paddingYTop + (index * (stripConfig.photoHeight + stripConfig.paddingYBetween));

                // Draw a slight dark border behind the photo for a realistic look
                ctx.fillStyle = '#111';
                ctx.fillRect(stripConfig.paddingX - 2, yPos - 2, stripConfig.photoWidth + 4, stripConfig.photoHeight + 4);

                // Calculate crop to maintain 4:3 aspect ratio
                // Our target aspect ratio is 4:3 (e.g., 540x405)
                const sourceAspect = img.width / img.height;
                const targetAspect = stripConfig.photoWidth / stripConfig.photoHeight;

                let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

                if (sourceAspect > targetAspect) {
                    // source is wider, crop sides
                    sWidth = img.height * targetAspect;
                    sx = (img.width - sWidth) / 2;
                } else if (sourceAspect < targetAspect) {
                    // source is taller, crop top/bottom
                    sHeight = img.width / targetAspect;
                    sy = (img.height - sHeight) / 2;
                }

                // Draw image
                ctx.drawImage(img, sx, sy, sWidth, sHeight, stripConfig.paddingX, yPos, stripConfig.photoWidth, stripConfig.photoHeight);

                // If all frames are drawn, draw the text and display the canvas
                if (loadedCount === NUM_PHOTOS) {
                    finalizeStrip(stripCanvas, ctx);
                }
            };

            // If already loaded
            if (img.complete) {
                img.onload();
            }
        });
    }

    function finalizeStrip(canvas, ctx) {
        // Draw the retro text at the bottom
        ctx.fillStyle = stripConfig.textColor;
        ctx.textAlign = 'center';

        // Get the bottom center coordinate
        const bottomY = stripConfig.height - 40;
        const centerX = stripConfig.width / 2;

        ctx.font = 'italic 50px "Great Vibes", cursive, serif';
        ctx.fillText('The Photo Booth', centerX, bottomY - 25);

        ctx.font = '20px "Playfair Display", serif';
        const date = new Date().toLocaleDateString('fr-FR');
        ctx.fillText(`Paris - ${date}`, centerX, bottomY + 10);

        // Add a subtle vintage overlay (noise/sepia tone) to the whole strip 
        // to make it look printed
        ctx.fillStyle = 'rgba(212, 175, 55, 0.05)'; // slight gold tint
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Display in UI
        stripContainer.appendChild(canvas);

        // Setup download button
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.download = `photostrip_paris_${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        };
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    captureBtn.addEventListener('click', startCaptureSequence);

    // Initialize
    initCamera();
});
