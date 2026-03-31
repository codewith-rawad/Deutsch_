
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


window.loadQuestionsFile = async function (fileKey, options) {
    const opts = options || {}
    const maxAgeMs = typeof opts.maxAgeMs === 'number' ? opts.maxAgeMs : 6 * 60 * 60 * 1000
    const forceReload = !!opts.forceReload
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


    if (!forceReload && window._questionsCache[fileKey]) {
        if (fileKey !== 'lesen1' || hasArabicTexts(window._questionsCache[fileKey])) {
            return window._questionsCache[fileKey]
        }
    }

    if (!forceReload && maxAgeMs > 0) {
        try {
            const cachedRaw = localStorage.getItem('questions_cache_' + fileKey)
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw)
                if (cached && typeof cached.ts === 'number' && Date.now() - cached.ts < maxAgeMs && cached.data) {
                    if (fileKey !== 'lesen1' || hasArabicTexts(cached.data)) {
                        window._questionsCache[fileKey] = cached.data
                        return cached.data
                    }
                }
            }
        } catch (e) {
            console.warn('Error reading questions cache for', fileKey, e)
        }
    }

    try {
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


        window._questionsCache[fileKey] = data
        try {

            localStorage.setItem('questions_cache_' + fileKey, JSON.stringify({
                ts: Date.now(),
                data: data
            }))
        } catch (e) {

        }

        return data
    } catch (error) {
        console.error('Error loading file:', error)
        return null
    }
}