let quizData = [];
let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let streak = 0;
let pdfDoc = null;
let justGeneratedQuestions = []; // Tracks the newest questions

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

// --- FILE UPLOAD & STARTUP ---
fetch('questions.json').then(res => res.json()).then(data => { 
    quizData = data; 
    document.getElementById('subject-subtitle').innerText = `${quizData.length} questions in bank. Ready to begin.`;
    startBtn.classList.remove('hidden'); 
}).catch(() => {});

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('subject-title').innerText = file.name.replace('.json', '').toUpperCase();
    document.getElementById('upload-label').innerHTML = `<span class="icon">✅</span> Loaded: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try { 
            quizData = JSON.parse(e.target.result); 
            document.getElementById('subject-subtitle').innerText = `${quizData.length} questions in bank. Ready to begin.`;
            startBtn.classList.remove('hidden'); 
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
    generateQuizBtn.innerHTML = "Generating... (takes up to 1 min)";

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
5. FORMATTING: Use HTML for subscripts (B<sub>0</sub>) and Greek letters (&mu;).
6. SELF-REVIEW: First, write a brief "SELF-REVIEW" evaluating your 10 questions for logical flaws, "trick" question phrasing, and factual accuracy.
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
            
            document.getElementById('subject-title').innerText = "AI QUIZ READY";
            document.getElementById('subject-subtitle').innerText = `Added ${addedCount} new unique questions! ${quizData.length} total in bank.`;
            
            aiLoadingText.classList.add('hidden');
            generateQuizBtn.innerHTML = "✨ Generate 10 More";
            startBtn.classList.remove('hidden'); 
        } else {
            throw new Error("API returned an error");
        }
    } catch (err) {
        console.error("AI Generation Error:", err);
        alert("Failed to generate quiz. Check the console and your API key.");
        aiLoadingText.classList.add('hidden');
        generateQuizBtn.disabled = false;
        generateQuizBtn.innerHTML = '<span class="icon">✨</span> Generate Quiz';
    }
});


startBtn.onclick = () => {
    startBtn.classList.add('is-squished');
    setTimeout(() => startQuiz(), 150);
};

document.getElementById('restart-btn').onclick = () => {
    resultContainer.classList.add('hidden');
    setupContainer.classList.remove('hidden');
    startBtn.classList.remove('is-squished');
    document.getElementById('subject-subtitle').innerText = `${quizData.length} questions in bank. Ready to begin.`;
};

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
        currentQuiz = [...quizData].sort(() => 0.5 - Math.random()).slice(0, 10);
    }
    
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
    aiExplanationBox.innerHTML = ''; 
    nextBtn.classList.add('hidden');
    
    quizAnimWrapper.className = 'slide-in-right';
    
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
    nextBtn.classList.remove('hidden');
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
    1. FACTUAL ACCURACY: Does it match the slide text? Are the options logically sound? (e.g., "Both A and B" cannot be the answer if A and B are mutually exclusive).
    2. PEDAGOGICAL QUALITY: Is it "slop"? 
       - SLOP CHECK: Does the question text contain spoilers like "Both A and B" or "Which of the following two"? 
       - SLOP CHECK: Are the options confusing, overlapping, or poorly formatted?

    Question: ${q.question}
    Options: ${JSON.stringify(q.options)}
    Correct Answer Index: ${q.answer}
    Explanation: ${q.explanation}
    Slide Content (Page ${q.page}): "${slideText}"

    DECISION CRITERIA:
    - If the question contains "Both A and B" / "All of the above", or if it is logically flawed: Action = "FIX" or "DELETE".
    - If the facts are wrong: Action = "FIX".
    - If it's a "gimme" question with no educational value: Action = "DELETE".
    - If it is clear, challenging, and strictly follows standard multiple choice formats: Action = "KEEP".

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
                    { role: "system", content: "You output strict JSON evaluating and fixing quiz questions." },
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
            
            // Give user the override control based on AI's response
            if (result.action === "DELETE") {
                quizData = quizData.filter(item => item.question !== q.question); 
                downBtn.innerText = "🗑️ Deleted";
                alert("AI Review: " + result.reason + "\n\nResult: Question removed from bank.");
            } else if (result.action === "FIX") {
                if (confirm("AI Review: " + result.reason + "\n\nThe AI has rewritten this question for future runs.\n\nClick OK to ACCEPT the fix, or Cancel to FORCE DELETE the question entirely.")) {
                    const idx = quizData.findIndex(item => item.question === q.question);
                    if (idx !== -1) {
                        quizData[idx] = result.fixed_question;
                    }
                    downBtn.innerText = "🔧 Fixed";
                } else {
                    quizData = quizData.filter(item => item.question !== q.question);
                    downBtn.innerText = "🗑️ Deleted";
                }
            } else {
                if (confirm("AI Review: " + result.reason + "\n\nThe AI thinks this question is completely fine.\n\nClick OK to KEEP it in the bank, or Cancel to FORCE DELETE it anyway.")) {
                    downBtn.innerText = "✅ Kept";
                } else {
                    quizData = quizData.filter(item => item.question !== q.question);
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