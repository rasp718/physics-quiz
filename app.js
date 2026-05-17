let quizData = [];
let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let streak = 0;

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
const explanationImage = document.getElementById('explanation-image');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const streakDisplay = document.getElementById('streak-display');
const streakCount = document.getElementById('streak-count');
const fireIcon = document.getElementById('fire-icon');
const fileInput = document.getElementById('file-input');
const themeToggle = document.getElementById('theme-toggle');

// Theme Logic
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

// File Upload
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
    explanationImage.classList.add('hidden');
    nextBtn.classList.add('hidden');
    
    quizAnimWrapper.className = 'slide-in-right';
    
    const q = currentQuiz[currentQuestionIndex];
    questionText.innerText = q.question;
    optionsContainer.innerHTML = '';

    const progPercent = ((currentQuestionIndex) / 10) * 100;
    progressBar.style.width = progPercent + "%";
    progressText.innerText = `${currentQuestionIndex + 1} of 10`;

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
        if(streak >= 3) fireIcon.classList.add('breathing-fire');
        
    } else {
        btn.classList.add('wrong', 'shake');
        buttons[correct].classList.add('correct');
        streak = 0;
        streakDisplay.classList.add('hidden');
        fireIcon.classList.remove('breathing-fire');
        triggerHaptic('wrong');
    }

    progressBar.style.width = (((currentQuestionIndex + 1) / 10) * 100) + "%";

    explanationText.innerText = q.explanation || "No explanation provided.";
    if (q.image) { explanationImage.src = q.image; explanationImage.classList.remove('hidden'); }
    
    explanationContainer.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
    
    // NOTE: Removed all window scroll logic here. The app is now strictly scroll-locked.
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