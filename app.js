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
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const streakDisplay = document.getElementById('streak-display');
const streakCount = document.getElementById('streak-count');
const fileInput = document.getElementById('file-input');

// Try to load default questions
fetch('questions.json')
    .then(res => res.json())
    .then(data => quizData = data)
    .catch(err => console.log("Upload a JSON file to play."));

// Handle File Upload
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            quizData = JSON.parse(e.target.result);
            alert("Custom scan data loaded! Ready to start.");
        } catch (err) {
            alert("Error: Invalid JSON file.");
        }
    };
    reader.readAsText(file);
});

document.getElementById('start-btn').onclick = startQuiz;
document.getElementById('restart-btn').onclick = () => location.reload();
nextBtn.onclick = loadNextQuestion;

// Trigger iPhone vibrations
function triggerHaptic(type) {
    if (!window.navigator || !window.navigator.vibrate) return;
    if (type === 'correct') {
        navigator.vibrate(50); // Soft, quick tap
    } else {
        navigator.vibrate([100, 50, 100]); // Heavy double tap
    }
}

function startQuiz() {
    if (!quizData || quizData.length < 10) return alert("Upload a valid 10+ question JSON first!");
    
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
    nextBtn.classList.add('hidden');
    
    const q = currentQuiz[currentQuestionIndex];
    questionText.innerText = q.question;
    optionsContainer.innerHTML = '';

    // Update Progress Bar
    const progPercent = ((currentQuestionIndex) / 10) * 100;
    progressBar.style.width = progPercent + "%";
    progressText.innerText = `Q${currentQuestionIndex + 1} / 10`;

    q.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.innerText = option;
        btn.className = 'option-btn';
        btn.onclick = () => checkAnswer(index, q.answer, btn, q.explanation);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selected, correct, btn, explanation) {
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(b => b.disabled = true);

    if (selected === correct) {
        btn.classList.add('correct');
        score++;
        streak++;
        triggerHaptic('correct');
        
        // Show streak if 2 or more
        if(streak >= 2) {
            streakDisplay.classList.remove('hidden');
            streakCount.innerText = streak;
            // Retrigger CSS animation
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

    // Advance progress bar fully for this question
    progressBar.style.width = (((currentQuestionIndex + 1) / 10) * 100) + "%";

    explanationText.innerText = explanation || "No further data available.";
    explanationContainer.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
}

function loadNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < 10) {
        showQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    quizContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    document.getElementById('score').innerText = score;
    
    const msg = document.getElementById('result-message');
    const emoji = document.getElementById('result-emoji');
    
    if (score >= 8) {
        msg.innerText = "Excellent Scan Analysis!";
        emoji.innerText = "🏆";
        // Fire the Confetti Cannon!
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#10b981', '#ffffff']
        });
    } else if (score >= 5) {
        msg.innerText = "Good effort. Review the data.";
        emoji.innerText = "📊";
    } else {
        msg.innerText = "Needs recalibration.";
        emoji.innerText = "⚠️";
    }
}