let quizData = [];
let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;

const setupContainer = document.getElementById('setup-container');
const quizContainer = document.getElementById('quiz-container');
const resultContainer = document.getElementById('result-container');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const nextBtn = document.getElementById('next-btn');
const progressText = document.getElementById('current-q');
const fileInput = document.getElementById('file-input');

// IMPORTANT: This must match the file name exactly
fetch('questions.json')
    .then(res => {
        if (!res.ok) throw new Error("Could not find questions.json");
        return res.json();
    })
    .then(data => { 
        quizData = data; 
        console.log("Default questions loaded!");
    })
    .catch(err => {
        console.error(err);
        alert("Warning: questions.json not found. You must upload a file to play.");
    });

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            quizData = JSON.parse(e.target.result);
            alert("Custom quiz loaded!");
        } catch (err) {
            alert("Error: Invalid JSON file.");
        }
    };
    reader.readAsText(file);
});

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('restart-btn').addEventListener('click', () => {
    resultContainer.classList.add('hidden');
    setupContainer.classList.remove('hidden');
});
nextBtn.addEventListener('click', loadNextQuestion);

function startQuiz() {
    if (!quizData || quizData.length < 10) {
        alert("Not enough questions loaded. Please ensure questions.json is in the same folder.");
        return;
    }
    currentQuiz = [...quizData].sort(() => 0.5 - Math.random()).slice(0, 10);
    currentQuestionIndex = 0;
    score = 0;
    setupContainer.classList.add('hidden');
    quizContainer.classList.remove('hidden');
    showQuestion();
}

function showQuestion() {
    nextBtn.classList.add('hidden');
    progressText.innerText = currentQuestionIndex + 1;
    const q = currentQuiz[currentQuestionIndex];
    questionText.innerText = q.question;
    optionsContainer.innerHTML = '';
    q.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.innerText = option;
        btn.classList.add('option-btn');
        btn.addEventListener('click', () => checkAnswer(index, q.answer, btn));
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selectedIndex, correctIndex, btnClicked) {
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(btn => btn.disabled = true);
    if (selectedIndex === correctIndex) {
        btnClicked.classList.add('correct');
        score++;
    } else {
        btnClicked.classList.add('wrong');
        buttons[correctIndex].classList.add('correct');
    }
    nextBtn.classList.remove('hidden');
}

function loadNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuiz.length) {
        showQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    quizContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    document.getElementById('score').innerText = score;
}