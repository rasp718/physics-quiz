let quizData = [];
let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let streak = 0;
let pdfDoc = null;

pdfjsLib.getDocument('slides.pdf').promise.then(function(pdfDoc_) {
    pdfDoc = pdfDoc_;
    console.log("slides.pdf loaded! Pages: " + pdfDoc.numPages);
}).catch(() => console.log("No slides.pdf found."));

window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.classList.add('splash-fade');
        setTimeout(() => splash.style.display = 'none', 400); 
    }, 1200);
});

const setupContainer = document.getElementById('setup-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const quizAnimWrapper = document.getElementById('quiz-anim-wrapper');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const startBtn = document.getElementById('start-btn');
const explanationContainer = document.getElementById('explanation-container');
const explanationText = document.getElementById('explanation-text');

// Slide Modal & Settings UI
const viewSlideBtn = document.getElementById('view-slide-btn');
const slideModal = document.getElementById('slide-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const pdfCanvas = document.getElementById('pdf-render-canvas');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiKeyInput = document.getElementById('api-key-input');

// AI UI
const aiTutorBtn = document.getElementById('ai-tutor-btn');
const aiExplanationBox = document.getElementById('ai-explanation-box');

const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const streakDisplay = document.getElementById('streak-display');
const streakCount = document.getElementById('streak-count');
const fileInput = document.getElementById('file-input');
const themeToggle = document.getElementById('theme-toggle');

// --- THEME LOGIC ---
let isLightMode = false;
if (localStorage.getItem('theme') === 'light') {
    document.body.setAttribute('data-theme', 'light');
    themeToggle.innerText = '🌙';
    isLightMode = true;
}

themeToggle.addEventListener('click', () => {
    isLightMode = !isLightMode;
    if (isLightMode) {
        document.body.setAttribute('data-theme', 'light');
        themeToggle.innerText = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        document.body.removeAttribute('data-theme'); 
        themeToggle.innerText = '☀️';
        localStorage.setItem('theme', 'dark');
    }
});

// --- SETTINGS LOGIC ---
settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = localStorage.getItem('nvidia_api_key') || '';
    settingsModal.classList.remove('hidden');
});
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', () => {
    localStorage.setItem('nvidia_api_key', apiKeyInput.value.trim());
    settingsModal.classList.add('hidden');
});

// --- FULLSCREEN HELPER FUNCTIONS ---
function enterFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(() => {}); } 
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
}

function exitFullScreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) { document.exitFullscreen().catch(() => {}); } 
        else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
    }
}

// --- MODAL LOGIC ---
closeModalBtn.addEventListener('click', () => {
    slideModal.classList.add('hidden');
    exitFullScreen();
});

slideModal.addEventListener('click', (e) => {
    if (e.target === slideModal || e.target.classList.contains('modal-content')) {
        slideModal.classList.add('hidden');
        exitFullScreen();
    }
});

// --- FILE UPLOAD ---
fetch('questions.json').then(res => res.json()).then(data => { quizData = data; startBtn.classList.remove('hidden'); }).catch(() => {});

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('subject-title').innerText = file.name.replace('.json', '').toUpperCase();
    document.getElementById('subject-subtitle').innerText = "Data loaded. Ready to begin.";
    document.getElementById('upload-label').innerHTML = `<span class="icon">✅</span> Loaded: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try { quizData = JSON.parse(e.target.result); startBtn.classList.remove('hidden'); } 
        catch (err) { alert("Error: Invalid JSON."); }
    };
    reader.readAsText(file);
});

startBtn.onclick = () => {
    startBtn.classList.add('is-squished');
    setTimeout(() => startQuiz(), 150);
};

document.getElementById('restart-btn').onclick = () => location.reload();
nextBtn.onclick = () => {
    nextBtn.classList.add('is-squished');
    setTimeout(() => {
        nextBtn.classList.remove('is-squished');
        loadNextQuestion();
    }, 150);
};

function triggerHaptic(type) {
    if (!window.navigator || !window.navigator.vibrate) return;
    if (type === 'correct') navigator.vibrate([30, 50, 30]); 
    else navigator.vibrate([100, 50, 100]);
}

function startQuiz() {
    if (!quizData || quizData.length < 10) return alert("Needs 10+ questions.");
    currentQuiz = [...quizData].sort(() => 0.5 - Math.random()).slice(0, 10);
    currentQuestionIndex = 0; score = 0; streak = 0;
    
    setupContainer.classList.add('hidden');
    quizContainer.classList.remove('hidden');
    showQuestion();
}

function showQuestion() {
    explanationContainer.classList.add('hidden');
    viewSlideBtn.classList.add('hidden');
    aiTutorBtn.classList.add('hidden');
    aiExplanationBox.classList.add('hidden');
    aiExplanationBox.innerText = ''; // Clear previous AI output
    nextBtn.classList.add('hidden');
    
    quizAnimWrapper.className = 'slide-in-right';
    
    const q = currentQuiz[currentQuestionIndex];
    questionText.innerText = q.question;
    optionsContainer.innerHTML = '';

    const progPercent = ((currentQuestionIndex) / 10) * 100;
    progressBar.style.width = progPercent + "%";
    progressText.innerText = `${currentQuestionIndex + 1} of 10`;

    // PREPARE SLIDE RENDERING 
    if (q.page && pdfDoc) {
        viewSlideBtn.onclick = () => {
            slideModal.classList.remove('hidden');
            enterFullScreen(); 
            
            pdfDoc.getPage(q.page).then(function(page) {
                const ctx = pdfCanvas.getContext('2d');
                const viewport = page.getViewport({ scale: 2.0 }); 
                
                pdfCanvas.height = viewport.height;
                pdfCanvas.width = viewport.width;

                const renderContext = { canvasContext: ctx, viewport: viewport };
                page.render(renderContext);
            });
        };
    } else {
        viewSlideBtn.onclick = null;
    }

    q.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.innerText = option;
        btn.className = 'option-btn 3d-btn deal-anim';
        btn.style.setProperty('--i', index); 
        
        btn.onclick = () => {
            btn.classList.add('is-squished');
            setTimeout(() => {
                btn.classList.remove('is-squished');
                checkAnswer(index, q.answer, btn, q);
            }, 100);
        };
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selected, correct, btn, q) {
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(b => {
        b.disabled = true;
        b.classList.remove('deal-anim'); 
    });

    if (selected === correct) {
        btn.classList.add('correct', 'pulse-bounce');
        score++; streak++;
        triggerHaptic('correct');
        if(streak >= 2) {
            streakDisplay.classList.remove('hidden');
            streakCount.innerText = streak;
            streakDisplay.style.animation = 'none';
            streakDisplay.offsetHeight; 
            streakDisplay.style.animation = null;
        }
    } else {
        btn.classList.add('wrong', 'shake');
        buttons[correct].classList.add('correct');
        streak = 0;
        streakDisplay.classList.add('hidden');
        triggerHaptic('wrong');
    }

    progressBar.style.width = (((currentQuestionIndex + 1) / 10) * 100) + "%";
    explanationText.innerText = q.explanation || "No explanation provided.";
    
    // REVEAL BUTTONS
    if (q.page && pdfDoc) viewSlideBtn.classList.remove('hidden');
    
    // SETUP AI BUTTON
    aiTutorBtn.classList.remove('hidden');
    aiTutorBtn.onclick = () => fetchAIExplanation(q);

    explanationContainer.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
}

// --- NVIDIA NIM AI INTEGRATION ---
async function fetchAIExplanation(q) {
    const apiKey = localStorage.getItem('nvidia_api_key');
    if (!apiKey) {
        settingsModal.classList.remove('hidden');
        return;
    }

    aiTutorBtn.innerText = 'Thinking...';
    aiTutorBtn.disabled = true;
    aiExplanationBox.innerText = '';
    aiExplanationBox.classList.remove('hidden');

    // 1. Secretly read the text directly off the PDF slide!
    let slideText = "";
    if (q.page && pdfDoc) {
        try {
            const page = await pdfDoc.getPage(q.page);
            const textContent = await page.getTextContent();
            // Join all the extracted text pieces into one paragraph
            slideText = textContent.items.map(item => item.str).join(' ');
        } catch (err) {
            console.warn("Could not extract text from slide", err);
        }
    }

    // 2. Build a smarter prompt that FORCES the AI to use the slide text
    let promptText = `Question: ${q.question}\nCorrect Answer: ${q.options[q.answer]}\nBrief Explanation: ${q.explanation}\n`;
    
    if (slideText) {
        promptText += `\nClass Slide Content (Page ${q.page}):\n"${slideText}"\n`;
    }

    promptText += `\nPlease act as a friendly medical physics professor. Using PRIMARILY the Class Slide Content provided above, explain the underlying concept deeper. Keep it very easy to understand in exactly 3 to 4 short sentences. Do not use outside information that contradicts the slide.`;

    try {
        // 👇 PASTE YOUR CLOUDFLARE WORKER URL HERE 👇
        const myProxyUrl = "https://nvidia-proxy.rasp-bklyn.workers.dev";

        const response = await fetch(myProxyUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "meta/llama-3.1-8b-instruct",
                messages: [
                    { role: "system", content: "You are a strictly factual medical physics tutor. Base your explanations on the provided slide content." },
                    { role: "user", content: promptText }
                ],
                max_tokens: 150,
                temperature: 0.2 // Lowered temperature makes the AI strictly stick to the facts and stop hallucinating!
            })
        });

        const data = await response.json();
        
        if (response.ok && data.choices && data.choices.length > 0) {
            aiExplanationBox.innerText = "✨ " + data.choices[0].message.content.trim();
        } else {
            console.error("API Error:", data);
            aiExplanationBox.innerText = "Error: Invalid API key or model issue. Please check your settings.";
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        aiExplanationBox.innerText = "Connection error. Ensure you are connected to the internet.";
    }

    aiTutorBtn.innerText = '✨ AI Tutor';
    aiTutorBtn.disabled = false;
}

function loadNextQuestion() {
    quizAnimWrapper.className = 'slide-out-left';
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < 10) showQuestion();
        else showResults();
    }, 250); 
}

function showResults() {
    quizContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    document.getElementById('score').innerText = score;
    
    const msg = document.getElementById('result-message');
    const confettiColors = isLightMode ? ['#007AFF', '#34C759', '#FF9F0A'] : ['#0A84FF', '#32D74B', '#FF9F0A']; 

    if (score >= 8) {
        msg.innerText = "Excellent.";
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: confettiColors });
    } else if (score >= 5) msg.innerText = "Good effort.";
    else msg.innerText = "Keep practicing.";
}

// --- AUTO-OPEN SLIDE ON PHONE ROTATION ---
window.matchMedia("(orientation: landscape)").addEventListener("change", function(e) {
    if (quizContainer.classList.contains('hidden')) return; 
    const q = currentQuiz[currentQuestionIndex];
    if (!q || !q.page || !pdfDoc) return; 
    
    if (e.matches) {
        if (slideModal.classList.contains('hidden') && viewSlideBtn.onclick) viewSlideBtn.onclick(); 
    } else {
        if (!slideModal.classList.contains('hidden')) closeModalBtn.click();
    }
});