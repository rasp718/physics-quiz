let quizData = [];
let currentQuiz = [];
let currentQuestionIndex = 0;
let userAnswers = []; // Tracks selected index for each question
let isNavigatingBack = false;
let focusedOptionIndex = -1; // Tracks keyboard navigation selection

let pdfDoc = null;
let justGeneratedQuestions = [];

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
const explanationContainer = document.getElementById('explanation-container');
const explanationText = document.getElementById('explanation-text');

const startActions = document.getElementById('start-actions');
const start10Btn = document.getElementById('start-10-btn');
const startAllBtn = document.getElementById('start-all-btn');
const allCountSpan = document.getElementById('all-count');

const navActions = document.getElementById('nav-actions');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const retryIncorrectBtn = document.getElementById('retry-incorrect-btn');

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

// --- EXPORT FUNCTION ---
const exportCard = document.getElementById('export-card');
const exportBankBtn = document.getElementById('export-bank-btn');
exportBankBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(quizData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "updated_questions.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});


// --- KEYBOARD NAVIGATION ---
document.addEventListener('keydown', (e) => {
    // Ignore keystrokes if the user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Ignore if not in the active quiz or result screens
    if (quizContainer.classList.contains('hidden') && resultContainer.classList.contains('hidden')) return;

    const options = Array.from(optionsContainer.querySelectorAll('.option-btn'));
    const isAnswered = !nextBtn.classList.contains('hidden');

    if (e.key === 'ArrowRight') {
        if (!quizContainer.classList.contains('hidden') && isAnswered) {
            loadNextQuestion();
        } else if (!resultContainer.classList.contains('hidden')) {
            document.getElementById('restart-btn').click();
        }
    } 
    else if (e.key === 'ArrowLeft') {
        if (!quizContainer.classList.contains('hidden') && currentQuestionIndex > 0) {
            loadPreviousQuestion();
        }
    } 
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); // Stop window from scrolling
        
        // Only allow up/down if we are actively answering a question
        if (!quizContainer.classList.contains('hidden') && !isAnswered && options.length > 0) {
            if (e.key === 'ArrowDown') {
                focusedOptionIndex = (focusedOptionIndex + 1) % options.length;
            } else if (e.key === 'ArrowUp') {
                focusedOptionIndex = (focusedOptionIndex - 1 + options.length) % options.length;
            }
            
            // Update visual glow
            options.forEach((opt, idx) => {
                opt.classList.toggle('keyboard-focus', idx === focusedOptionIndex);
            });
        }
    } 
    else if (e.key === 'Enter') {
        e.preventDefault();
        
        if (!quizContainer.classList.contains('hidden')) {
            if (isAnswered) {
                // If already answered, Enter acts as "Continue"
                nextBtn.click();
            } else if (focusedOptionIndex >= 0 && focusedOptionIndex < options.length) {
                // If not answered and an option is highlighted, Enter acts as "Select"
                options[focusedOptionIndex].click();
            }
        } else if (!resultContainer.classList.contains('hidden')) {
            // If on the result screen, Enter acts as "Main Menu"
            document.getElementById('restart-btn').click();
        }
    }
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


// --- FILE UPLOAD & STARTUP ---
fetch('questions.json').then(res => res.json()).then(data => { 
    quizData = data; 
    document.getElementById('subject-subtitle').innerText = `${quizData.length} questions loaded.`;
    allCountSpan.innerText = quizData.length;
    startActions.classList.remove('hidden'); 
    exportCard.classList.remove('hidden');
}).catch(() => {});

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('subject-title').innerText = file.name.replace('.json', '').toUpperCase();
    document.getElementById('upload-label').innerHTML = `Loaded: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try { 
            quizData = JSON.parse(e.target.result); 
            document.getElementById('subject-subtitle').innerText = `${quizData.length} questions loaded.`;
            allCountSpan.innerText = quizData.length;
            startActions.classList.remove('hidden'); 
            exportCard.classList.remove('hidden');
        } 
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

    aiLoadingText.classList.remove('hidden');
    generateQuizBtn.disabled = true;
    generateQuizBtn.innerHTML = "Generating... (takes ~30s)";

    try {
        let extractedText = "";
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extractedText += `\n--- Page ${i} ---\n${pageText}\n`;
        }

        let existingQuestionsStr = "";
        if (quizData.length > 0) {
            const allQs = quizData.map(q => q.question);
            existingQuestionsStr = `\nAVOIDANCE RULE: Do NOT generate questions similar to these existing ones:\n${allQs.map(q => "- " + q).join('\n')}\n`;
        }

        const promptText = `
You are an expert medical physics exam writer. Create a 10-question multiple-choice quiz based on the provided slides.

CRITICAL LOGIC RULES:
1. NO SPOILERS: Never include hints about the answer format in the question text.
2. QUESTION PURITY: The question should be a clean, direct inquiry. 
3. NO COMBINATION OPTIONS: NEVER use "Both A and B", "All of the above", or "None of the above" as options. Every option must be a distinct, single concept.
4. DISTRACTOR QUALITY: Distractors must be scientific terms found in the slides but incorrect for this specific question. They must not overlap or contradict in confusing ways.
5. FORMATTING: You MUST use HTML for math. Subscripts: z<sub>1</sub>. Superscripts/Exponents: A<sup>2</sup>. Greek letters: &mu;. Do not leave raw ^2 symbols for math formulas.
6. SELF-REVIEW: First, write a brief "SELF-REVIEW" evaluating your 10 questions for logical flaws, missing math formatting, and factual accuracy.
7. OUTPUT FORMAT: After the self-review, wrap the final JSON array strictly inside <FINAL_JSON> and </FINAL_JSON> tags. The JSON must have keys: "question", "options" (array of 4 strings), "answer" (integer 0-3), "explanation", and "page".
${existingQuestionsStr}

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
                model: "meta/llama-3.3-70b-instruct", 
                messages: [
                    { role: "system", content: "You strictly follow instructions. Write a self-review first, then output the final JSON array wrapped in <FINAL_JSON> tags." },
                    { role: "user", content: promptText }
                ],
                max_tokens: 3500,
                temperature: 0.5 
            })
        });

        const data = await response.json();
        
        if (response.ok && data.choices && data.choices.length > 0) {
            let aiOutput = data.choices[0].message.content.trim();
            
            const jsonMatch = aiOutput.match(/<FINAL_JSON>([\s\S]*?)<\/FINAL_JSON>/); 
            let finalJsonString = "";
            if (jsonMatch) {
                finalJsonString = jsonMatch[1].trim();
            } else {
                const fallbackMatch = aiOutput.match(/\[[\s\S]*\]/);
                if (!fallbackMatch) throw new Error("No JSON array found in AI response.");
                finalJsonString = fallbackMatch[0].trim();
            }
            
            const newQuestions = JSON.parse(finalJsonString);
            
            const normalize = str => str.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim();
            const existingNormalized = quizData.map(q => normalize(q.question));
            
            let addedCount = 0;
            justGeneratedQuestions = []; 
            
            newQuestions.forEach(q => {
                const normQ = normalize(q.question);
                if (!existingNormalized.includes(normQ)) {
                    quizData.push(q);
                    justGeneratedQuestions.push(q); 
                    existingNormalized.push(normQ);
                    addedCount++;
                }
            });
            
            document.getElementById('subject-title').innerText = "AI Quiz Ready";
            document.getElementById('subject-subtitle').innerText = `Added ${addedCount} new unique questions.`;
            allCountSpan.innerText = quizData.length;
            
            aiLoadingText.classList.add('hidden');
            generateQuizBtn.innerHTML = "Generate 10 More";
            generateQuizBtn.disabled = false;
            exportCard.classList.remove('hidden'); 
            startActions.classList.remove('hidden'); 
        } else {
            throw new Error("API returned an error");
        }
    } catch (err) {
        console.error("AI Generation Error:", err);
        alert("Failed to generate quiz. Check the console and your API key.");
        aiLoadingText.classList.add('hidden');
        generateQuizBtn.disabled = false;
        generateQuizBtn.innerHTML = 'Generate Questions';
    }
});


start10Btn.onclick = () => {
    start10Btn.classList.add('is-squished');
    setTimeout(() => startQuiz('10'), 150);
};

startAllBtn.onclick = () => {
    startAllBtn.classList.add('is-squished');
    setTimeout(() => startQuiz('all'), 150);
};

document.getElementById('restart-btn').onclick = () => {
    document.getElementById('restart-btn').classList.add('is-squished');
    setTimeout(() => {
        document.getElementById('restart-btn').classList.remove('is-squished');
        resultContainer.classList.add('hidden');
        setupContainer.classList.remove('hidden');
        start10Btn.classList.remove('is-squished');
        startAllBtn.classList.remove('is-squished');
        document.getElementById('subject-subtitle').innerText = `${quizData.length} questions loaded.`;
        allCountSpan.innerText = quizData.length;
    }, 150);
};

// Button listeners for navigation
prevBtn.onclick = () => loadPreviousQuestion();
nextBtn.onclick = () => loadNextQuestion();

function triggerHaptic(type) {
    if (!window.navigator || !window.navigator.vibrate) return;
    if (type === 'correct') navigator.vibrate([30, 50, 30]); 
    else navigator.vibrate([100, 50, 100]);
}

function startQuiz(mode) {
    if (!quizData || quizData.length === 0) return alert("No questions loaded.");
    
    if (mode === 'all') {
        currentQuiz = [...quizData].sort(() => 0.5 - Math.random());
    } else if (mode === '10') {
        if (justGeneratedQuestions.length > 0) {
            currentQuiz = [...justGeneratedQuestions];
            const remainingNeeded = 10 - currentQuiz.length;
            
            if (remainingNeeded > 0) {
                const olderQuestions = quizData.filter(q => !justGeneratedQuestions.includes(q));
                const randomFill = olderQuestions.sort(() => 0.5 - Math.random()).slice(0, remainingNeeded);
                currentQuiz = currentQuiz.concat(randomFill);
            }
            currentQuiz = currentQuiz.sort(() => 0.5 - Math.random());
            justGeneratedQuestions = [];
        } else {
            currentQuiz = [...quizData].sort(() => 0.5 - Math.random()).slice(0, Math.min(10, quizData.length));
        }
    } // if mode is 'retry', currentQuiz is already set correctly by the retry button
    
    currentQuestionIndex = 0; 
    userAnswers = []; 
    isNavigatingBack = false;
    
    setupContainer.classList.add('hidden');
    quizContainer.classList.remove('hidden');
    showQuestion();
}

function showQuestion() {
    explanationContainer.classList.add('hidden');
    viewSlideBtn.classList.add('hidden');
    aiTutorBtn.classList.add('hidden');
    aiExplanationBox.classList.add('hidden');
    aiExplanationBox.innerHTML = ''; 
    navActions.classList.add('hidden');
    
    // Reset keyboard focus index
    focusedOptionIndex = -1;
    
    if (isNavigatingBack) {
        quizAnimWrapper.className = 'slide-in-left';
    } else {
        quizAnimWrapper.className = 'slide-in-right';
    }
    
    const q = currentQuiz[currentQuestionIndex];
    questionText.innerHTML = q.question;
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
        btn.innerHTML = option;
        btn.className = 'option-btn 3d-btn deal-anim';
        btn.style.setProperty('--i', index); 
        
        btn.onclick = () => {
            if(userAnswers[currentQuestionIndex] !== undefined) return; 
            
            btn.classList.add('is-squished');
            setTimeout(() => {
                btn.classList.remove('is-squished');
                checkAnswer(index, q.answer, btn, q);
            }, 100);
        };
        optionsContainer.appendChild(btn);
    });

    if (userAnswers[currentQuestionIndex] !== undefined) {
        renderAnswerState(userAnswers[currentQuestionIndex], q, false);
    } else {
        if (currentQuestionIndex > 0) {
            navActions.classList.remove('hidden');
            prevBtn.classList.remove('hidden');
            nextBtn.classList.add('hidden'); 
        }
    }
}

function checkAnswer(selected, correct, btn, q) {
    userAnswers[currentQuestionIndex] = selected; 
    renderAnswerState(selected, q, true); 
}

function renderAnswerState(selected, q, animate = false) {
    const correct = q.answer;
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    
    // Clear keyboard focus visually since we answered
    buttons.forEach(b => b.classList.remove('keyboard-focus'));
    
    buttons.forEach((b, idx) => {
        b.disabled = true;
        b.classList.remove('deal-anim'); 
        
        if (idx === correct) {
            b.classList.add('correct');
        } else if (idx === selected && selected !== correct) {
            b.classList.add('wrong');
            if (animate) b.classList.add('shake');
        }
        
        if (idx === selected && selected === correct && animate) {
            b.classList.add('pulse-bounce');
        }
    });

    let currentStreak = 0;
    for (let i = currentQuestionIndex; i >= 0; i--) {
        if (userAnswers[i] === currentQuiz[i].answer) currentStreak++;
        else break;
    }
    
    if (currentStreak >= 2) {
        streakDisplay.classList.remove('hidden');
        streakCount.innerText = currentStreak;
        if (animate) {
            streakDisplay.style.animation = 'none';
            streakDisplay.offsetHeight; 
            streakDisplay.style.animation = null;
        }
    } else {
        streakDisplay.classList.add('hidden');
    }

    if (animate) triggerHaptic(selected === correct ? 'correct' : 'wrong');

    progressBar.style.width = (((currentQuestionIndex + 1) / currentQuiz.length) * 100) + "%";
    explanationText.innerHTML = q.explanation || "No explanation provided.";
    
    let feedbackContainer = document.getElementById('feedback-actions');
    if (!feedbackContainer) {
        feedbackContainer = document.createElement('div');
        feedbackContainer.id = 'feedback-actions';
        feedbackContainer.style.display = 'flex';
        feedbackContainer.style.gap = '6px';
        feedbackContainer.style.marginRight = '8px';
        
        const explainerActions = document.querySelector('.explainer-actions');
        explainerActions.insertBefore(feedbackContainer, explainerActions.firstChild);
    }
    
    feedbackContainer.innerHTML = ''; 
    
    const upBtn = document.createElement('button');
    upBtn.innerText = '👍';
    upBtn.className = 'option-btn 3d-btn';
    upBtn.style.padding = '4px 8px';
    upBtn.style.fontSize = '12px';
    upBtn.style.width = 'auto';

    const downBtn = document.createElement('button');
    downBtn.innerText = '👎';
    downBtn.className = 'option-btn 3d-btn';
    downBtn.style.padding = '4px 8px';
    downBtn.style.fontSize = '12px';
    downBtn.style.width = 'auto';

    upBtn.onclick = () => {
        upBtn.style.background = 'var(--correct-bg)';
        downBtn.disabled = true;
    };

    downBtn.onclick = () => {
        downBtn.style.background = 'var(--wrong-bg)';
        upBtn.disabled = true;
        downBtn.innerText = 'Reviewing...';
        reviewQuestionAI(q, downBtn);
    };

    feedbackContainer.appendChild(upBtn);
    feedbackContainer.appendChild(downBtn);

    if (q.page && pdfDoc) viewSlideBtn.classList.remove('hidden');
    
    aiTutorBtn.classList.remove('hidden');
    aiTutorBtn.onclick = () => fetchAIExplanation(q);

    explanationContainer.classList.remove('hidden');
    
    navActions.classList.remove('hidden');
    nextBtn.classList.remove('hidden'); 
    
    if (currentQuestionIndex > 0) {
        prevBtn.classList.remove('hidden');
    } else {
        prevBtn.classList.add('hidden');
    }
}

function loadPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        prevBtn.classList.add('is-squished');
        setTimeout(() => {
            prevBtn.classList.remove('is-squished');
            isNavigatingBack = true;
            quizAnimWrapper.className = 'slide-out-right';
            setTimeout(() => {
                currentQuestionIndex--;
                showQuestion();
            }, 250);
        }, 100);
    }
}

function loadNextQuestion() {
    nextBtn.classList.add('is-squished');
    setTimeout(() => {
        nextBtn.classList.remove('is-squished');
        isNavigatingBack = false;
        quizAnimWrapper.className = 'slide-out-left';
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex < currentQuiz.length) showQuestion();
            else showResults();
        }, 250); 
    }, 100);
}

function showResults() {
    quizContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    
    let finalScore = 0;
    let incorrectQs = [];
    
    currentQuiz.forEach((q, idx) => {
        if (userAnswers[idx] === q.answer) {
            finalScore++;
        } else {
            incorrectQs.push(q);
        }
    });

    document.getElementById('score').innerText = finalScore;
    document.getElementById('score-total-text').innerText = `/${currentQuiz.length}`;
    
    if (incorrectQs.length > 0) {
        retryIncorrectBtn.classList.remove('hidden');
        document.getElementById('incorrect-count').innerText = incorrectQs.length;
        
        retryIncorrectBtn.onclick = () => {
            retryIncorrectBtn.classList.add('is-squished');
            setTimeout(() => {
                retryIncorrectBtn.classList.remove('is-squished');
                currentQuiz = incorrectQs; 
                resultContainer.classList.add('hidden');
                startQuiz('retry'); 
            }, 150);
        };
    } else {
        retryIncorrectBtn.classList.add('hidden');
    }

    const msg = document.getElementById('result-message');
    const confettiColors = isLightMode ? ['#007AFF', '#34C759', '#FF9F0A'] : ['#3b82f6', '#22c55e', '#f59e0b']; 

    if (finalScore >= currentQuiz.length * 0.8) {
        msg.innerText = "Excellent.";
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: confettiColors });
    } else if (finalScore >= currentQuiz.length * 0.5) msg.innerText = "Good effort.";
    else msg.innerText = "Keep practicing.";
}

// --- NVIDIA AI QUESTION REVIEW LOGIC ---
async function reviewQuestionAI(q, downBtn) {
    const apiKey = localStorage.getItem('nvidia_api_key');
    if (!apiKey) {
        settingsModal.classList.remove('hidden');
        downBtn.innerText = '👎';
        downBtn.disabled = false;
        return;
    }

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

    const promptText = `
    A user flagged this quiz question. You are a Senior Editor. 
    Review it for TWO things:
    1. FACTUAL ACCURACY: Does it match the slide text? Are the options logically sound? 
    2. PEDAGOGICAL QUALITY & FORMATTING: 
       - SLOP CHECK: Does the question text contain spoilers like "Both A and B"? 
       - FORMATTING: Math variables MUST use HTML. For example, z1 must be z<sub>1</sub>. R^2 must be R<sup>2</sup>. If you see variables like z1, z2, r2 without HTML tags, it is YOUR JOB to fix them.

    Question: ${q.question}
    Options: ${JSON.stringify(q.options)}
    Correct Answer Index: ${q.answer}
    Explanation: ${q.explanation}
    Slide Content (Page ${q.page}): "${slideText}"

    DECISION CRITERIA:
    - If the question lacks proper HTML formatting for math (superscripts/subscripts): Action = "FIX". YOU MUST ACTUALLY ADD THE HTML TAGS in the fixed_question.
    - If the question contains "Both A and B" / "All of the above", or if it is logically flawed: Action = "FIX" or "DELETE".
    - If the facts are wrong: Action = "FIX".
    - If it's a "gimme" question with no educational value: Action = "DELETE".
    - If it is clear, challenging, strictly follows standard multiple choice formats, and has proper math formatting: Action = "KEEP".

    CRITICAL: If your action is "FIX", the 'fixed_question' MUST be noticeably different from the original question. You MUST apply the fixes you talk about.

    You must respond ONLY with a valid JSON object wrapped in <FINAL_JSON> tags.
    Format:
    <FINAL_JSON>
    {
      "action": "FIX" | "DELETE" | "KEEP",
      "fixed_question": {
         "question": "...",
         "options": ["...", "...", "...", "..."],
         "answer": 0,
         "explanation": "...",
         "page": ${q.page}
      },
      "reason": "Brief reason for your decision"
    }
    </FINAL_JSON>
    `;

    try {
        const myProxyUrl = "https://nvidia-proxy.rasp-bklyn.workers.dev";
        const response = await fetch(myProxyUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "meta/llama-3.3-70b-instruct",
                messages: [
                    { role: "system", content: "You output strict JSON evaluating and fixing quiz questions. You ALWAYS write HTML tags for math." },
                    { role: "user", content: promptText }
                ],
                max_tokens: 1500,
                temperature: 0.2
            })
        });

        const data = await response.json();
        if (response.ok && data.choices) {
            let aiOutput = data.choices[0].message.content.trim();
            const jsonMatch = aiOutput.match(/<FINAL_JSON>([\s\S]*?)<\/FINAL_JSON>/) || aiOutput.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) throw new Error("No JSON found");
            const result = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            
            if (result.action === "DELETE") {
                quizData = quizData.filter(item => item.question !== q.question); 
                allCountSpan.innerText = quizData.length;
                downBtn.innerText = "🗑️ Deleted";
                alert("AI Review: " + result.reason + "\n\nResult: Question removed from bank.");
            } else if (result.action === "FIX") {
                const fq = result.fixed_question;
                
                const isIdentical = (q.question === fq.question && JSON.stringify(q.options) === JSON.stringify(fq.options) && q.explanation === fq.explanation);
                
                if (isIdentical) {
                    if (confirm("AI Reason: " + result.reason + "\n\nWARNING: The AI claimed to fix this, but output the EXACT SAME TEXT.\n\nClick OK to KEEP the original, or Cancel to FORCE DELETE it.")) {
                        downBtn.innerText = "✅ Kept";
                    } else {
                        quizData = quizData.filter(item => item.question !== q.question);
                        allCountSpan.innerText = quizData.length;
                        downBtn.innerText = "🗑️ Deleted";
                    }
                    return;
                }

                const originalDetails = `ORIGINAL:\nQ: ${q.question}\nCorrect: ${q.options[q.answer]}`;
                const fixDetails = `PROPOSED FIX:\nQ: ${fq.question}\n- ${fq.options[0]}\n- ${fq.options[1]}\n- ${fq.options[2]}\n- ${fq.options[3]}\n\nCorrect Answer: ${fq.options[fq.answer]}\n\nExplanation: ${fq.explanation}`;
                
                if (confirm("AI Review: " + result.reason + "\n\n" + originalDetails + "\n\n-----------------\n\n" + fixDetails + "\n\nClick OK to ACCEPT this fix and save it, or Cancel to FORCE DELETE the question entirely.")) {
                    const idx = quizData.findIndex(item => item.question === q.question);
                    if (idx !== -1) {
                        quizData[idx] = fq;
                    }
                    downBtn.innerText = "🔧 Fixed";
                } else {
                    quizData = quizData.filter(item => item.question !== q.question);
                    allCountSpan.innerText = quizData.length;
                    downBtn.innerText = "🗑️ Deleted";
                }
            } else {
                if (confirm("AI Review: " + result.reason + "\n\nThe AI thinks this question is completely fine.\n\nClick OK to KEEP it in the bank, or Cancel to FORCE DELETE it anyway.")) {
                    downBtn.innerText = "✅ Kept";
                } else {
                    quizData = quizData.filter(item => item.question !== q.question);
                    allCountSpan.innerText = quizData.length;
                    downBtn.innerText = "🗑️ Deleted";
                }
            }
        }
    } catch (err) {
        console.error("Review Error:", err);
        downBtn.innerText = "⚠️ Error";
    }
}

// --- NVIDIA NIM AI TUTOR ---
async function fetchAIExplanation(q) {
    const apiKey = localStorage.getItem('nvidia_api_key');
    if (!apiKey) {
        settingsModal.classList.remove('hidden');
        return;
    }

    aiTutorBtn.innerText = 'Thinking...';
    aiTutorBtn.disabled = true;
    aiExplanationBox.innerHTML = '';
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

    promptText += `\nExplain the underlying concept concisely based PRIMARILY on the Class Slide Content provided above. Keep it to exactly 2 to 3 short, direct sentences. Do NOT use conversational filler.`;

    try {
        const myProxyUrl = "https://nvidia-proxy.rasp-bklyn.workers.dev";
        const response = await fetch(myProxyUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "meta/llama-3.3-70b-instruct", 
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
            let aiText = data.choices[0].message.content.trim();
            aiText = aiText.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/B0/g, 'B<sub>0</sub>').replace(/I0/g, 'I<sub>0</sub>').replace(/\^2/g, '<sup>2</sup>').replace(/\^3/g, '<sup>3</sup>');
            aiExplanationBox.innerHTML = "✨ " + aiText;
        } else {
            console.error("API Error:", data);
            aiExplanationBox.innerHTML = "Error: Invalid API key or model issue. Please check your settings.";
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        aiExplanationBox.innerHTML = "Connection error. Ensure you are connected to the internet.";
    }

    aiTutorBtn.innerText = '✨ AI Tutor';
    aiTutorBtn.disabled = false;
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