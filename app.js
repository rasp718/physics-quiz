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

const viewSlideBtn = document.getElementById('view-slide-btn');
const slideModal = document.getElementById('slide-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const pdfCanvas = document.getElementById('pdf-render-canvas');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiKeyInput = document.getElementById('api-key-input');

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

// --- AI QUIZ GENERATOR LOGIC ---
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const aiLoadingText = document.getElementById('ai-loading-text');

generateQuizBtn.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('nvidia_api_key');
    if (!apiKey) {
        settingsModal.classList.remove('hidden');
        return;
    }

    if (!pdfDoc) {
        alert("Wait a second, slides.pdf is still loading or missing!");
        return;
    }

    // UI Updates
    aiLoadingText.classList.remove('hidden');
    generateQuizBtn.disabled = true;
    generateQuizBtn.innerHTML = "Generating... (takes up to 1 min)";

    try {
        let extractedText = "";
        // Now loops through the entire PDF automatically
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extractedText += `\n--- Page ${i} ---\n${pageText}\n`;
        }

        const promptText = `
You are an expert medical physics exam writer creating a multiple choice quiz. 
Read the following slide text and generate exactly 10 multiple-choice questions.

RULES FOR QUESTIONS:
1. Make the correct answer unambiguously clear.
2. The 3 incorrect options (distractors) must be plausible but definitively wrong.
3. Do NOT make choices that are too similar or overlapping. Ensure no choices are duplicated.
4. Return ONLY a valid JSON array. Do not include any conversational text, and do not use markdown code blocks like \`\`\`json.

Each object in the array must match this exact format:
{
  "question": "Question text here?",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "answer": 0,
  "explanation": "Brief explanation here.",
  "page": 5
}

Slide Text:
${extractedText}
        `;

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
                    { role: "system", content: "You output strict, raw JSON arrays only." },
                    { role: "user", content: promptText }
                ],
                max_tokens: 3000, // Increased because 10 questions takes more tokens
                temperature: 0.2
            })
        });

        const data = await response.json();
        
        if (response.ok && data.choices && data.choices.length > 0) {
            let aiOutput = data.choices[0].message.content.trim();
            
            const jsonMatch = aiOutput.match(/\[[\s\S]*\]/); 
            if (!jsonMatch) throw new Error("No JSON array found in AI response.");
            
            quizData = JSON.parse(jsonMatch[0]);
            
            document.getElementById('subject-title').innerText = "AI QUIZ READY";
            document.getElementById('subject-subtitle').innerText = `${quizData.length} fresh questions generated!`;
            
            aiLoadingText.classList.add('hidden');
            generateQuizBtn.innerHTML = "✨ Generated!";
            startBtn.classList.remove('hidden'); 
        } else {
            throw new Error("API returned an error");
        }
    } catch (err) {
        console.error("AI Generation Error:", err);
        alert("Failed to generate quiz. Make sure your API key is correct and try again.");
        aiLoadingText.classList.add('hidden');
        generateQuizBtn.disabled = false;
        generateQuizBtn.innerHTML = '<span class="icon">✨</span> Generate Quiz';
    }
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
    if (!quizData || quizData.length === 0) return alert("No questions loaded.");
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
    aiExplanationBox.innerText = ''; 
    nextBtn.classList.add('hidden');
    
    quizAnimWrapper.className = 'slide-in-right';
    
    const q = currentQuiz[currentQuestionIndex];
    questionText.innerText = q.question;
    optionsContainer.innerHTML = '';

    const progPercent = (currentQuestionIndex / currentQuiz.length) * 100;
    progressBar.style.width = progPercent + "%";
    progressText.innerText = `${currentQuestionIndex + 1} of ${currentQuiz.length}`;

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

    progressBar.style.width = (((currentQuestionIndex + 1) / currentQuiz.length) * 100) + "%";
    explanationText.innerText = q.explanation || "No explanation provided.";
    
    if (q.page && pdfDoc) viewSlideBtn.classList.remove('hidden');
    
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

    let slideText = "";
    if (q.page && pdfDoc) {
        try {
            const page = await pdfDoc.getPage(q.page);
            const textContent = await page.getTextContent();
            slideText = textContent.items.map(item => item.str).join(' ');
        } catch (err) {
            console.warn("Could not extract text from slide", err);
        }
    }

    let promptText = `Question: ${q.question}\nCorrect Answer: ${q.options[q.answer]}\nBrief Explanation: ${q.explanation}\n`;
    
    if (slideText) {
        promptText += `\nClass Slide Content (Page ${q.page}):\n"${slideText}"\n`;
    }

    // Stripped of the "roleplay" instructions and asked to be concise
    promptText += `\nExplain the underlying concept concisely based PRIMARILY on the Class Slide Content provided above. Keep it to exactly 2 to 3 short, direct sentences. Do NOT use conversational filler, greetings, or roleplay phrases like "Ok class" or "Let's look at". Just provide the factual explanation.`;

    try {
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
                    { role: "system", content: "You are a strictly factual, highly concise tutor. Do not use conversational filler." },
                    { role: "user", content: promptText }
                ],
                max_tokens: 150,
                temperature: 0.2 
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
        if (currentQuestionIndex < currentQuiz.length) showQuestion();
        else showResults();
    }, 250); 
}

function showResults() {
    quizContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    document.getElementById('score').innerText = score;
    document.getElementById('score-total-text').innerText = `/${currentQuiz.length}`;
    
    const msg = document.getElementById('result-message');
    const confettiColors = isLightMode ? ['#007AFF', '#34C759', '#FF9F0A'] : ['#0A84FF', '#32D74B', '#FF9F0A']; 

    if (score >= currentQuiz.length * 0.8) {
        msg.innerText = "Excellent.";
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: confettiColors });
    } else if (score >= currentQuiz.length * 0.5) msg.innerText = "Good effort.";
    else msg.innerText = "Keep practicing.";
}

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