
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

window.PUBLIC_STORAGE_BASE = 'https://qrznwrvfjacoepegjpov.supabase.co/storage/v1/object/public/teil1lesen/'

window.FREE_PUBLIC_FILES = new Set([
    'lesen1', 'lesen2', 'lesen3', 'lesen4', 'lesen5',
    'horen1', 'horen2', 'horen3', 'horen4'
])

window.getPublicStorageUrls = function (fileKey) {
    const base = window.PUBLIC_STORAGE_BASE
    const urls = [base + fileKey + '.json']
    if (fileKey === 'lesen2') urls.unshift(base + 'Lesen2.json')
    return urls
}

window.fetchQuestionsFromPublicStorage = async function (fileKey) {
    const urls = window.getPublicStorageUrls(fileKey)
    for (let i = 0; i < urls.length; i++) {
        try {
            const response = await fetch(urls[i], { cache: 'no-store' })
            if (!response.ok) continue
            const data = await response.json()
            if (data && typeof data === 'object') return data
        } catch (e) {
            console.warn('Public storage fetch failed for', fileKey, urls[i], e)
        }
    }
    return null
}


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
                    if (window.FREE_PUBLIC_FILES && window.FREE_PUBLIC_FILES.has(fileKey)) {
                        const publicData = await window.fetchQuestionsFromPublicStorage(fileKey)
                        if (publicData && isValidData(publicData)) {
                            window._questionsCache[fileKey] = publicData
                            try {
                                localStorage.setItem(cacheKey, JSON.stringify({
                                    ts: Date.now(),
                                    data: publicData
                                }))
                            } catch (e) { }
                            return publicData
                        }
                    }
                    console.error('Login required for file:', fileKey)
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

    if (window.FREE_PUBLIC_FILES && window.FREE_PUBLIC_FILES.has(fileKey)) {
        const publicData = await window.fetchQuestionsFromPublicStorage(fileKey)
        if (publicData && isValidData(publicData)) {
            window._questionsCache[fileKey] = publicData
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    ts: Date.now(),
                    data: publicData
                }))
            } catch (e) { }
            if (revalidate) {
                fetchFromServer().catch(() => { })
            }
            return publicData
        }
    }

    try {
        return await fetchFromServer()
    } catch (error) {
        console.error('Error loading file:', error)
        return null
    }
}


/* ================= UI helpers (Themes · Szenen · Prefetch) ================= */
window.THEMES = [['nacht', '#17141f', '#ffcc00'], ['tag', '#f4f6fb', '#e63946'], ['meer', '#08323d', '#ff7a59'], ['wald', '#10291c', '#f2b84b']]
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'nacht'
window.setTheme = function (t) {
    document.documentElement.dataset.theme = t
    localStorage.setItem('theme', t)
    document.querySelectorAll('.tdot').forEach(b => b.classList.toggle('on', b.dataset.t === t))
}
window.mountThemes = function (el) {
    if (!el) return
    el.innerHTML = window.THEMES.map(t => `<button type="button" class="tdot" data-t="${t[0]}" aria-label="Theme ${t[0]}" style="background:linear-gradient(135deg,${t[1]} 50%,${t[2]} 50%)"></button>`).join('')
    el.onclick = e => { const b = e.target.closest('.tdot'); if (b) window.setTheme(b.dataset.t) }
    window.setTheme(localStorage.getItem('theme') || 'nacht')
}
window.SCENES = [
    [/wohn|haus|miet|nachbar|zimmer|möbel|umzug|سكن|شقة|جار|منزل/i, '🏠', '🛋️', '🔑', 28],
    [/arbeit|job|beruf|chef|büro|firma|kollege|fachkräfte|عمل|وظيفة|شركة/i, '💼', '🏢', '🤝', 215],
    [/reise|urlaub|flug|hotel|ferien|koffer|سفر|رحلة|عطلة|فندق/i, '✈️', '🧳', '🏝️', 190],
    [/essen|restaurant|kochen|kuchen|café|frühstück|brot|طعام|مطعم|طبخ/i, '🍽️', '🥨', '☕', 18],
    [/schule|uni|kurs|lehr|student|prüfung|lernen|مدرسة|جامعة|دورة|امتحان/i, '🎓', '📚', '✏️', 250],
    [/arzt|gesund|krank|medizin|apotheke|sport|طبيب|صحة|مريض|دواء/i, '🩺', '💊', '🏥', 160],
    [/bahn|zug|bus|auto|verkehr|bahnhof|taxi|قطار|حافلة|سيارة|مواصلات/i, '🚆', '🚌', '🎫', 205],
    [/wald|natur|park|berg|wandern|tier|hund|katze|غابة|طبيعة|حديقة|جبل/i, '🌲', '🦌', '🍄', 135],
    [/fahrrad|rad|radfahr|دراجة/i, '🚲', '🌳', '☀️', 95],
    [/handy|computer|internet|app|telefon|anruf|nachricht|هاتف|جوال|حاسوب|انترنت/i, '📱', '💻', '📞', 265],
    [/familie|kind|eltern|mutter|vater|oma|opa|freund|hochzeit|عائلة|طفل|أم|أب|صديق|زفاف/i, '👨‍👩‍👧', '🎈', '💛', 340],
    [/geld|bank|preis|kosten|miete|kauf|laden|markt|einkauf|مال|بنك|سعر|تسوق|سوق/i, '💶', '🛒', '🏦', 50],
    [/wetter|regen|sonne|schnee|winter|sommer|طقس|مطر|شمس|ثلج/i, '⛅', '🌧️', '❄️', 200],
    [/musik|konzert|film|kino|theater|fest|party|موسيقى|حفل|فيلم|سينما/i, '🎵', '🎬', '🎭', 300],
    [/stadt|berlin|hamburg|münchen|köln|frankfurt|deutschland|مدينة|ألمانيا|برلين/i, '🏙️', '🥨', '🇩🇪', 8],
    [/frau|mann|moderator|radio|sendung|interview|رجل|امرأة|مقدم|برنامج/i, '🎙️', '🎧', '📻', 175]
]
window.sceneFor = function (text, seed) {
    const s = String(text || '')
    let hit = window.SCENES.find(x => x[0].test(s))
    if (!hit) {
        let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
        const pool = [['📖', '✨', '🔤'], ['🧠', '💡', '📝'], ['🗺️', '🧭', '📮'], ['🥨', '🍺', '🏰']][(h + (seed || 0)) % 4]
        hit = [null, pool[0], pool[1], pool[2], h % 360]
    }
    return `<div class="scene" style="--h:${hit[4]}"><i class="sun"></i><b class="e1">${hit[1]}</b><b class="e2">${hit[2]}</b><b class="e3">${hit[3]}</b><u></u></div>`
}
window.ALL_FILES = ['lesen1', 'lesen2', 'lesen3', 'lesen4', 'lesen5', 'horen1', 'horen2', 'horen3', 'horen4']
window.prefetchAll = function (keys) {
    (keys || window.ALL_FILES).forEach((k, i) => setTimeout(() => { window.loadQuestionsFile(k).catch(() => { }) }, i * 120))
}
window.toast = function (msg) {
    let t = document.getElementById('toast')
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t) }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400)
}
window.markDone = function (fileKey, id) {
    try {
        const k = 'done_' + fileKey, set = new Set(JSON.parse(localStorage.getItem(k) || '[]'))
        set.add(String(id)); localStorage.setItem(k, JSON.stringify([...set]))
        const p = JSON.parse(localStorage.getItem('progress_' + fileKey) || '{}')
        p.completed = set.size; localStorage.setItem('progress_' + fileKey, JSON.stringify(p))
    } catch (e) { }
}
window.doneCount = function (fileKey) { try { return JSON.parse(localStorage.getItem('done_' + fileKey) || '[]').length } catch (e) { return 0 } }
