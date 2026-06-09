;(function () {
    window.TELEGRAM_GROUP_URL = window.TELEGRAM_GROUP_URL || 'https://t.me/MeisterQuiz'

    function isLocalDev() {
        const host = (location.hostname || '').toLowerCase()
        return host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:'
    }

    function isTelegramWebApp() {
        const tg = window.Telegram && window.Telegram.WebApp
        if (!tg) return false
        if (tg.initData && String(tg.initData).length > 0) return true
        const platform = String(tg.platform || '')
        return platform !== '' && platform !== 'unknown'
    }

    function isTelegramUserAgent() {
        const ua = navigator.userAgent || ''
        return /Telegram/i.test(ua)
    }

    function isTelegramReferrer() {
        const ref = document.referrer || ''
        return /t\.me|telegram\.org|telegram\.me/i.test(ref)
    }

    function isAllowed() {
        if (isLocalDev()) return true
        if (sessionStorage.getItem('tg_gate_ok') === '1') return true
        return isTelegramWebApp() || isTelegramUserAgent() || isTelegramReferrer()
    }

    function initTelegramApp() {
        const tg = window.Telegram && window.Telegram.WebApp
        if (!tg) return
        try {
            tg.ready()
            tg.expand()
            if (tg.enableClosingConfirmation) tg.enableClosingConfirmation()
        } catch (e) { /* ignore */ }
    }

    function showBlockedPage() {
        document.documentElement.classList.remove('tg-pending')
        document.documentElement.classList.add('tg-blocked')
        document.documentElement.lang = 'ar'
        document.documentElement.dir = 'rtl'

        const groupUrl = window.TELEGRAM_GROUP_URL
        document.body.innerHTML = [
            '<div id="tg-gate" class="tg-gate">',
            '  <div class="tg-gate-card">',
            '    <div class="tg-gate-icon"><i class="fab fa-telegram"></i></div>',
            '    <h1>الدخول من تيليغرام فقط</h1>',
            '    <p class="tg-gate-ar">هذا الموقع متاح لأعضاء مجموعة <strong>MeisterQuiz</strong> فقط.<br>افتح الرابط من داخل تطبيق تيليغرام.</p>',
            '    <p class="tg-gate-de">Diese Seite ist nur über Telegram erreichbar.<br>Bitte öffne den Link in der Telegram-App.</p>',
            '    <a href="' + groupUrl + '" class="tg-gate-btn"><i class="fab fa-telegram"></i> انضم إلى المجموعة · Zur Gruppe</a>',
            '    <p class="tg-gate-hint">📱 اضغط على رابط الموقع داخل المجموعة — لا تنسخ الرابط إلى Chrome أو Safari</p>',
            '  </div>',
            '</div>'
        ].join('\n')

        if (!document.querySelector('link[href="style.css"]')) {
            const css = document.createElement('link')
            css.rel = 'stylesheet'
            css.href = 'style.css'
            document.head.appendChild(css)
        }
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
            document.head.appendChild(link)
        }
    }

    function allowPage() {
        sessionStorage.setItem('tg_gate_ok', '1')
        document.documentElement.classList.remove('tg-pending')
        document.documentElement.classList.remove('tg-blocked')
        initTelegramApp()
    }

    document.documentElement.classList.add('tg-pending')

    function runGate() {
        if (isAllowed()) {
            allowPage()
            return
        }
        showBlockedPage()
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runGate)
    } else {
        runGate()
    }
})()
