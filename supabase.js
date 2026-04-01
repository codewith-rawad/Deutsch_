
window.API_URL = 'https://qrznwrvfjacoepegjpov.supabase.co/functions/v1'


window.getToken = function () {
    return localStorage.getItem('auth_token')
}

window.setToken = function (token) {
    if (token) {
        localStorage.setItem('auth_token', token)
    } else {
        localStorage.removeItem('auth_token')
    }
}

window.hashDeviceString = function (input) {
    let hash = 5381
    const str = String(input || '')
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i)
        hash = hash & hash
    }
    return Math.abs(hash).toString(36)
}

window.buildDeviceFingerprint = function () {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const parts = [
        navigator.platform || '',
        String(screen.width || ''),
        String(screen.height || ''),
        String(screen.colorDepth || ''),
        tz
    ]
    return parts.join('|')
}

window.getDeviceId = function () {
    const fingerprint = window.buildDeviceFingerprint()
    const fingerprintId = 'fp_' + window.hashDeviceString(fingerprint)
    localStorage.setItem('device_id', fingerprintId)
    return fingerprintId
}


window.loginUser = async function (username, password) {
    try {

        const response = await fetch(`${window.API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password,
                deviceId: window.getDeviceId(),
                deviceFingerprint: window.buildDeviceFingerprint()
            })
        })



        const result = await response.json()

        if (result.success) {

            window.setToken(result.token)
            sessionStorage.setItem('username', username)
            sessionStorage.setItem('user_id', result.user.id)
            sessionStorage.setItem('logged_in', 'true')
            return { success: true }
        } else {
            return { success: false, message: result.message }
        }
    } catch (error) {
        console.error('Login error:', error)
        return { success: false, message: '❌ فشل الاتصال بالخادم' }
    }
}


window.checkSession = function () {

    return sessionStorage.getItem('logged_in') === 'true'
}


window.logout = function () {
    sessionStorage.clear()
    window.setToken(null)
    window.location.href = 'index.html'
}


window.getCurrentUsername = function () {
    return sessionStorage.getItem('username') || 'Gast'
}

window._questionsCache = window._questionsCache || {}
window._questionsInFlight = window._questionsInFlight || {}


window.loadQuestionsFile = async function (fileKey, options) {
    const opts = options || {}
    const maxAgeMs = typeof opts.maxAgeMs === 'number' ? opts.maxAgeMs : 6 * 60 * 60 * 1000
    const forceReload = !!opts.forceReload
    const allowStale = opts.allowStale !== false
    const revalidate = opts.revalidate !== false
    const hasArabicTexts = function (payload) {
        if (!Array.isArray(payload)) return false
        return payload.some(story =>
            Array.isArray(story?.questions) &&
            story.questions.some(q =>
                Array.isArray(q?.texts) &&
                q.texts.some(t => t && typeof t === 'object' && typeof t.ar === 'string' && t.ar.trim() !== '')
            )
        )
    }
    const isValidData = function (payload) {
        return fileKey !== 'lesen1' || hasArabicTexts(payload)
    }
    const cacheKey = 'questions_cache_' + fileKey

    const fetchFromServer = async function () {
        if (window._questionsInFlight[fileKey]) {
            return window._questionsInFlight[fileKey]
        }
        window._questionsInFlight[fileKey] = (async function () {
            const token = window.getToken()
            const response = await fetch(`${window.API_URL}/get-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileKey: fileKey,
                    token: token
                })
            })

            const data = await response.json()
            if (data.error) {
                if (data.error === 'login_required') {
                    window.location.href = 'login.html'
                    return null
                }
                console.error('Error loading file:', data.error)
                return null
            }
            if (!isValidData(data)) {
                return null
            }

            window._questionsCache[fileKey] = data
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    ts: Date.now(),
                    data: data
                }))
            } catch (e) {
            }
            return data
        })()

        try {
            return await window._questionsInFlight[fileKey]
        } finally {
            delete window._questionsInFlight[fileKey]
        }
    }


    if (!forceReload && window._questionsCache[fileKey]) {
        if (isValidData(window._questionsCache[fileKey])) {
            return window._questionsCache[fileKey]
        }
    }

    if (!forceReload) {
        try {
            const cachedRaw = localStorage.getItem(cacheKey)
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw)
                if (cached && typeof cached.ts === 'number' && cached.data && isValidData(cached.data)) {
                    const age = Date.now() - cached.ts
                    window._questionsCache[fileKey] = cached.data

                    if (age < maxAgeMs) {
                        if (revalidate) {
                            fetchFromServer().catch(() => { })
                        }
                        return cached.data
                    }
                    if (allowStale) {
                        fetchFromServer().catch(() => { })
                        return cached.data
                    }
                }
            }
        } catch (e) {
            console.warn('Error reading questions cache for', fileKey, e)
        }
    }

    try {
        return await fetchFromServer()
    } catch (error) {
        console.error('Error loading file:', error)
        return null
    }
}

/**
 * Starts a file download without opening a new tab (fetch → blob → save).
 * Falls back to a direct anchor click or navigation if CORS/fetch fails.
 * @returns {Promise<void>}
 */
window.downloadPdfToDevice = async function (url, filename) {
    const name = filename || 'download.pdf'
    try {
        const res = await fetch(url, { mode: 'cors', cache: 'no-store' })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = name
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(function () { URL.revokeObjectURL(blobUrl) }, 2000)
    } catch (e) {
        console.warn('downloadPdfToDevice:', e)
        try {
            const a = document.createElement('a')
            a.href = url
            a.download = name
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        } catch (e2) {
            window.location.href = url
        }
    }
}

;(function () {
    if (window._lesenPdfStylesInjected) return
    window._lesenPdfStylesInjected = true
    const st = document.createElement('style')
    st.textContent = [
        'a.lesen-pdf-download.pdf-download-loading{opacity:0.92;cursor:wait!important;}',
        'a.lesen-pdf-download.pdf-download-loading .fa-file-pdf{opacity:0.35;}'
    ].join('')
    document.head.appendChild(st)
})()

;(function () {
    if (window._lesenPdfClickBound) return
    window._lesenPdfClickBound = true
    document.addEventListener('click', function (e) {
        const el = e.target.closest('a.lesen-pdf-download')
        if (!el) return
        const url = el.getAttribute('data-pdf-url')
        const name = el.getAttribute('data-pdf-name') || 'download.pdf'
        if (!url) return
        e.preventDefault()
        if (el.getAttribute('aria-busy') === 'true') return

        const originalHtml = el.innerHTML
        el.setAttribute('aria-busy', 'true')
        el.classList.add('pdf-download-loading')
        el.style.pointerEvents = 'none'
        el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>جاري التحميل… · Wird geladen…</span></span>'

        if (typeof window.showToast === 'function') {
            try {
                window.showToast('جاري تحميل الملف… · Download wird vorbereitet…', 'info')
            } catch (toastErr) { /* ignore */ }
        }

        ;(async function () {
            try {
                if (window.downloadPdfToDevice) {
                    await window.downloadPdfToDevice(url, name)
                }
                if (typeof window.showToast === 'function') {
                    try {
                        window.showToast('تم بدء التحميل · Download gestartet', 'success')
                    } catch (toastErr2) { /* ignore */ }
                }
            } finally {
                el.innerHTML = originalHtml
                el.removeAttribute('aria-busy')
                el.classList.remove('pdf-download-loading')
                el.style.pointerEvents = ''
            }
        })()
    }, true)
})()