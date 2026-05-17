let quizData = [];
let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let streak = 0;

const setupContainer = document.getElementById('setup-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const explanationContainer = document.getElementById('explanation-container');
const explanationText = document.getElementById('explanation-text');
const explanationImage = document.getElementById('explanation-image');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const streakDisplay = document.getElementById('streak-display');
const streakCount = document.getElementById('streak-count');
const fileInput = document.getElementById('file-input');
const themeToggle = document.getElementById('theme-toggle');

// --- THEME TOGGLE LOGIC ---
let isLightMode = false;
// Check if user previously saved 'light' mode
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
        document.body.removeAttribute('data-theme'); // Returns to default dark
        themeToggle.innerText = '☀️';
        localStorage.setItem('theme', 'dark');
    }
});
// --------------------------

// Look for a default file, fail silently if none exists
fetch('questions.json')
    .then(res => res.json())
    .then(data => quizData = data)
    .catch(() => console.log("Awaiting file upload."));

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('main-title').innerText = file.name.replace('.json', '').toUpperCase();

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            quizData = JSON.parse(e.target.result);
            alert(`Successfully loaded ${quizData.length} questions!`);
        } catch (err) {
            alert("Error: Invalid JSON file structure.");
        }
    };
    reader.readAsText(file);
});

document.getElementById('start-btn').onclick = startQuiz;
document.getElementById('restart-btn').onclick = () => location.reload();
nextBtn.onclick = loadNextQuestion;

function triggerHaptic(type) {
    if (!window.navigator || !window.navigator.vibrate) return;
    if (type === 'correct') navigator.vibrate(50);
    else navigator.vibrate([100, 50, 100]);
}

function startQuiz() {
    if (!quizData || quizData.length < 10) return alert("You need a JSON file with at least 10 questions.");
    
    currentQuiz = [...quizData].sort(() => 0.5 - Math.random()).slice(0, 10);
    currentQuestionIndex = 0;
    score = 0;
    streak = 0;
    
    setupContainer.classList.add('hidden');
    quizContainer.classList.remove('hidden');
    showQuestion();
}

function showQuestion() {
    explanationContainer.classList.add('hidden');
    explanationImage.classList.add('hidden');
    nextBtn.classList.add('hidden');
    
    const q = currentQuiz[currentQuestionIndex];
    questionText.innerText = q.question;
    optionsContainer.innerHTML = '';

    const progPercent = ((currentQuestionIndex) / 10) * 100;
    progressBar.style.width = progPercent + "%";
    progressText.innerText = `${currentQuestionIndex + 1} / 10`;

    q.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.innerText = option;
        btn.className = 'option-btn';
        btn.onclick = () => checkAnswer(index, q.answer, btn, q);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selected, correct, btn, q) {
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.classList.add('correct');
        score++;
        streak++;
        triggerHaptic('correct');
        
        if(streak >= 2) {
            streakDisplay.classList.remove('hidden');
            streakCount.innerText = streak;
            streakDisplay.style.animation = 'none';
            streakDisplay.offsetHeight; 
            streakDisplay.style.animation = null;
        }
    } else {
        btn.classList.add('wrong');
        buttons[correct].classList.add('correct');
        streak = 0;
        streakDisplay.classList.add('hidden');
        triggerHaptic('wrong');
    }

    progressBar.style.width = (((currentQuestionIndex + 1) / 10) * 100) + "%";

    explanationText.innerText = q.explanation || "No explanation provided.";
    
    if (q.image) {
        explanationImage.src = q.image;
        explanationImage.classList.remove('hidden');
    }

    explanationContainer.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
}

function loadNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < 10) showQuestion();
    else showResults();
}

function showResults() {
    quizContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    document.getElementById('score').innerText = score;
    
    const msg = document.getElementById('result-message');
    
    // Choose confetti color based on the current theme
    const confettiColors = isLightMode 
        ? ['#292524', '#78716c', '#e7e5e4'] // Dark/Taupe confetti for Light Mode
        : ['#ffffff', '#a3a3a3', '#555555']; // White/Gray confetti for Dark Mode

    if (score >= 8) {
        msg.innerText = "Outstanding.";
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: confettiColors });
    } else if (score >= 5) {
        msg.innerText = "Good effort.";
    } else {
        msg.innerText = "Keep practicing.";
    }
}