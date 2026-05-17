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
const explanationContainer = document.getElementById('explanation-container');
const explanationText = document.getElementById('explanation-text');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// Load JSON
fetch('questions.json')
    .then(res => res.json())
    .then(data => quizData = data)
    .catch(err => console.error("Error loading quiz data", err));

document.getElementById('start-btn').onclick = startQuiz;
document.getElementById('restart-btn').onclick = () => location.reload();
nextBtn.onclick = loadNextQuestion;

function startQuiz() {
    if (quizData.length < 10) return alert("Need more questions!");
    currentQuiz = [...quizData].sort(() => 0.5 - Math.random()).slice(0, 10);
    currentQuestionIndex = 0;
    score = 0;
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

    // Update Progress
    const progPercent = ((currentQuestionIndex + 1) / 10) * 100;
    progressBar.style.width = progPercent + "%";
    progressText.innerText = `Question ${currentQuestionIndex + 1} of 10`;

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
    } else {
        btn.classList.add('wrong');
        buttons[correct].classList.add('correct');
    }

    // Show Explanation
    explanationText.innerText = explanation;
    explanationContainer.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
}

function loadNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < 10) showQuestion();
    else {
        quizContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        document.getElementById('score').innerText = score;
    }
}