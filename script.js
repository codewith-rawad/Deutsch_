// script.js - بدون أي تعارض مع supabase.js

// المتغيرات العامة
let storiesData = []
let currentStory = null
let currentQuestionIndex = 0
let userAnswers = []
let currentCategory = 'lesen'
let currentTeil = 1

let score = {
    total: 0,
    correct: 0,
    wrong: 0
}

let totalScore = 0
let completedStories = 0
let streakCount = 0
let currentSummaryLang = 'ar'

// DOM Elemente - التحقق من وجودها قبل الاستخدام
const loginScreen = document.getElementById('loginScreen')
const homePage = document.getElementById('homePage')
const loginButton = document.getElementById('loginButton')
const loginUsername = document.getElementById('loginUsername')
const loginPassword = document.getElementById('loginPassword')
const loginErrorMessage = document.getElementById('loginErrorMessage')
const currentUserSpan = document.getElementById('currentUser')

const heroSection = document.getElementById('heroSection')
const lesenSection = document.getElementById('lesenSection')
const hörenSection = document.getElementById('hörenSection')
const questionsSection = document.getElementById('questionsSection')
const resultsSection = document.getElementById('resultsSection')

const startLesenBtn = document.getElementById('startLesenBtn')
const startHörenBtn = document.getElementById('startHörenBtn')
const backToHomeFromLesen = document.getElementById('backToHomeFromLesen')
const backToHomeFromHören = document.getElementById('backToHomeFromHören')
const backToStoriesBtn = document.getElementById('backToStoriesBtn')
const moreStoriesBtn = document.getElementById('moreStoriesBtn')
const tryAgainBtn = document.getElementById('tryAgainBtn')

const lesenStoriesGrid = document.getElementById('lesenStoriesGrid')
const hörenStoriesGrid = document.getElementById('hörenStoriesGrid')

const currentStoryTitle = document.getElementById('currentStoryTitle')
const currentCategoryBadge = document.getElementById('currentCategoryBadge')
const summarySection = document.getElementById('summarySection')
const summaryContent = document.getElementById('summaryContent')
const currentQuestionNumber = document.getElementById('currentQuestionNumber')
const totalQuestions = document.getElementById('totalQuestions')
const questionTextContainer = document.getElementById('questionTextContainer')
const optionR = document.querySelector('.option-r')
const optionF = document.querySelector('.option-f')
const nextBtn = document.getElementById('nextBtn')
const feedbackContainer = document.getElementById('feedbackContainer')
const feedbackIcon = document.getElementById('feedbackIcon')
const feedbackMessage = document.getElementById('feedbackMessage')

const progressBar = document.getElementById('progressBar')
const visitorCountSpan = document.getElementById('visitorCount')

const finalScore = document.getElementById('finalScore')
const finalTotal = document.getElementById('finalTotal')
const correctCount = document.getElementById('correctCount')
const wrongCount = document.getElementById('wrongCount')
const pointsEarned = document.getElementById('pointsEarned')
const resultsSubtitle = document.getElementById('resultsSubtitle')
const statusBadge = document.getElementById('statusBadge')

const toastNotification = document.getElementById('toastNotification')
const toastMessage = document.getElementById('toastMessage')

// التحقق من الجلسة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM geladen')
    
    // التحقق من وجود window.checkSession
    if (typeof window.checkSession === 'function' && window.checkSession()) {
        console.log('Session gefunden, starte App...')
        await initializeApp()
        if (loginScreen) loginScreen.style.display = 'none'
        if (homePage) homePage.style.display = 'block'
    } else {
        console.log('Keine Session, zeige Login...')
        showLoginScreen()
    }
})

// دوال تسجيل الدخول
function showLoginScreen() {
    if (loginScreen) loginScreen.style.display = 'flex'
    if (homePage) homePage.style.display = 'none'
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin)
    }
    
    if (loginPassword) {
        loginPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin()
        })
    }
}

async function handleLogin() {
    if (!loginUsername || !loginPassword) return
    
    const username = loginUsername.value.trim()
    const password = loginPassword.value.trim()
    
    if (!username || !password) {
        showLoginError('الرجاء إدخال اسم المستخدم وكلمة السر')
        return
    }
    
    if (loginButton) {
        loginButton.disabled = true
        loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...'
    }
    
    if (typeof window.loginUser !== 'function') {
        showLoginError('خطأ في تحميل النظام')
        return
    }
    
    const result = await window.loginUser(username, password)
    
    if (result.success) {
        await initializeApp()
        if (loginScreen) loginScreen.style.display = 'none'
        if (homePage) homePage.style.display = 'block'
        if (currentUserSpan) currentUserSpan.textContent = username
        showToast(`مرحباً ${username}! 👋`, 'success')
    } else {
        showLoginError(result.message)
        if (loginButton) {
            loginButton.disabled = false
            loginButton.innerHTML = '<span>دخول</span><i class="fas fa-arrow-right"></i>'
        }
    }
}

function showLoginError(message) {
    if (!loginErrorMessage) return
    loginErrorMessage.textContent = message
    loginErrorMessage.style.display = 'block'
    setTimeout(function() {
        loginErrorMessage.style.display = 'none'
    }, 3000)
}

// بدأ التطبيق بعد تسجيل الدخول
async function initializeApp() {
    await loadStories()
    updateVisitorCount()
    
    setTimeout(function() {
        showToast('👋 Willkommen bei Deutsch mit Rawad!', 'info')
    }, 1000)
}

// Besucherzähler
const VISITOR_NAMESPACE = 'deutsch-mit-rawad'
const VISITOR_KEY = 'global-besuche'

async function updateVisitorCount() {
    if (!visitorCountSpan) return
    try {
        const res = await fetch(`https://api.countapi.xyz/hit/${encodeURIComponent(VISITOR_NAMESPACE)}/${encodeURIComponent(VISITOR_KEY)}`)
        if (!res.ok) throw new Error('Netzwerkfehler')
        const data = await res.json()
        if (typeof data.value === 'number') {
            visitorCountSpan.textContent = data.value.toLocaleString('de-DE')
        } else {
            visitorCountSpan.textContent = '-'
        }
    } catch (e) {
        visitorCountSpan.textContent = '-'
    }
}

// Lade Geschichten von Supabase
async function loadStories() {
    showLoading()
    try {
        if (typeof window.fetchQuestions !== 'function') {
            throw new Error('fetchQuestions nicht verfügbar')
        }
        
        storiesData = await window.fetchQuestions()
        
        if (!storiesData || storiesData.length === 0) {
            throw new Error('لا توجد قصص متاحة')
        }
        
        hideLoading()
        displayLesenStories()
        updateStats()
        loadSavedProgress()
    } catch (error) {
        console.error('Fehler:', error)
        showError('Daten konnten nicht geladen werden. Bitte kontaktiere Rawad.')
    }
}

function showLoading() {
    if (!lesenStoriesGrid) return
    
    const existingSpinner = document.getElementById('loadingSpinner')
    if (existingSpinner) existingSpinner.remove()
    
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'loading'
    loadingDiv.id = 'loadingSpinner'
    loadingDiv.innerHTML = '<div class="loading-spinner"></div><p style="margin-top: 20px;">Lade Geschichten...</p>'
    lesenStoriesGrid.parentNode.insertBefore(loadingDiv, lesenStoriesGrid)
}

function hideLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner')
    if (loadingSpinner) {
        loadingSpinner.remove()
    }
}

function showError(message) {
    if (!lesenStoriesGrid) return
    
    const existingError = document.querySelector('.error-message')
    if (existingError) existingError.remove()
    
    const errorDiv = document.createElement('div')
    errorDiv.className = 'error-message'
    errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`
    lesenStoriesGrid.parentNode.insertBefore(errorDiv, lesenStoriesGrid)
}

function showToast(message, type = 'info') {
    if (!toastMessage || !toastNotification) return
    toastMessage.textContent = message
    toastNotification.className = `toast-notification show ${type}`
    setTimeout(function() {
        toastNotification.classList.remove('show')
    }, 3000)
}

function loadSavedProgress() {
    completedStories = 0
    if (storiesData && storiesData.length > 0) {
        storiesData.forEach(function(_, index) {
            if (localStorage.getItem(`story_${index}_completed`) === 'true') {
                completedStories++
            }
        })
    }
    
    totalScore = parseInt(localStorage.getItem('totalScore')) || 0
    streakCount = parseInt(localStorage.getItem('streakCount')) || 0
    
    updateStats()
}

function updateStats() {
    if (!storiesData) return
    
    const totalStories = storiesData.length || 1
    const progressPercentage = (completedStories / totalStories) * 100
    if (progressBar) {
        progressBar.style.width = `${progressPercentage}%`
    }
    
    localStorage.setItem('totalScore', totalScore)
    localStorage.setItem('streakCount', streakCount)
}

function getIconForStory(story) {
    if (!story || !story.title) return 'fa-book-open'
    
    const title = story.title.toLowerCase()
    if (title.includes('nachbarin')) return 'fa-people-arrows'
    if (title.includes('wald')) return 'fa-tree'
    if (title.includes('handy')) return 'fa-mobile-alt'
    if (title.includes('fahrrad')) return 'fa-bicycle'
    if (title.includes('steffi')) return 'fa-user-tie'
    if (title.includes('japan')) return 'fa-flag'
    if (title.includes('praktikum')) return 'fa-chalkboard-teacher'
    if (title.includes('gepäck') || title.includes('koffer')) return 'fa-suitcase-rolling'
    if (title.includes('umzug')) return 'fa-truck-moving'
    if (title.includes('mexiko')) return 'fa-globe-americas'
    if (title.includes('reise')) return 'fa-route'
    if (title.includes('sprache')) return 'fa-language'
    if (title.includes('kleidung')) return 'fa-tshirt'
    return 'fa-book-open'
}

function displayLesenStories() {
    if (!lesenStoriesGrid || !storiesData) return
    lesenStoriesGrid.innerHTML = ''
    
    storiesData.forEach(function(story, index) {
        const storyCard = document.createElement('div')
        storyCard.className = 'story-card'
        storyCard.setAttribute('data-index', index)
        
        const iconClass = getIconForStory(story)
        const isCompleted = localStorage.getItem(`story_${index}_completed`) === 'true'
        
        storyCard.innerHTML = `
            <i class="fas ${iconClass} story-icon"></i>
            <h3>${story.title || 'Kein Titel'}</h3>
            <p>${story.questions ? story.questions.length : 0} Fragen</p>
            <div class="story-meta">
                <span class="story-badge">Premium · Teil 1</span>
                <span class="story-status ${isCompleted ? 'completed' : ''}"></span>
            </div>
        `
        
        storyCard.addEventListener('click', function() {
            selectStory(story, 'Lesen', index)
        })
        lesenStoriesGrid.appendChild(storyCard)
    })
}

function selectStory(story, category, index) {
    currentStory = story
    currentCategory = category
    currentQuestionIndex = 0
    userAnswers = []
    
    score = {
        total: story.questions ? story.questions.length : 0,
        correct: 0,
        wrong: 0
    }
    
    if (currentStoryTitle) currentStoryTitle.textContent = story.title || ''
    if (currentCategoryBadge) currentCategoryBadge.innerHTML = `<i class="fas fa-book-open"></i> Lesen · Premium`
    if (totalQuestions) totalQuestions.textContent = story.questions ? story.questions.length : 0
    
    displaySummary(story)
    
    if (heroSection) heroSection.style.display = 'none'
    if (lesenSection) lesenSection.style.display = 'none'
    if (hörenSection) hörenSection.style.display = 'none'
    if (resultsSection) resultsSection.style.display = 'none'
    if (questionsSection) questionsSection.style.display = 'block'
    
    displayQuestion()
}

function displaySummary(story) {
    if (!summarySection || !summaryContent) return
    
    const hasSummary = story.summary_ar || story.summary_de
    if (!hasSummary) {
        summarySection.style.display = 'none'
        return
    }
    
    summarySection.style.display = 'block'
    
    document.querySelectorAll('.summary-lang-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.lang === currentSummaryLang)
    })
    
    const text = currentSummaryLang === 'ar' 
        ? (story.summary_ar || story.summary_de || '') 
        : (story.summary_de || story.summary_ar || '')
    
    summaryContent.textContent = text
    summaryContent.dir = currentSummaryLang === 'ar' ? 'rtl' : 'ltr'
}

document.querySelectorAll('.summary-lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        currentSummaryLang = this.dataset.lang
        if (currentStory) displaySummary(currentStory)
    })
})

function displayQuestion() {
    if (!currentStory || !currentStory.questions) return
    
    const question = currentStory.questions[currentQuestionIndex]
    if (!question) return
    
    const randomText = question.texts[Math.floor(Math.random() * question.texts.length)]
    
    if (questionTextContainer) {
        questionTextContainer.innerHTML = `<p class="question-text">"${randomText}"</p>`
    }
    if (currentQuestionNumber) {
        currentQuestionNumber.textContent = currentQuestionIndex + 1
    }
    
    if (optionR && optionF) {
        optionR.classList.remove('selected-r')
        optionF.classList.remove('selected-f')
        optionR.disabled = false
        optionF.disabled = false
    }
    if (nextBtn) nextBtn.disabled = true
    if (feedbackContainer) feedbackContainer.style.display = 'none'
    
    updateProgress()
}

function updateProgress() {
    if (!currentStory || !currentStory.questions || !progressBar) return
    const progress = ((currentQuestionIndex + 1) / currentStory.questions.length) * 100
    progressBar.style.width = `${progress}%`
}

function checkAnswer(selectedAnswer) {
    if (!currentStory || !currentStory.questions) return
    
    const question = currentStory.questions[currentQuestionIndex]
    const isCorrect = selectedAnswer === question.answer
    
    if (optionR && optionF) {
        optionR.disabled = true
        optionF.disabled = true
    }
    
    if (selectedAnswer === 'R' && optionR) {
        optionR.classList.add('selected-r')
    } else if (optionF) {
        optionF.classList.add('selected-f')
    }
    
    if (feedbackContainer) feedbackContainer.style.display = 'flex'
    
    if (isCorrect) {
        if (feedbackContainer) feedbackContainer.className = 'feedback-container correct'
        if (feedbackIcon) feedbackIcon.innerHTML = '<i class="fas fa-check-circle"></i>'
        if (feedbackMessage) {
            const emojis = ['🎉', '🌟', '👏', '💪', '⭐']
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
            feedbackMessage.textContent = `✓ Richtig! ${randomEmoji}`
        }
        score.correct++
        totalScore += 10
    } else {
        if (feedbackContainer) feedbackContainer.className = 'feedback-container wrong'
        if (feedbackIcon) feedbackIcon.innerHTML = '<i class="fas fa-times-circle"></i>'
        if (feedbackMessage) {
            feedbackMessage.textContent = `✗ Falsch. Die richtige Antwort ist: ${question.answer === 'R' ? 'Richtig' : 'Falsch'}`
        }
        score.wrong++
    }
    
    userAnswers.push({
        question: question,
        selected: selectedAnswer,
        correct: isCorrect
    })
    
    updateStats()
    if (nextBtn) nextBtn.disabled = false
}

function nextQuestion() {
    if (!currentStory || !currentStory.questions) return
    if (currentQuestionIndex < currentStory.questions.length - 1) {
        currentQuestionIndex++
        displayQuestion()
    } else {
        finishStory()
    }
}

function finishStory() {
    if (!currentStory || !storiesData) return
    
    const storyIndex = storiesData.findIndex(function(s) {
        return s.title === currentStory.title
    })
    
    if (storyIndex !== -1) {
        localStorage.setItem(`story_${storyIndex}_completed`, 'true')
    }
    
    completedStories++
    
    const today = new Date().toDateString()
    const lastActive = localStorage.getItem('lastActive')
    
    if (lastActive === new Date(Date.now() - 86400000).toDateString()) {
        streakCount++
    } else if (lastActive !== today) {
        streakCount = 1
    }
    localStorage.setItem('lastActive', today)
    
    const percentage = (score.correct / score.total) * 100
    const isPassed = percentage >= 60
    
    if (statusBadge) {
        statusBadge.textContent = isPassed ? 'ناجح ✓' : 'راسب ✗'
        statusBadge.className = 'status-badge ' + (isPassed ? 'status-pass' : 'status-fail')
    }
    
    if (percentage === 100) {
        if (resultsSubtitle) resultsSubtitle.textContent = 'Perfekt! Alle Antworten richtig! 🏆'
        showToast('🎉 Fantastisch! 100% richtig!', 'success')
    } else if (percentage >= 70) {
        if (resultsSubtitle) resultsSubtitle.textContent = 'Gut gemacht! Weiter so! 💪'
    } else if (isPassed) {
        if (resultsSubtitle) resultsSubtitle.textContent = 'Geschafft! Übung macht den Meister! 🚀'
    } else {
        if (resultsSubtitle) resultsSubtitle.textContent = 'Übung macht den Meister! Versuch es nochmal! 💪'
    }
    
    if (finalScore) finalScore.textContent = score.correct
    if (finalTotal) finalTotal.textContent = score.total
    if (correctCount) correctCount.textContent = score.correct
    if (wrongCount) wrongCount.textContent = score.wrong
    if (pointsEarned) pointsEarned.textContent = score.correct * 10
    
    if (questionsSection) questionsSection.style.display = 'none'
    if (resultsSection) resultsSection.style.display = 'block'
    
    if (progressBar) progressBar.style.width = '100%'
    updateStats()
}

function backToStories() {
    if (heroSection) heroSection.style.display = 'none'
    if (lesenSection) lesenSection.style.display = 'block'
    if (hörenSection) hörenSection.style.display = 'none'
    if (questionsSection) questionsSection.style.display = 'none'
    if (resultsSection) resultsSection.style.display = 'none'
    
    if (progressBar) progressBar.style.width = '0%'
}

function tryAgain() {
    if (currentStory) {
        currentQuestionIndex = 0
        userAnswers = []
        score = {
            total: currentStory.questions ? currentStory.questions.length : 0,
            correct: 0,
            wrong: 0
        }
        
        if (resultsSection) resultsSection.style.display = 'none'
        if (questionsSection) questionsSection.style.display = 'block'
        
        displayQuestion()
    }
}

// Event Listener - التحقق من وجود العناصر قبل إضافة الأحداث
if (startLesenBtn) {
    startLesenBtn.addEventListener('click', function() {
        if (heroSection) heroSection.style.display = 'none'
        if (lesenSection) lesenSection.style.display = 'block'
        currentCategory = 'lesen'
    })
}

if (startHörenBtn) {
    startHörenBtn.addEventListener('click', function() {
        if (heroSection) heroSection.style.display = 'none'
        if (hörenSection) hörenSection.style.display = 'block'
        currentCategory = 'hören'
        showToast('🎧 Hörverstehen kommt bald! Bleib dran!', 'info')
    })
}

if (backToHomeFromLesen) {
    backToHomeFromLesen.addEventListener('click', function() {
        if (heroSection) heroSection.style.display = 'block'
        if (lesenSection) lesenSection.style.display = 'none'
    })
}

if (backToHomeFromHören) {
    backToHomeFromHören.addEventListener('click', function() {
        if (heroSection) heroSection.style.display = 'block'
        if (hörenSection) hörenSection.style.display = 'none'
    })
}

if (backToStoriesBtn) {
    backToStoriesBtn.addEventListener('click', backToStories)
}

if (moreStoriesBtn) {
    moreStoriesBtn.addEventListener('click', backToStories)
}

if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', tryAgain)
}

if (optionR) {
    optionR.addEventListener('click', function() {
        checkAnswer('R')
    })
}

if (optionF) {
    optionF.addEventListener('click', function() {
        checkAnswer('F')
    })
}

if (nextBtn) {
    nextBtn.addEventListener('click', nextQuestion)
}

// Keyboard Support
document.addEventListener('keydown', function(e) {
    if (questionsSection && questionsSection.style.display === 'block') {
        if (e.key.toLowerCase() === 'r' && optionR && !optionR.disabled) {
            checkAnswer('R')
        } else if (e.key.toLowerCase() === 'f' && optionF && !optionF.disabled) {
            checkAnswer('F')
        } else if (e.key === 'Enter' && nextBtn && !nextBtn.disabled) {
            nextQuestion()
        }
    }
})

// Teil-Indikatoren
document.querySelectorAll('.teil').forEach(function(teil, index) {
    teil.addEventListener('click', function() {
        if (!this.classList.contains('active')) {
            showToast(`Teil ${index + 1} kommt bald! 🚀`, 'info')
        }
    })
})